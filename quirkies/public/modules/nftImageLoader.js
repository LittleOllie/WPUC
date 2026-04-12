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
  var FIRST_EAGER_COUNT = 20;

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

  function proxify(u) {
    if (!u || typeof u !== "string") return u;
    var s = u.trim();
    if (!s) return s;
    if (s.indexOf("/api/img") === 0) {
      return apiUrl(s);
    }
    try {
      var parsed = new URL(s);
      if (
        parsed.pathname === "/api/img" &&
        parsed.search.indexOf("url=") !== -1
      ) {
        return s;
      }
    } catch (e) {
      /* not absolute */
    }
    return apiUrl("/api/img?url=" + encodeURIComponent(s));
  }

  function extractIpfsPath(u) {
    if (!u) return null;
    var s = String(u);
    try {
      if (s.indexOf("/api/img") === 0) {
        var qi = s.indexOf("url=");
        if (qi !== -1) {
          var rest = s.slice(qi + 4);
          var amp = rest.indexOf("&");
          if (amp !== -1) rest = rest.slice(0, amp);
          var inner = decodeURIComponent(rest);
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

  function buildProxyCandidatesForPath(ipfsPath) {
    var out = [];
    for (var i = 0; i < GATEWAY_BASES.length; i++) {
      out.push(proxify(GATEWAY_BASES[i] + ipfsPath));
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

  function buildImageCandidates(raw) {
    var primary = normalizeMediaUrl(raw);
    if (!primary) return { primary: null, candidates: [] };
    var path = extractIpfsPath(primary);
    var list;
    if (path) {
      list = buildProxyCandidatesForPath(path);
      var hit = cacheGet(path);
      if (hit && list.indexOf(hit) === -1) {
        list = [hit].concat(list);
      } else if (hit) {
        list = [hit].concat(list.filter(function (x) {
          return x !== hit;
        }));
      }
    } else {
      list = [proxify(primary) === primary ? primary : proxify(primary)];
      list = dedupeStrings(list);
    }
    list = dedupeStrings(list);
    return { primary: list[0] || null, candidates: list };
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

  function onImgLoad(img) {
    var root = findLoaderRoot(img);
    if (root && root.classList) root.classList.add("is-loaded");
    var path = extractIpfsPath(img.src);
    if (path) cacheSet(path, img.src);
  }

  function onImgError(img) {
    if (!img) return;
    var raw = img.getAttribute("data-nft-c");
    if (!raw) {
      failThumb(img);
      return;
    }
    var list;
    try {
      list = JSON.parse(decodeURIComponent(raw));
    } catch (e) {
      failThumb(img);
      return;
    }
    if (!Array.isArray(list)) {
      failThumb(img);
      return;
    }
    var idx = parseInt(img.getAttribute("data-nft-ci") || "0", 10);
    if (idx + 1 < list.length) {
      img.setAttribute("data-nft-ci", String(idx + 1));
      img.src = list[idx + 1];
      return;
    }
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
            failThumb(img);
            return;
          }
          var b = buildImageCandidates(j.image);
          if (!b.candidates.length) {
            failThumb(img);
            return;
          }
          img.setAttribute(
            "data-nft-c",
            encodeURIComponent(JSON.stringify(b.candidates))
          );
          img.setAttribute("data-nft-ci", "0");
          img.src = b.candidates[0];
        })
        .catch(function () {
          failThumb(img);
        });
      return;
    }
    failThumb(img);
  }

  function failThumb(img) {
    img.classList.add("is-broken");
    var root = findLoaderRoot(img);
    if (root && root.classList) {
      root.classList.add("is-broken");
      root.classList.add("is-loaded");
    }
  }

  function thumbHtml(url, alt, meta) {
    meta = meta || {};
    if (!url) {
      return (
        '<div class="nft-thumb nft-thumb--empty"><span class="nft-thumb-fallback">No image</span></div>'
      );
    }
    var b = buildImageCandidates(String(url));
    if (!b.candidates.length) {
      return (
        '<div class="nft-thumb nft-thumb--empty"><span class="nft-thumb-fallback">No image</span></div>'
      );
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

    return (
      '<div class="nft-thumb">' +
      '<span class="nft-thumb__loading" aria-hidden="true"></span>' +
      '<img src="' +
      escapeHtmlAttr(b.candidates[0]) +
      '" alt="' +
      escapeHtmlAttr(alt || "NFT") +
      '"' +
      loadingAttr +
      fetchPri +
      ' decoding="async" referrerpolicy="no-referrer"' +
      ' data-nft-c="' +
      escapeHtmlAttr(enc) +
      '" data-nft-ci="0"' +
      dataContract +
      dataToken +
      ' onload="window.__nftImgLoad(this)" onerror="window.__nftImgErr(this)" />' +
      '<div class="nft-thumb-fallback" aria-hidden="true">No image</div>' +
      "</div>"
    );
  }

  function counterpartThumbHtml(url, alt, meta) {
    meta = meta || {};
    if (!url) {
      return (
        '<div class="nft-thumb__counterpart-visual nft-thumb__counterpart-visual--empty">' +
        '<span class="nft-thumb-fallback">No preview</span></div>'
      );
    }
    var b = buildImageCandidates(String(url));
    if (!b.candidates.length) {
      return (
        '<div class="nft-thumb__counterpart-visual nft-thumb__counterpart-visual--empty">' +
        '<span class="nft-thumb-fallback">No preview</span></div>'
      );
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
    return (
      '<div class="nft-thumb__counterpart-visual">' +
      '<span class="nft-thumb__loading" aria-hidden="true"></span>' +
      '<img class="nft-thumb__counterpart-img" src="' +
      escapeHtmlAttr(b.candidates[0]) +
      '" alt="' +
      escapeHtmlAttr(alt || "NFT") +
      '"' +
      loadingAttr +
      fetchPri +
      ' decoding="async" referrerpolicy="no-referrer"' +
      ' data-nft-c="' +
      escapeHtmlAttr(enc) +
      '" data-nft-ci="0"' +
      dataContract +
      dataToken +
      ' onload="window.__nftImgLoad(this)" onerror="window.__nftImgErr(this)" />' +
      '<div class="nft-thumb-fallback" aria-hidden="true">No image</div>' +
      "</div>"
    );
  }

  global.__nftImgLoad = onImgLoad;
  global.__nftImgErr = onImgError;

  function applyToGridImg(img, rawUrl, tileIndex) {
    if (!img) return;
    var b = buildImageCandidates(String(rawUrl || ""));
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
    buildImageCandidates: buildImageCandidates,
    extractIpfsPath: extractIpfsPath,
    thumbHtml: thumbHtml,
    counterpartThumbHtml: counterpartThumbHtml,
    applyToGridImg: applyToGridImg,
    FIRST_EAGER_COUNT: FIRST_EAGER_COUNT,
    GATEWAY_BASES: GATEWAY_BASES,
  };
})(typeof window !== "undefined" ? window : globalThis);
