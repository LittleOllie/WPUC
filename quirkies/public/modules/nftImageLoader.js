/**
 * NFT image loading: multi-gateway /api/img candidates, localStorage cache,
 * metadata fallback, loading UI. Loaded before app.js (classic script).
 */
(function (global) {
  "use strict";

  /** Same Worker as app.js — required when UI is served from GitHub Pages. */
  var WORKER_ORIGIN = "https://quirks-set-checker.littleollienft.workers.dev";

  var CACHE_LS_KEY = "quirks-nft-img-v1";
  var CACHE_MAX_KEYS = 400;
  var CACHE_TOKEN_LS_KEY = "quirks-nft-token-url-v1";
  var CACHE_TOKEN_MAX_KEYS = 2000;
  /** HEAD/GET probe for candidate URLs; align with Worker /api/img per-fetch budget (~12s). */
  var IMG_PROBE_TIMEOUT_MS = 12000;
  /** Wallet cards can show many thumbs; eager fetch avoids “red / empty” lag on slow IPFS. */
  var FIRST_EAGER_COUNT = 56;
  var memoryTokenUrl = new Map();

  var NFT_PLACEHOLDER_SVG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect fill="%231a1a1a" width="80" height="80" rx="6"/><path fill="%23333" d="M25 28h30v24H25z"/><circle fill="%23555" cx="32" cy="38" r="4"/><circle fill="%23555" cx="48" cy="38" r="4"/><path stroke="%23555" stroke-width="2" fill="none" d="M32 52c4 4 12 4 16 0"/></svg>'
    );

  /** Enable: localStorage.setItem("quirksDebugExtNft","1") or window.__QUIRKS_DEBUG_EXT_NFT__ = true */
  function debugExternalMatch(msg, detail) {
    var on =
      (typeof global.localStorage !== "undefined" &&
        global.localStorage.getItem("quirksDebugExtNft") === "1") ||
      global.__QUIRKS_DEBUG_EXT_NFT__;
    if (!on) return;
    try {
      if (detail !== undefined) {
        global.console.info("[quirks matched external]", msg, detail);
      } else {
        global.console.info("[quirks matched external]", msg);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function isPlaceholderUrl(u) {
    if (!u) return false;
    return /^data:image\/svg\+xml/i.test(String(u));
  }

  function nftImgNeedsRetry(img) {
    if (!img || !img.getAttribute) return false;
    if (!img.getAttribute("data-nft-c")) return false;
    if (isPlaceholderUrl(img.src)) return true;
    if (img.classList && img.classList.contains("is-broken")) return true;
    return false;
  }

  function syncGlobalRetryMissingGlow() {
    var doc = typeof global.document !== "undefined" ? global.document : null;
    if (!doc) return;
    var lit = false;
    if (
      doc.querySelector(
        ".nft-thumb.is-broken, .nft-thumb__counterpart-visual.is-broken, .quirks-tile.is-broken"
      )
    ) {
      lit = true;
    }
    if (
      !lit &&
      doc.querySelector(
        ".nft-thumb--metadata-fetch, .nft-thumb__counterpart-visual--metadata-fetch"
      )
    ) {
      lit = true;
    }
    if (!lit) {
      var imgs = doc.querySelectorAll(
        "img.quirks-tile__img[data-nft-c], img.nft-thumb__counterpart-img[data-nft-c], .nft-thumb img[data-nft-c]"
      );
      var gi;
      for (gi = 0; gi < imgs.length; gi++) {
        if (nftImgNeedsRetry(imgs[gi])) {
          lit = true;
          break;
        }
      }
    }
    ["wallet-retry-missing-btn", "quirks-retry-missing-btn"].forEach(function (
      id
    ) {
      var b = doc.getElementById(id);
      if (b) b.classList.toggle("nft-retry-missing--illuminate", lit);
    });
  }

  function retryAllMissingNftImages(root) {
    var scope = root;
    if (!scope || !scope.querySelectorAll) {
      scope =
        typeof global.document !== "undefined" ? global.document : null;
    }
    if (!scope || !scope.querySelectorAll) return 0;
    var count = 0;
    var delay = 0;
    var step = 35;

    var metaMain = scope.querySelectorAll(".nft-thumb--metadata-fetch");
    var mi;
    for (mi = 0; mi < metaMain.length; mi++) {
      var shellM = metaMain[mi];
      var btnM = shellM.querySelector(".nft-thumb__retry--metadata");
      if (!btnM || btnM.disabled) continue;
      count++;
      (function (sh, b, d) {
        global.setTimeout(function () {
          metadataRetryMainThumb(sh, b);
        }, d);
      })(shellM, btnM, delay);
      delay += step;
    }

    var metaCp = scope.querySelectorAll(
      ".nft-thumb__counterpart-visual--metadata-fetch"
    );
    for (mi = 0; mi < metaCp.length; mi++) {
      var shellC = metaCp[mi];
      var btnC = shellC.querySelector(".nft-thumb__retry--metadata");
      if (!btnC || btnC.disabled) continue;
      count++;
      (function (sh, b, d) {
        global.setTimeout(function () {
          metadataRetryCounterpartVisual(sh, b);
        }, d);
      })(shellC, btnC, delay);
      delay += step;
    }

    var imgs = scope.querySelectorAll(
      "img[data-nft-c], img.quirks-tile__img[data-nft-c], img.nft-thumb__counterpart-img[data-nft-c]"
    );
    var todo = [];
    var i;
    for (i = 0; i < imgs.length; i++) {
      if (nftImgNeedsRetry(imgs[i])) todo.push(imgs[i]);
    }
    for (i = 0; i < todo.length; i++) {
      count++;
      (function (im, d) {
        global.setTimeout(function () {
          retryNftImage(im);
        }, d);
      })(todo[i], delay + i * step);
    }
    return count;
  }

  function nftTokenKey(contract, tokenId) {
    return (
      String(contract || "")
        .trim()
        .toLowerCase() +
      ":" +
      String(tokenId != null ? tokenId : "").trim()
    );
  }

  function readTokenMap() {
    try {
      var raw = global.localStorage.getItem(CACHE_TOKEN_LS_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function writeTokenMap(map) {
    try {
      var keys = Object.keys(map);
      if (keys.length > CACHE_TOKEN_MAX_KEYS) {
        keys.sort();
        var drop = keys.length - CACHE_TOKEN_MAX_KEYS;
        for (var i = 0; i < drop; i++) delete map[keys[i]];
      }
      global.localStorage.setItem(CACHE_TOKEN_LS_KEY, JSON.stringify(map));
    } catch (e) {
      /* quota */
    }
  }

  function nftCacheGet(contract, tokenId) {
    var k = nftTokenKey(contract, tokenId);
    if (!k || k === ":") return null;
    if (memoryTokenUrl.has(k)) return memoryTokenUrl.get(k) || null;
    var m = readTokenMap();
    var v = m[k];
    if (v) memoryTokenUrl.set(k, v);
    return v || null;
  }

  function nftCacheSet(contract, tokenId, resolvedUrl) {
    if (!resolvedUrl || isPlaceholderUrl(resolvedUrl)) return;
    var k = nftTokenKey(contract, tokenId);
    if (!k || k === ":") return;
    memoryTokenUrl.set(k, resolvedUrl);
    var m = readTokenMap();
    m[k] = resolvedUrl;
    writeTokenMap(m);
  }

  /** --- Smart client cache: localStorage nft-image-{collection}-{tokenId} + session Map --- */
  var SMART_LS_PREFIX = "nft-image-";
  var SMART_ORDER_KEY = "nft-image-_key-order";
  var SMART_MAX_KEYS = 3500;
  var memorySmartNftUrl = new Map();
  var inflightLoadNftByKey = new Map();

  function canonicalTokenIdStr(tokenId) {
    if (tokenId === undefined || tokenId === null) return null;
    var s = String(tokenId).trim();
    if (!s) return null;
    try {
      if (s.startsWith("0x") || s.startsWith("0X")) {
        return BigInt(s).toString(10);
      }
      return BigInt(s).toString(10);
    } catch (e) {
      return s.replace(/[^0-9]/g, "") || null;
    }
  }

  function sanitizeCollectionSlug(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  }

  function resolveCollectionSlugForCache(meta) {
    meta = meta || {};
    if (meta.collection && String(meta.collection).trim()) {
      return sanitizeCollectionSlug(meta.collection);
    }
    var c = meta.contract;
    if (!c || !String(c).trim()) return null;
    var wc =
      typeof global !== "undefined" ? global.__quirksWalletContracts : null;
    if (!wc || typeof wc !== "object") return null;
    var cl = String(c).trim().toLowerCase();
    if (String(wc.quirkies || "").toLowerCase() === cl) return "quirkies";
    if (String(wc.quirklings || "").toLowerCase() === cl) return "quirklings";
    if (String(wc.inx || "").toLowerCase() === cl) return "inx";
    return null;
  }

  function smartNftImageLsKey(collectionSlug, tokenId) {
    var slug = sanitizeCollectionSlug(collectionSlug);
    var tid = canonicalTokenIdStr(tokenId);
    if (!slug || !tid) return null;
    return SMART_LS_PREFIX + slug + "-" + tid;
  }

  function readSmartKeyOrder() {
    try {
      var raw = global.localStorage.getItem(SMART_ORDER_KEY);
      if (!raw) return [];
      var o = JSON.parse(raw);
      return Array.isArray(o) ? o : [];
    } catch (e) {
      return [];
    }
  }

  function writeSmartKeyOrder(arr) {
    try {
      global.localStorage.setItem(SMART_ORDER_KEY, JSON.stringify(arr));
    } catch (e) {
      /* ignore */
    }
  }

  function pruneSmartLsOrder(lsKey) {
    var arr = readSmartKeyOrder();
    var ix = arr.indexOf(lsKey);
    if (ix !== -1) arr.splice(ix, 1);
    arr.push(lsKey);
    while (arr.length > SMART_MAX_KEYS) {
      var old = arr.shift();
      if (old && old !== SMART_ORDER_KEY) {
        try {
          global.localStorage.removeItem(old);
        } catch (e2) {
          /* ignore */
        }
      }
    }
    writeSmartKeyOrder(arr);
  }

  function smartNftImageGet(collectionSlug, tokenId) {
    var key = smartNftImageLsKey(collectionSlug, tokenId);
    if (!key) return null;
    if (memorySmartNftUrl.has(key)) {
      return memorySmartNftUrl.get(key) || null;
    }
    try {
      var v = global.localStorage.getItem(key);
      if (v && !isPlaceholderUrl(v)) {
        memorySmartNftUrl.set(key, v);
        return v;
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function smartNftImageSet(collectionSlug, tokenId, resolvedUrl) {
    var key = smartNftImageLsKey(collectionSlug, tokenId);
    if (!key || !resolvedUrl || isPlaceholderUrl(resolvedUrl)) return;
    memorySmartNftUrl.set(key, resolvedUrl);
    try {
      global.localStorage.setItem(key, resolvedUrl);
      pruneSmartLsOrder(key);
    } catch (e) {
      /* quota: drop oldest */
      try {
        var arr = readSmartKeyOrder();
        if (arr.length > 10) {
          var drop = arr.splice(0, Math.ceil(arr.length * 0.15));
          for (var di = 0; di < drop.length; di++) {
            global.localStorage.removeItem(drop[di]);
          }
          writeSmartKeyOrder(arr);
          global.localStorage.setItem(key, resolvedUrl);
          pruneSmartLsOrder(key);
        }
      } catch (e2) {
        /* ignore */
      }
    }
  }

  function parseFailedGateways(img) {
    if (!img) return [];
    var s = img.getAttribute("data-nft-failed-gw");
    if (!s) return [];
    try {
      var arr = JSON.parse(s);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function addFailedGateway(img, gwIdx) {
    if (!img || gwIdx < 0) return;
    var f = parseFailedGateways(img);
    if (f.indexOf(gwIdx) === -1) f.push(gwIdx);
    img.setAttribute("data-nft-failed-gw", JSON.stringify(f));
  }

  function parseFailedIndices(img) {
    if (!img) return [];
    var s = img.getAttribute("data-nft-failed");
    if (!s) return [];
    try {
      var arr = JSON.parse(s);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function addFailedIndex(img, idx) {
    var f = parseFailedIndices(img);
    if (f.indexOf(idx) === -1) f.push(idx);
    img.setAttribute("data-nft-failed", JSON.stringify(f));
  }

  function nextUntriedIndex(img, listLength) {
    var f = parseFailedIndices(img);
    for (var i = 0; i < listLength; i++) {
      if (f.indexOf(i) === -1) return i;
    }
    return -1;
  }

  function probeUrlWithTimeout(url, ms) {
    return new Promise(function (resolve) {
      var c = new AbortController();
      var t = setTimeout(function () {
        c.abort();
        resolve(false);
      }, ms);
      fetch(url, {
        method: "GET",
        mode: "cors",
        signal: c.signal,
        cache: "no-store",
      })
        .then(function (r) {
          clearTimeout(t);
          resolve(!!(r && r.ok));
        })
        .catch(function () {
          clearTimeout(t);
          resolve(false);
        });
    });
  }

  var bgRetryQueue = [];
  var bgRetryTimer = null;
  var BG_RETRY_GAP_MS = 5200;
  /** If still broken after initial pass, one more full retry cycle (slow gateways). */
  var WALLET_AUTO_RETRY_DELAY_MS = 14000;

  function pumpBgRetry() {
    bgRetryTimer = null;
    if (!bgRetryQueue.length) return;
    var img = bgRetryQueue.shift();
    if (img && img.parentElement && img.classList.contains("is-broken")) {
      img.removeAttribute("data-nft-bg-queued");
      retryNftImage(img);
    } else if (img) {
      img.removeAttribute("data-nft-bg-queued");
    }
    if (bgRetryQueue.length) {
      bgRetryTimer = setTimeout(pumpBgRetry, BG_RETRY_GAP_MS);
    }
  }

  function queueBackgroundImgRetry(img) {
    if (!img || !img.getAttribute("data-nft-c")) return;
    if (img.getAttribute("data-nft-bg-queued") === "1") return;
    img.setAttribute("data-nft-bg-queued", "1");
    bgRetryQueue.push(img);
    if (!bgRetryTimer) {
      bgRetryTimer = setTimeout(pumpBgRetry, BG_RETRY_GAP_MS);
    }
  }

  function escapeHtmlAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var GATEWAY_BASES = [
    "https://cloudflare-ipfs.com/ipfs/",
    "https://nftstorage.link/ipfs/",
    "https://w3s.link/ipfs/",
    "https://dweb.link/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.io/ipfs/",
  ];

  function getApiBase() {
    var loc = global.location;
    if (!WORKER_ORIGIN) return "";
    if (!loc) return WORKER_ORIGIN;
    if (loc.protocol === "file:") return WORKER_ORIGIN;
    try {
      if (loc.hostname === new URL(WORKER_ORIGIN).hostname) return "";
    } catch (e) {
      /* ignore */
    }
    if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") {
      return WORKER_ORIGIN;
    }
    return WORKER_ORIGIN;
  }

  function apiUrl(pathAndQuery) {
    var base = getApiBase().replace(/\/$/, "");
    if (base) return base + pathAndQuery;
    if (typeof global.location !== "undefined" && global.location.origin) {
      return global.location.origin.replace(/\/$/, "") + pathAndQuery;
    }
    return pathAndQuery;
  }

  /**
   * Rebuild /api/img?url=… with exactly one encodeURIComponent layer on the inner URL.
   * Fixes double-encoding (%252F) when URL/href was round-tripped through URLSearchParams.
   */
  function normalizeApiImgUrl(s) {
    if (!s || typeof s !== "string") return s;
    var t = s.trim();
    if (t.indexOf("api/img") === -1) return s;
    try {
      var base =
        typeof global.location !== "undefined" && global.location.href
          ? global.location.href
          : "https://local.invalid/";
      var parsed = new URL(t, base);
      if (!/\/api\/img$/i.test(parsed.pathname || "")) return s;
      var inner = parsed.searchParams.get("url");
      if (inner == null || inner === "") return s;
      var q = "/api/img?url=" + encodeURIComponent(inner);
      var c = parsed.searchParams.get("contract");
      if (c) q += "&contract=" + encodeURIComponent(c);
      var tid = parsed.searchParams.get("tokenId");
      if (tid != null && tid !== "") {
        q += "&tokenId=" + encodeURIComponent(tid);
      }
      var col = parsed.searchParams.get("collection");
      if (col) q += "&collection=" + encodeURIComponent(col);
      return apiUrl(q);
    } catch (e) {
      return s;
    }
  }

  function normalizeMediaUrl(u) {
    if (!u || typeof u !== "string") return null;
    var s = u.trim();
    if (!s) return null;
    if (s.indexOf("/api/img") === 0) return s;
    if (s.indexOf("ipfs://") === 0) {
      var path = s.slice(7).replace(/^ipfs\//, "").replace(/^\/+/, "");
      return "https://nftstorage.link/ipfs/" + path;
    }
    if (s.indexOf("ar://") === 0) {
      return "https://arweave.net/" + s.slice(5);
    }
    return s;
  }

  function appendImgMetaQuery(basePathWithQuery, meta) {
    meta = meta || {};
    var q = basePathWithQuery;
    if (meta.contract && String(meta.contract).trim()) {
      q += "&contract=" + encodeURIComponent(String(meta.contract).trim());
    }
    if (
      meta.tokenId !== undefined &&
      meta.tokenId !== null &&
      String(meta.tokenId).trim() !== ""
    ) {
      q += "&tokenId=" + encodeURIComponent(String(meta.tokenId).trim());
    }
    if (meta.collection && String(meta.collection).trim()) {
      q += "&collection=" + encodeURIComponent(String(meta.collection).trim());
    }
    return q;
  }

  function proxify(u, meta) {
    if (!u || typeof u !== "string") return u;
    var s = u.trim();
    if (!s) return s;
    meta = meta || {};
    if (s.indexOf("/api/img") === 0) {
      return normalizeApiImgUrl(apiUrl(s));
    }
    try {
      var parsed = new URL(s);
      if (
        parsed.pathname === "/api/img" &&
        parsed.search.indexOf("url=") !== -1
      ) {
        return normalizeApiImgUrl(s);
      }
      /* Same-origin static assets in /public must not use worker proxy (breaks grid branding). */
      if (typeof global.location !== "undefined" && global.location.href) {
        var pageLoc = new URL(global.location.href);
        if (parsed.origin === pageLoc.origin) {
          var path = parsed.pathname || "";
          var seg = path.replace(/\/+$/, "").split("/");
          var baseName = String(seg[seg.length - 1] || "").toLowerCase();
          if (
            baseName === "quirkieslogo.png" ||
            baseName === "pblo.png"
          ) {
            return s;
          }
        }
      }
    } catch (e) {
      /* not absolute */
    }
    return normalizeApiImgUrl(
      apiUrl(
        appendImgMetaQuery("/api/img?url=" + encodeURIComponent(s), meta)
      )
    );
  }

  function extractIpfsPath(u) {
    if (!u) return null;
    var s = String(u);
    try {
      if (/\/api\/img/i.test(s) && s.indexOf("url=") !== -1) {
        var qi = s.indexOf("url=");
        if (qi !== -1) {
          var rest = s.slice(qi + 4);
          var amp = rest.indexOf("&");
          if (amp !== -1) rest = rest.slice(0, amp);
          var inner = rest;
          var j = 0;
          for (; j < 8; j++) {
            try {
              var nx = decodeURIComponent(inner.replace(/\+/g, "%20"));
              if (nx === inner) break;
              inner = nx;
            } catch (e0) {
              break;
            }
          }
          return extractIpfsPath(inner);
        }
      }
    } catch (e) {
      /* ignore */
    }
    if (s.indexOf("ipfs://") === 0) {
      var p = s.slice(7).replace(/^ipfs\//, "").replace(/^\/+/, "");
      return p || null;
    }
    var m = s.match(/\/ipfs\/(.+)/i);
    if (m) {
      var tail = m[1].split("?")[0].split("#")[0];
      try {
        tail = decodeURIComponent(tail);
      } catch (e2) {
        /* keep */
      }
      return tail.replace(/^\/+/, "") || null;
    }
    return null;
  }

  function readCacheMap() {
    try {
      var raw = global.localStorage.getItem(CACHE_LS_KEY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" ? o : {};
    } catch (e) {
      return {};
    }
  }

  function writeCacheMap(map) {
    try {
      var keys = Object.keys(map);
      if (keys.length > CACHE_MAX_KEYS) {
        keys.sort();
        var drop = keys.length - CACHE_MAX_KEYS;
        for (var i = 0; i < drop; i++) delete map[keys[i]];
      }
      global.localStorage.setItem(CACHE_LS_KEY, JSON.stringify(map));
    } catch (e) {
      /* quota */
    }
  }

  function cacheGet(pathKey) {
    if (!pathKey) return null;
    var m = readCacheMap();
    return m[pathKey] || null;
  }

  function cacheSet(pathKey, resolvedUrl) {
    if (!pathKey || !resolvedUrl) return;
    var m = readCacheMap();
    m[pathKey] = resolvedUrl;
    writeCacheMap(m);
  }

  function buildProxyCandidatesForPath(ipfsPath, meta) {
    var out = [];
    for (var i = 0; i < GATEWAY_BASES.length; i++) {
      out.push(proxify(GATEWAY_BASES[i] + ipfsPath, meta));
    }
    return out;
  }

  function candidateGatewayIndex(candidateUrl) {
    if (!candidateUrl || typeof candidateUrl !== "string") return -1;
    var inner = null;
    try {
      var base =
        typeof global.location !== "undefined" && global.location.href
          ? global.location.href
          : "https://local.invalid/";
      var p = new URL(candidateUrl, base);
      if (/\/api\/img$/i.test(p.pathname || "")) {
        inner = p.searchParams.get("url");
      }
    } catch (e) {
      return -1;
    }
    var d = inner;
    if (d) {
      try {
        for (var round = 0; round < 4; round++) {
          var nx = decodeURIComponent(d.replace(/\+/g, "%20"));
          if (nx === d) break;
          d = nx;
        }
      } catch (e2) {
        d = inner;
      }
      for (var j = 0; j < GATEWAY_BASES.length; j++) {
        if (d.indexOf(GATEWAY_BASES[j]) === 0) return j;
      }
    }
    for (var k = 0; k < GATEWAY_BASES.length; k++) {
      if (candidateUrl.indexOf(GATEWAY_BASES[k].slice(0, 24)) !== -1) {
        return k;
      }
    }
    return -1;
  }

  function buildProxyCandidatesForPathFiltered(ipfsPath, meta, failedGwIndices) {
    var skip = {};
    if (failedGwIndices && failedGwIndices.length) {
      for (var i = 0; i < failedGwIndices.length; i++) {
        skip[failedGwIndices[i]] = 1;
      }
    }
    var out = [];
    for (var j = 0; j < GATEWAY_BASES.length; j++) {
      if (skip[j]) continue;
      out.push(proxify(GATEWAY_BASES[j] + ipfsPath, meta));
    }
    return out;
  }

  function dedupeStrings(arr) {
    var seen = {};
    var u = [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && !seen[arr[i]]) {
        seen[arr[i]] = 1;
        u.push(arr[i]);
      }
    }
    return u;
  }

  function rebuildCandidatesForRetry(img) {
    var path = img.getAttribute("data-nft-ipfs-path");
    var contract = img.getAttribute("data-nft-contract");
    var tokenId = img.getAttribute("data-nft-token-id");
    var colSlug = img.getAttribute("data-nft-collection");
    if (!path) return null;
    var meta = {
      contract: contract,
      tokenId: tokenId,
      collection: colSlug,
    };
    var failedGw = parseFailedGateways(img);
    var list = buildProxyCandidatesForPathFiltered(path, meta, failedGw);
    if (!list.length) {
      img.removeAttribute("data-nft-failed-gw");
      list = buildProxyCandidatesForPath(path, meta);
    }
    var slug = colSlug || resolveCollectionSlugForCache(meta);
    var tid = canonicalTokenIdStr(tokenId);
    var smartHit = slug && tid ? smartNftImageGet(slug, tid) : null;
    var tokHit =
      contract && tokenId ? nftCacheGet(contract, tokenId) : null;
    var hit = smartHit || tokHit;
    if (hit && !isPlaceholderUrl(hit)) {
      var hn = normalizeApiImgUrl(hit);
      list = [hn].concat(
        list.filter(function (x) {
          return x !== hn;
        })
      );
    }
    list = dedupeStrings(
      list.map(function (x) {
        return normalizeApiImgUrl(String(x));
      })
    );
    return list.length ? list : null;
  }

  function mergePrependNormalizedUrls(list, prepend) {
    var out = list && list.length ? list.slice() : [];
    for (var pi = prepend.length - 1; pi >= 0; pi--) {
      var pu = prepend[pi];
      if (!pu) continue;
      out = out.filter(function (x) {
        return normalizeApiImgUrl(String(x)) !== pu;
      });
      out = [pu].concat(out);
    }
    out = out.map(function (x) {
      return normalizeApiImgUrl(String(x));
    });
    return dedupeStrings(out);
  }

  function expandCandidatesFromIpfsFirst(urls, meta) {
    if (!urls || !urls.length) return urls;
    var first = urls[0];
    var path0 = extractIpfsPath(String(first || ""));
    if (!path0) return urls;
    var expanded = buildProxyCandidatesForPath(path0, {
      contract: meta.contract,
      tokenId: meta.tokenId,
      collection: meta.collection,
    });
    var hit0 = cacheGet(path0);
    if (hit0 && !isPlaceholderUrl(hit0) && expanded.indexOf(hit0) === -1) {
      expanded = [hit0].concat(expanded);
    }
    expanded = expanded.map(function (x) {
      return normalizeApiImgUrl(String(x));
    });
    expanded = dedupeStrings(expanded);
    var rest = expanded.filter(function (x) {
      return urls.indexOf(x) === -1;
    });
    return dedupeStrings(urls.concat(rest));
  }

  function buildImageCandidates(raw, meta) {
    meta = meta || {};
    var contract = meta.contract;
    var tokenId = meta.tokenId;
    var slug = resolveCollectionSlugForCache(meta);
    var tidCanon = canonicalTokenIdStr(tokenId);
    var prependSmart = [];
    if (slug && tidCanon) {
      var smartHit0 = smartNftImageGet(slug, tidCanon);
      if (smartHit0 && !isPlaceholderUrl(smartHit0)) {
        prependSmart.push(normalizeApiImgUrl(smartHit0));
      }
    }

    var tokHit =
      contract && tokenId != null && String(tokenId).trim() !== ""
        ? nftCacheGet(contract, tokenId)
        : null;
    if (tokHit && isPlaceholderUrl(tokHit)) tokHit = null;
    if (tokHit && slug && tidCanon) {
      smartNftImageSet(slug, tidCanon, normalizeApiImgUrl(tokHit));
    }

    var primary = normalizeMediaUrl(raw);
    if (!primary) {
      var listBare = [];
      if (tokHit) listBare.push(normalizeApiImgUrl(tokHit));
      listBare = mergePrependNormalizedUrls(listBare, prependSmart);
      if (!listBare.length) {
        return { primary: null, candidates: [], ipfsPath: null };
      }
      listBare = expandCandidatesFromIpfsFirst(listBare, meta);
      var ip0 = extractIpfsPath(listBare[0] || "");
      return {
        primary: listBare[0] || null,
        candidates: listBare,
        ipfsPath: ip0 || null,
      };
    }

    var path = extractIpfsPath(primary);
    var list;
    if (path) {
      list = buildProxyCandidatesForPath(path, {
        contract: contract,
        tokenId: tokenId,
        collection: meta.collection,
      });
      var hit = cacheGet(path);
      if (hit && !isPlaceholderUrl(hit) && list.indexOf(hit) === -1) {
        list = [hit].concat(list);
      } else if (hit && !isPlaceholderUrl(hit)) {
        list = [hit].concat(list.filter(function (x) {
          return x !== hit;
        }));
      }
    } else {
      var pm = {
        contract: contract,
        tokenId: tokenId,
        collection: meta.collection,
      };
      list = dedupeStrings([proxify(primary, pm)]);
    }
    list = dedupeStrings(list);
    if (tokHit) {
      list = [tokHit].concat(list.filter(function (x) {
        return x !== tokHit;
      }));
    }
    list = list.map(function (x) {
      return normalizeApiImgUrl(String(x));
    });
    list = dedupeStrings(list);
    var ipfsPathOut = path || extractIpfsPath(primary) || null;
    list = mergePrependNormalizedUrls(list, prependSmart);
    return {
      primary: list[0] || null,
      candidates: list,
      ipfsPath: ipfsPathOut,
    };
  }

  function findLoaderRoot(img) {
    if (!img) return null;
    var tile = img.closest && img.closest(".quirks-tile");
    if (tile) return tile;
    var p = img.parentElement;
    if (!p) return null;
    if (p.classList && p.classList.contains("nft-thumb__counterpart-visual")) {
      return p;
    }
    if (p.classList && p.classList.contains("nft-thumb")) return p;
    return p;
  }

  function cacheBustUrl(url) {
    var s = String(url || "");
    if (!s) return s;
    var q = s.indexOf("?");
    if (q === -1) {
      return s + "?_nftretry=" + Date.now();
    }
    var base = s.slice(0, q);
    var rest = s.slice(q + 1);
    var parts = rest.split("&").filter(function (seg) {
      return seg.indexOf("_nftretry=") !== 0;
    });
    parts.push("_nftretry=" + Date.now());
    return base + "?" + parts.join("&");
  }

  function injectThumbFallbackPlaceholder(root) {
    if (!root) return;
    var fallback = root.querySelector && root.querySelector(".nft-thumb-fallback");
    if (!fallback || fallback.querySelector(".nft-thumb__failed-ph")) return;
    var doc = global.document;
    if (!doc) return;
    var ph = doc.createElement("img");
    ph.className = "nft-thumb__failed-ph";
    ph.src = NFT_PLACEHOLDER_SVG;
    ph.alt = "";
    ph.width = 56;
    ph.height = 56;
    fallback.insertBefore(ph, fallback.firstChild);
  }

  function retryNftImage(img) {
    if (!img) return;
    if (img.getAttribute("data-nft-external-match") === "1") {
      debugExternalMatch("retryNftImage", {
        collection: img.getAttribute("data-nft-collection"),
        tokenId: img.getAttribute("data-nft-token-id"),
        priorFail: img.getAttribute("data-nft-fail-reason"),
      });
    }
    img.removeAttribute("data-nft-fail-reason");
    var root = findLoaderRoot(img);
    if (root && root.classList) {
      root.classList.remove("is-broken", "is-loaded");
    }
    img.classList.remove("is-broken");
    img.removeAttribute("data-nft-ma");
    img.removeAttribute("data-nft-bg-queued");
    var ph0 = root && root.querySelector && root.querySelector(".nft-thumb__failed-ph");
    if (ph0) ph0.remove();

    var contract = img.getAttribute("data-nft-contract");
    var tokenId = img.getAttribute("data-nft-token-id");
    var colAttr = img.getAttribute("data-nft-collection");
    var slugRetry =
      colAttr ||
      resolveCollectionSlugForCache({
        contract: contract,
        tokenId: tokenId,
      });
    var tidCanon = canonicalTokenIdStr(tokenId);
    if (slugRetry && tidCanon) {
      var smartCached = smartNftImageGet(slugRetry, tidCanon);
      if (smartCached && !isPlaceholderUrl(smartCached)) {
        img.removeAttribute("data-nft-failed");
        img.removeAttribute("data-nft-failed-gw");
        var mergedS = [normalizeApiImgUrl(smartCached)];
        var rawListS = img.getAttribute("data-nft-c");
        if (rawListS) {
          try {
            var curS = JSON.parse(decodeURIComponent(rawListS));
            if (Array.isArray(curS)) {
              for (var si = 0; si < curS.length; si++) {
                if (curS[si] !== mergedS[0]) mergedS.push(curS[si]);
              }
            }
          } catch (eS) {
            /* ignore */
          }
        }
        mergedS = dedupeStrings(mergedS);
        img.setAttribute(
          "data-nft-c",
          encodeURIComponent(JSON.stringify(mergedS))
        );
        img.setAttribute("data-nft-ci", "0");
        img.src = cacheBustUrl(mergedS[0]);
        return;
      }
    }

    if (contract && tokenId != null && String(tokenId).trim() !== "") {
      var cached = nftCacheGet(contract, tokenId);
      if (cached && !isPlaceholderUrl(cached)) {
        img.removeAttribute("data-nft-failed");
        img.removeAttribute("data-nft-failed-gw");
        var merged = [cached];
        var rawList = img.getAttribute("data-nft-c");
        if (rawList) {
          try {
            var cur = JSON.parse(decodeURIComponent(rawList));
            if (Array.isArray(cur)) {
              for (var mi = 0; mi < cur.length; mi++) {
                if (cur[mi] !== cached) merged.push(cur[mi]);
              }
            }
          } catch (e) {
            /* ignore */
          }
        }
        merged = dedupeStrings(merged);
        img.setAttribute(
          "data-nft-c",
          encodeURIComponent(JSON.stringify(merged))
        );
        img.setAttribute("data-nft-ci", "0");
        img.src = cacheBustUrl(cached);
        return;
      }
    }

    var raw = img.getAttribute("data-nft-c");
    if (raw) {
      var list;
      try {
        list = JSON.parse(decodeURIComponent(raw));
      } catch (e) {
        return;
      }
      if (!Array.isArray(list) || !list.length) return;

      if (
        parseFailedGateways(img).length &&
        img.getAttribute("data-nft-ipfs-path")
      ) {
        var reb = rebuildCandidatesForRetry(img);
        if (reb && reb.length) {
          img.removeAttribute("data-nft-failed");
          img.setAttribute(
            "data-nft-c",
            encodeURIComponent(JSON.stringify(reb))
          );
          img.setAttribute("data-nft-ci", "0");
          img.src = cacheBustUrl(reb[0]);
          return;
        }
      }

      var ci = parseInt(img.getAttribute("data-nft-ci") || "0", 10);
      var failed = parseFailedIndices(img);
      var next = -1;
      for (var s = 0; s < list.length; s++) {
        var j = (ci + 1 + s) % list.length;
        if (failed.indexOf(j) === -1) {
          next = j;
          break;
        }
      }
      if (next < 0) {
        img.removeAttribute("data-nft-failed");
        next = (ci + 1) % list.length;
      }
      img.setAttribute("data-nft-ci", String(next));
      img.src = cacheBustUrl(list[next]);
      return;
    }
    if (img.src) {
      img.src = cacheBustUrl(img.src);
    }
  }

  function injectGridRetryButton(root) {
    if (!root || !root.classList) return;
    if (root.querySelector(".nft-thumb__retry--floating")) return;
    var doc = typeof global.document !== "undefined" ? global.document : null;
    if (!doc) return;
    var stale = root.querySelectorAll(
      ".nft-thumb__retry:not(.nft-thumb__retry--metadata):not(.nft-thumb__retry--slot-action):not(.nft-thumb__retry--floating)"
    );
    for (var si = 0; si < stale.length; si++) {
      stale[si].remove();
    }
    var b = doc.createElement("button");
    b.type = "button";
    b.className = "nft-thumb__retry";
    b.setAttribute("data-nft-retry-dynamic", "1");
    b.setAttribute("aria-label", "Retry loading image");
    b.textContent = "Retry";
    if (root.classList.contains("quirks-tile")) {
      var strip = root.querySelector(".quirks-tile__strip");
      if (strip) {
        strip.appendChild(b);
      } else {
        root.appendChild(b);
      }
      return;
    }
    if (
      root.classList.contains("nft-thumb") ||
      root.classList.contains("nft-thumb__counterpart-visual")
    ) {
      b.classList.add("nft-thumb__retry--floating");
      root.appendChild(b);
    }
  }

  function onImgLoad(img) {
    var srcNorm = normalizeApiImgUrl(String(img.src || ""));
    var realOk = !isPlaceholderUrl(srcNorm);
    var root = findLoaderRoot(img);
    if (root && root.classList) root.classList.add("is-loaded");
    if (realOk) {
      if (img.classList) img.classList.remove("is-broken");
      if (root && root.classList) root.classList.remove("is-broken");
      img.removeAttribute("data-nft-fail-reason");
      if (img.getAttribute("data-nft-external-match") === "1") {
        var rcOk = img.getAttribute("data-nft-c");
        var nCand = 0;
        if (rcOk) {
          try {
            var arrOk = JSON.parse(decodeURIComponent(rcOk));
            if (Array.isArray(arrOk)) nCand = arrOk.length;
          } catch (eOk) {
            /* ignore */
          }
        }
        debugExternalMatch("load ok", {
          owned: "0",
          collection: img.getAttribute("data-nft-collection"),
          tokenId: img.getAttribute("data-nft-token-id"),
          metadataResolved: "1",
          candidateUrlsCount: nCand,
        });
      }
    }
    if (root) {
      var fb0 = root.querySelector(".nft-thumb-fallback");
      if (fb0) fb0.setAttribute("aria-hidden", realOk ? "true" : "false");
      if (realOk) {
        var dyn = root.querySelector(
          '.nft-thumb__retry[data-nft-retry-dynamic="1"]'
        );
        if (dyn) dyn.remove();
        var ph = root.querySelector(".nft-thumb__failed-ph");
        if (ph) ph.remove();
        if (root.classList.contains("quirks-tile")) {
          var stripImgs = root.querySelectorAll("img.quirks-tile__img");
          var stillNeed = false;
          var ii;
          for (ii = 0; ii < stripImgs.length; ii++) {
            if (nftImgNeedsRetry(stripImgs[ii])) {
              stillNeed = true;
              break;
            }
          }
          if (!stillNeed) {
            var tileBtns = root.querySelectorAll(".nft-thumb__retry");
            for (ii = 0; ii < tileBtns.length; ii++) tileBtns[ii].remove();
          }
        } else {
          var innerRetry = root.querySelectorAll(
            ".nft-thumb__retry:not(.nft-thumb__retry--metadata)"
          );
          for (var ir = 0; ir < innerRetry.length; ir++) {
            innerRetry[ir].remove();
          }
        }
      }
    }
    if (realOk) {
      if (
        img.classList &&
        img.classList.contains("nft-thumb__counterpart-img")
      ) {
        var cpCard = img.closest(".nft-thumb--counterpart");
        if (cpCard) {
          var slotBtn = cpCard.querySelector(".nft-thumb__retry--slot-action");
          if (slotBtn) slotBtn.remove();
        }
      }
    }
    img.removeAttribute("data-nft-failed");
    img.removeAttribute("data-nft-failed-gw");
    var contract = img.getAttribute("data-nft-contract");
    var tokenId = img.getAttribute("data-nft-token-id");
    var colAttr = img.getAttribute("data-nft-collection");
    var slugSave =
      colAttr ||
      resolveCollectionSlugForCache({
        contract: contract,
        tokenId: tokenId,
      });
    var tidSave = canonicalTokenIdStr(tokenId);
    if (slugSave && tidSave && !isPlaceholderUrl(srcNorm)) {
      smartNftImageSet(slugSave, tidSave, srcNorm);
    }
    if (
      contract &&
      tokenId != null &&
      String(tokenId).trim() !== "" &&
      !isPlaceholderUrl(srcNorm)
    ) {
      nftCacheSet(contract, tokenId, srcNorm);
    }
    var path = extractIpfsPath(srcNorm);
    if (path && !isPlaceholderUrl(srcNorm)) cacheSet(path, srcNorm);
    syncGlobalRetryMissingGlow();
  }

  function onImgError(img) {
    if (!img) return;
    var raw = img.getAttribute("data-nft-c");
    if (!raw) {
      failThumb(img, "no-candidate-attr");
      return;
    }
    var list;
    try {
      list = JSON.parse(decodeURIComponent(raw));
    } catch (e) {
      failThumb(img, "candidate-json-parse");
      return;
    }
    if (!Array.isArray(list) || !list.length) {
      failThumb(img, "candidate-list-empty");
      return;
    }
    var idx = parseInt(img.getAttribute("data-nft-ci") || "0", 10);
    if (img.getAttribute("data-nft-external-match") === "1") {
      debugExternalMatch("candidate error", {
        owned: "0",
        collection: img.getAttribute("data-nft-collection"),
        tokenId: img.getAttribute("data-nft-token-id"),
        candidateIndex: idx,
        candidatesTotal: list.length,
      });
    }
    addFailedIndex(img, idx);
    addFailedGateway(img, candidateGatewayIndex(list[idx]));
    var nextIdx = nextUntriedIndex(img, list.length);
    if (nextIdx >= 0) {
      img.setAttribute("data-nft-ci", String(nextIdx));
      img.src = list[nextIdx];
      return;
    }
    img.removeAttribute("data-nft-failed");
    var metaAttempt = parseInt(img.getAttribute("data-nft-ma") || "0", 10);
    var contract = img.getAttribute("data-nft-contract");
    var tokenId = img.getAttribute("data-nft-token-id");
    if (metaAttempt < 1 && contract && tokenId) {
      img.setAttribute("data-nft-ma", "1");
      fetch(
        apiUrl(
          "/api/nft-metadata?contract=" +
            encodeURIComponent(contract) +
            "&tokenId=" +
            encodeURIComponent(tokenId)
        )
      )
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (j) {
          if (!j || !j.image) {
            failThumb(img, "metadata-no-image-field");
            return;
          }
          var colFromImg = img.getAttribute("data-nft-collection");
          var b = buildImageCandidates(j.image, {
            contract: contract,
            tokenId: tokenId,
            collection: colFromImg || undefined,
          });
          if (!b.candidates.length) {
            failThumb(img, "metadata-no-candidates");
            return;
          }
          if (img.getAttribute("data-nft-external-match") === "1") {
            debugExternalMatch("metadata refetch applied", {
              owned: "0",
              collection: colFromImg,
              tokenId: tokenId,
              candidateUrlsCount: b.candidates.length,
            });
          }
          img.removeAttribute("data-nft-failed");
          img.removeAttribute("data-nft-failed-gw");
          img.setAttribute(
            "data-nft-c",
            encodeURIComponent(JSON.stringify(b.candidates))
          );
          img.setAttribute("data-nft-ci", "0");
          if (b.ipfsPath) {
            img.setAttribute("data-nft-ipfs-path", b.ipfsPath);
          }
          var slM = resolveCollectionSlugForCache({
            contract: contract,
            tokenId: tokenId,
            collection: colFromImg || undefined,
          });
          if (slM) img.setAttribute("data-nft-collection", slM);
          img.src = b.candidates[0];
        })
        .catch(function () {
          failThumb(img, "metadata-fetch-error");
        });
      return;
    }
    failThumb(img, "candidates-exhausted");
  }

  function failThumb(img, reason) {
    if (!img) return;
    var root = findLoaderRoot(img);
    var isGrid =
      img.classList && img.classList.contains("quirks-tile__img");
    if (isGrid) {
      img.classList.remove("is-broken");
      img.src = NFT_PLACEHOLDER_SVG;
    } else {
      img.classList.add("is-broken");
    }
    if (root && root.classList) {
      root.classList.add("is-broken");
      root.classList.add("is-loaded");
    }
    if (!isGrid) {
      injectThumbFallbackPlaceholder(root);
      var fb = root && root.querySelector && root.querySelector(".nft-thumb-fallback");
      if (fb) fb.setAttribute("aria-hidden", "false");
    }
    injectGridRetryButton(root);
    queueBackgroundImgRetry(img);
    if (reason) {
      img.setAttribute("data-nft-fail-reason", String(reason));
    }
    if (img.getAttribute("data-nft-external-match") === "1") {
      var rcf = img.getAttribute("data-nft-c");
      var nf = 0;
      if (rcf) {
        try {
          var arf = JSON.parse(decodeURIComponent(rcf));
          if (Array.isArray(arf)) nf = arf.length;
        } catch (ef) {
          /* ignore */
        }
      }
      debugExternalMatch("final failure", {
        owned: "0",
        collection: img.getAttribute("data-nft-collection"),
        tokenId: img.getAttribute("data-nft-token-id"),
        metadataResolved: img.getAttribute("data-nft-ma") === "1" ? "1" : "0",
        candidateUrlsCount: nf,
        finalFailureReason: reason || "unknown",
      });
    }
    if (!isGrid && img.getAttribute("data-nft-soft-retry-armed") !== "1") {
      img.setAttribute("data-nft-soft-retry-armed", "1");
      global.setTimeout(function () {
        if (!img || !img.parentElement) return;
        img.removeAttribute("data-nft-soft-retry-armed");
        if (
          img.classList.contains("is-broken") &&
          img.getAttribute("data-nft-c")
        ) {
          retryNftImage(img);
        }
      }, WALLET_AUTO_RETRY_DELAY_MS);
    }
    syncGlobalRetryMissingGlow();
  }

  function mainThumbFetchShellHtml(meta) {
    meta = meta || {};
    var contract = meta.contract ? String(meta.contract) : "";
    var tokenId = meta.tokenId != null ? String(meta.tokenId) : "";
    if (!contract || tokenId === "") {
      return (
        '<div class="nft-thumb nft-thumb--empty"><span class="nft-thumb-fallback">No image</span></div>'
      );
    }
    var idx =
      typeof meta.imageIndex === "number" ? String(meta.imageIndex) : "0";
    var altPart = meta.alt ? String(meta.alt) : "NFT";
    return (
      '<div class="nft-thumb nft-thumb--empty nft-thumb--metadata-fetch"' +
      ' data-nft-contract="' +
      escapeHtmlAttr(contract) +
      '" data-nft-token-id="' +
      escapeHtmlAttr(tokenId) +
      '" data-nft-image-index="' +
      escapeHtmlAttr(idx) +
      '" data-nft-alt="' +
      escapeHtmlAttr(altPart) +
      '">' +
      '<span class="nft-thumb-fallback">No image</span>' +
      '<button type="button" class="nft-thumb__retry nft-thumb__retry--metadata">Load image</button>' +
      "</div>"
    );
  }

  function counterpartFetchShellHtml(meta) {
    meta = meta || {};
    var contract = meta.contract ? String(meta.contract) : "";
    var tokenId = meta.tokenId != null ? String(meta.tokenId) : "";
    if (!contract || tokenId === "") {
      return (
        '<div class="nft-thumb__counterpart-visual nft-thumb__counterpart-visual--empty">' +
        '<span class="nft-thumb-fallback">No preview</span></div>'
      );
    }
    var idx =
      typeof meta.imageIndex === "number" ? String(meta.imageIndex) : "0";
    var altPart = meta.alt ? String(meta.alt) : "NFT";
    var slugShell = resolveCollectionSlugForCache(meta);
    var dataColShell = slugShell
      ? ' data-nft-collection="' + escapeHtmlAttr(slugShell) + '"'
      : "";
    var dataExtShell =
      meta.isExternalMatch === true ? ' data-nft-external-match="1"' : "";
    return (
      '<div class="nft-thumb__counterpart-visual nft-thumb__counterpart-visual--empty nft-thumb__counterpart-visual--metadata-fetch"' +
      ' data-nft-contract="' +
      escapeHtmlAttr(contract) +
      '" data-nft-token-id="' +
      escapeHtmlAttr(tokenId) +
      '"' +
      dataColShell +
      dataExtShell +
      ' data-nft-image-index="' +
      escapeHtmlAttr(idx) +
      '" data-nft-alt="' +
      escapeHtmlAttr(altPart) +
      '">' +
      '<span class="nft-thumb-fallback__msg">No preview</span>' +
      '<button type="button" class="nft-thumb__retry nft-thumb__retry--metadata">Load preview</button>' +
      "</div>"
    );
  }

  function metadataRetryFetch(contract, tokenId) {
    return fetch(
      apiUrl(
        "/api/nft-metadata?contract=" +
          encodeURIComponent(contract) +
          "&tokenId=" +
          encodeURIComponent(tokenId)
      )
    ).then(function (r) {
      return r.ok ? r.json() : null;
    });
  }

  function metadataRetryMainThumb(shell, btn) {
    var contract = shell.getAttribute("data-nft-contract");
    var tokenId = shell.getAttribute("data-nft-token-id");
    if (!contract || tokenId == null || tokenId === "") return;
    var idx = parseInt(shell.getAttribute("data-nft-image-index") || "0", 10);
    var altStr = shell.getAttribute("data-nft-alt") || "NFT";
    btn.disabled = true;
    var prev = btn.textContent;
    btn.textContent = "Loading…";
    metadataRetryFetch(contract, tokenId)
      .then(function (j) {
        if (!j || !j.image) {
          btn.disabled = false;
          btn.textContent = prev;
          return;
        }
        var html = thumbHtml(j.image, altStr, {
          contract: contract,
          tokenId: tokenId,
          imageIndex: idx,
        });
        var doc = typeof global.document !== "undefined" ? global.document : null;
        if (!doc) return;
        var wrap = doc.createElement("div");
        wrap.innerHTML = html;
        var nu = wrap.firstElementChild;
        if (nu) shell.replaceWith(nu);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = prev;
      });
  }

  function metadataRetryCounterpartVisual(shell, btn) {
    var contract = shell.getAttribute("data-nft-contract");
    var tokenId = shell.getAttribute("data-nft-token-id");
    if (!contract || tokenId == null || tokenId === "") return;
    var idx = parseInt(shell.getAttribute("data-nft-image-index") || "0", 10);
    var altStr = shell.getAttribute("data-nft-alt") || "NFT";
    var colShell = shell.getAttribute("data-nft-collection");
    btn.disabled = true;
    var prev = btn.textContent;
    btn.textContent = "Loading…";
    metadataRetryFetch(contract, tokenId)
      .then(function (j) {
        if (!j || !j.image) {
          btn.disabled = false;
          btn.textContent = prev;
          return;
        }
        var html = counterpartThumbHtml(j.image, altStr, {
          contract: contract,
          tokenId: tokenId,
          imageIndex: idx,
          collection: colShell || undefined,
          isExternalMatch: true,
        });
        var doc = typeof global.document !== "undefined" ? global.document : null;
        if (!doc) return;
        var wrap = doc.createElement("div");
        wrap.innerHTML = html;
        var nu = wrap.firstElementChild;
        if (nu) shell.replaceWith(nu);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = prev;
      });
  }

  function thumbHtml(url, alt, meta) {
    meta = meta || {};
    var altStr =
      alt != null && String(alt).trim() !== ""
        ? String(alt)
        : meta.alt
          ? String(meta.alt)
          : "NFT";
    meta.alt = altStr;
    if (!url) {
      return mainThumbFetchShellHtml(meta);
    }
    var b = buildImageCandidates(String(url), meta);
    if (!b.candidates.length) {
      return mainThumbFetchShellHtml(meta);
    }
    var idx = typeof meta.imageIndex === "number" ? meta.imageIndex : 0;
    var eager = idx < FIRST_EAGER_COUNT;
    var loadingAttr = eager ? ' loading="eager"' : ' loading="lazy"';
    var fetchPri = eager ? ' fetchpriority="high"' : "";
    var enc = encodeURIComponent(JSON.stringify(b.candidates));
    var contract = meta.contract ? String(meta.contract) : "";
    var tokenId = meta.tokenId != null ? String(meta.tokenId) : "";
    var dataContract = contract
      ? ' data-nft-contract="' + escapeHtmlAttr(contract) + '"'
      : "";
    var dataToken = tokenId
      ? ' data-nft-token-id="' + escapeHtmlAttr(tokenId) + '"'
      : "";
    var slugForAttr = resolveCollectionSlugForCache(meta);
    var dataPath = b.ipfsPath
      ? ' data-nft-ipfs-path="' + escapeHtmlAttr(b.ipfsPath) + '"'
      : "";
    var dataCol = slugForAttr
      ? ' data-nft-collection="' + escapeHtmlAttr(slugForAttr) + '"'
      : "";

    return (
      '<div class="nft-thumb">' +
      '<span class="nft-thumb__loading" aria-hidden="true"></span>' +
      '<img src="' +
      escapeHtmlAttr(b.candidates[0]) +
      '" alt="' +
      escapeHtmlAttr(altStr) +
      '"' +
      loadingAttr +
      fetchPri +
      ' decoding="async" referrerpolicy="no-referrer"' +
      ' data-nft-c="' +
      escapeHtmlAttr(enc) +
      '" data-nft-ci="0"' +
      dataContract +
      dataToken +
      dataPath +
      dataCol +
      ' onload="window.__nftImgLoad(this)" onerror="window.__nftImgErr(this)" />' +
      '<div class="nft-thumb-fallback" aria-hidden="true">' +
      '<span class="nft-thumb-fallback__msg">No image</span>' +
      '<button type="button" class="nft-thumb__retry">Retry</button>' +
      "</div>" +
      "</div>"
    );
  }

  function counterpartThumbHtml(url, alt, meta) {
    meta = meta || {};
    var altStr =
      alt != null && String(alt).trim() !== ""
        ? String(alt)
        : meta.alt
          ? String(meta.alt)
          : "NFT";
    meta.alt = altStr;
    if (!url) {
      if (meta.isExternalMatch === true) {
        debugExternalMatch("no initial image URL — metadata shell", {
          owned: "0",
          collection: meta.collection,
          tokenId: meta.tokenId,
          metadataResolved: "0",
          candidateUrlsCount: 0,
        });
      }
      return counterpartFetchShellHtml(meta);
    }
    var b = buildImageCandidates(String(url), meta);
    if (!b.candidates.length) {
      if (meta.isExternalMatch === true) {
        debugExternalMatch("empty candidates from URL — metadata shell", {
          owned: "0",
          collection: meta.collection,
          tokenId: meta.tokenId,
          metadataResolved: "partial",
          candidateUrlsCount: 0,
        });
      }
      return counterpartFetchShellHtml(meta);
    }
    var idx = typeof meta.imageIndex === "number" ? meta.imageIndex : 0;
    var eager = idx < FIRST_EAGER_COUNT;
    var loadingAttr = eager ? ' loading="eager"' : ' loading="lazy"';
    var fetchPri = eager ? ' fetchpriority="high"' : "";
    var enc = encodeURIComponent(JSON.stringify(b.candidates));
    var contract = meta.contract ? String(meta.contract) : "";
    var tokenId = meta.tokenId != null ? String(meta.tokenId) : "";
    var dataContract = contract
      ? ' data-nft-contract="' + escapeHtmlAttr(contract) + '"'
      : "";
    var dataToken = tokenId
      ? ' data-nft-token-id="' + escapeHtmlAttr(tokenId) + '"'
      : "";
    var slugForAttrC = resolveCollectionSlugForCache(meta);
    var dataPathC = b.ipfsPath
      ? ' data-nft-ipfs-path="' + escapeHtmlAttr(b.ipfsPath) + '"'
      : "";
    var dataColC = slugForAttrC
      ? ' data-nft-collection="' + escapeHtmlAttr(slugForAttrC) + '"'
      : "";
    var dataExtMatch =
      meta.isExternalMatch === true ? ' data-nft-external-match="1"' : "";
    if (meta.isExternalMatch === true) {
      debugExternalMatch("initial bind", {
        owned: "0",
        collection: slugForAttrC || meta.collection,
        tokenId: tokenId,
        metadataResolved: url ? "worker-or-api-image-field" : "0",
        candidateUrlsCount: b.candidates.length,
      });
    }
    return (
      '<div class="nft-thumb__counterpart-visual">' +
      '<span class="nft-thumb__loading" aria-hidden="true"></span>' +
      '<img class="nft-thumb__counterpart-img" src="' +
      escapeHtmlAttr(b.candidates[0]) +
      '" alt="' +
      escapeHtmlAttr(altStr) +
      '"' +
      loadingAttr +
      fetchPri +
      ' decoding="async" referrerpolicy="no-referrer"' +
      ' data-nft-c="' +
      escapeHtmlAttr(enc) +
      '" data-nft-ci="0"' +
      dataContract +
      dataToken +
      dataPathC +
      dataColC +
      dataExtMatch +
      ' onload="window.__nftImgLoad(this)" onerror="window.__nftImgErr(this)" />' +
      '<div class="nft-thumb-fallback" aria-hidden="true">' +
      '<span class="nft-thumb-fallback__msg">No image</span>' +
      '<button type="button" class="nft-thumb__retry">Retry</button>' +
      "</div>" +
      "</div>"
    );
  }

  global.__nftImgLoad = onImgLoad;
  global.__nftImgErr = onImgError;
  global.__nftImgRetry = retryNftImage;

  if (typeof global.document !== "undefined") {
    global.document.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".nft-thumb__retry");
      if (!btn) return;
      ev.preventDefault();
      if (btn.classList.contains("nft-thumb__retry--slot-action")) {
        var card = btn.closest(".nft-thumb--counterpart");
        if (!card) return;
        var metaShell = card.querySelector(
          ".nft-thumb__counterpart-visual--metadata-fetch"
        );
        if (metaShell) {
          var mb = metaShell.querySelector(".nft-thumb__retry--metadata");
          if (mb && !mb.disabled) {
            metadataRetryCounterpartVisual(metaShell, mb);
          }
          return;
        }
        var cim = card.querySelector(".nft-thumb__counterpart-img");
        if (cim) {
          retryNftImage(cim);
          return;
        }
        return;
      }
      if (btn.classList.contains("nft-thumb__retry--metadata")) {
        var mainShell = btn.closest(".nft-thumb--metadata-fetch");
        if (mainShell) {
          metadataRetryMainThumb(mainShell, btn);
          return;
        }
        var cShell = btn.closest(
          ".nft-thumb__counterpart-visual--metadata-fetch"
        );
        if (cShell) {
          metadataRetryCounterpartVisual(cShell, btn);
          return;
        }
      }
      var wrap =
        btn.closest(".nft-thumb") ||
        btn.closest(".nft-thumb__counterpart-visual") ||
        btn.closest(".quirks-tile");
      if (!wrap) return;
      if (wrap.classList.contains("quirks-tile")) {
        var multi = wrap.querySelectorAll("img.quirks-tile__img");
        var mi;
        for (mi = 0; mi < multi.length; mi++) {
          if (nftImgNeedsRetry(multi[mi])) {
            retryNftImage(multi[mi]);
          }
        }
        return;
      }
      var im = wrap.querySelector("img");
      if (!im) return;
      retryNftImage(im);
    });
  }

  async function loadNFTImage(nft) {
    nft = nft || {};
    var meta = {
      contract: nft.contract,
      tokenId: nft.tokenId,
      collection: nft.collection,
    };
    var slug = resolveCollectionSlugForCache(meta);
    var tid = canonicalTokenIdStr(nft.tokenId);
    var inflightKey =
      slug && tid ? "L:" + smartNftImageLsKey(slug, tid) : null;
    if (inflightKey && inflightLoadNftByKey.has(inflightKey)) {
      return await inflightLoadNftByKey.get(inflightKey);
    }
    var raw = nft.image || nft.rawImage || nft.imageUrl || "";
    var contract = nft.contract;
    var tokenId = nft.tokenId;

    var task = (async function () {
      if (slug && tid) {
        var sh = smartNftImageGet(slug, tid);
        if (sh && !isPlaceholderUrl(sh)) {
          return { url: normalizeApiImgUrl(sh), fromCache: true };
        }
      }
      if (contract && tokenId != null && String(tokenId).trim() !== "") {
        var hit = nftCacheGet(contract, tokenId);
        if (hit && !isPlaceholderUrl(hit)) {
          var hn = normalizeApiImgUrl(hit);
          if (slug && tid) smartNftImageSet(slug, tid, hn);
          return { url: hn, fromCache: true };
        }
      }
      var b = buildImageCandidates(String(raw), meta);
      if (!b.candidates.length) {
        return { url: null, fromCache: false };
      }
      for (var i = 0; i < b.candidates.length; i++) {
        var url = b.candidates[i];
        var ok = await probeUrlWithTimeout(url, IMG_PROBE_TIMEOUT_MS);
        if (ok) {
          var nu = normalizeApiImgUrl(url);
          if (slug && tid) smartNftImageSet(slug, tid, nu);
          if (contract && tokenId != null && String(tokenId).trim() !== "") {
            nftCacheSet(contract, tokenId, nu);
          }
          var path = extractIpfsPath(nu);
          if (path) cacheSet(path, nu);
          return { url: nu, fromCache: false };
        }
      }
      return { url: null, fromCache: false };
    })();

    if (inflightKey) {
      inflightLoadNftByKey.set(inflightKey, task);
      task.finally(function () {
        inflightLoadNftByKey.delete(inflightKey);
      });
    }
    return task;
  }

  function applyToGridImg(img, rawUrl, tileIndex, r2Meta, options) {
    if (!img) return;
    options = options || {};
    var b;
    if (options.candidates && options.candidates.length) {
      b = {
        candidates: options.candidates.slice(),
        ipfsPath:
          options.ipfsPath != null && options.ipfsPath !== ""
            ? options.ipfsPath
            : extractIpfsPath(String(options.candidates[0] || "")),
      };
    } else {
      b = buildImageCandidates(String(rawUrl || ""), r2Meta || {});
    }
    if (!b.candidates.length) return;
    var ti = typeof tileIndex === "number" ? tileIndex : 0;
    var eager = ti < FIRST_EAGER_COUNT;
    img.loading = eager ? "eager" : "lazy";
    if (eager && "fetchPriority" in img) {
      try {
        img.fetchPriority = "high";
      } catch (e) {
        /* ignore */
      }
    }
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.setAttribute(
      "data-nft-c",
      encodeURIComponent(JSON.stringify(b.candidates))
    );
    img.setAttribute("data-nft-ci", "0");
    if (b.ipfsPath) {
      img.setAttribute("data-nft-ipfs-path", b.ipfsPath);
    }
    var sGrid = resolveCollectionSlugForCache(r2Meta || {});
    if (sGrid) {
      img.setAttribute("data-nft-collection", sGrid);
    }
    if (r2Meta && r2Meta.contract) {
      img.setAttribute("data-nft-contract", String(r2Meta.contract));
    }
    if (r2Meta && r2Meta.tokenId != null) {
      img.setAttribute("data-nft-token-id", String(r2Meta.tokenId));
    }
    img.onload = function () {
      onImgLoad(img);
    };
    img.onerror = function () {
      onImgError(img);
    };
    img.src = b.candidates[0];
  }

  global.NftImageLoader = {
    apiUrl: apiUrl,
    normalizeApiImgUrl: normalizeApiImgUrl,
    buildImageCandidates: buildImageCandidates,
    extractIpfsPath: extractIpfsPath,
    thumbHtml: thumbHtml,
    counterpartThumbHtml: counterpartThumbHtml,
    counterpartFetchShellHtml: counterpartFetchShellHtml,
    applyToGridImg: applyToGridImg,
    retryNftImage: retryNftImage,
    retryAllMissingNftImages: retryAllMissingNftImages,
    loadNFTImage: loadNFTImage,
    nftCacheGet: nftCacheGet,
    nftCacheSet: nftCacheSet,
    smartNftImageGet: smartNftImageGet,
    smartNftImageSet: smartNftImageSet,
    resolveCollectionSlugForCache: resolveCollectionSlugForCache,
    canonicalTokenIdStr: canonicalTokenIdStr,
    IMG_PROBE_TIMEOUT_MS: IMG_PROBE_TIMEOUT_MS,
    NFT_PLACEHOLDER_SVG: NFT_PLACEHOLDER_SVG,
    FIRST_EAGER_COUNT: FIRST_EAGER_COUNT,
    GATEWAY_BASES: GATEWAY_BASES,
  };
})(typeof window !== "undefined" ? window : globalThis);
