/**
 * OGENIE × CERT Set Checker V2
 */
const WORKER_ORIGIN = "https://ogenie-cert-checker.littleollienft.workers.dev";

function getApiBase() {
  var loc = window.location;
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
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin.replace(/\/$/, "") + pathAndQuery;
  }
  return pathAndQuery;
}

/**
 * CERT collection uses one shared artwork for every token — use this for “missing CERT” previews
 * instead of fetching per-token metadata. Resolves correctly on the deployed Worker, localhost, or file://.
 */
function getMissingCertCounterpartImageUrl() {
  return apiUrl("/cert.png");
}

function shortAddress(addr) {
  if (!addr || typeof addr !== "string") return "—";
  var a = addr.trim();
  if (a.length < 12) return a;
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function formatTokenId(t) {
  if (t === undefined || t === null) return "—";
  return String(t);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function setStatus(el, type, message) {
  el.className = "status" + (type ? " " + type : "");
  el.textContent = message || "";
}

function setGlobalLoading(on) {
  var el = document.getElementById("global-loading");
  if (!el) return;
  if (on) {
    el.classList.add("is-active");
    el.setAttribute("aria-busy", "true");
    el.setAttribute("aria-label", "Loading");
    el.removeAttribute("aria-hidden");
  } else {
    el.classList.remove("is-active");
    el.removeAttribute("aria-busy");
    el.removeAttribute("aria-label");
    el.setAttribute("aria-hidden", "true");
  }
}

var WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

/** Shown once per browser (localStorage); sessionStorage fallback if storage is blocked. */
var WELCOME_SEEN_KEY = "ogt-cert-checker-welcome-v1";

/** Last successful /api/wallet payload (for Flex Your Genies — no refetch). */
var lastWalletApiData = null;

/** Flex grid editor: { slots: (string|null)[], cols, rows } */
var flexEditorState = null;
var flexLastExportDataUrl = null;
var flexDnDFromIndex = null;

/** Upper bound for flex grid NFT count (brand tile + this many collection cells max). */
var FLEX_MAX_NFT_TILES = 100000;
/**
 * Desktop export normally preloads all unique art in parallel for speed. Above this count, draw one cell at a time so large grids (e.g. 800+) do not run out of memory.
 */
var FLEX_DESKTOP_EXPORT_PARALLEL_UNIQUE_CAP = 80;
var FLEX_CANVAS_SIZE_FALLBACK = 4096;
/** Mobile Safari kills tabs under memory pressure; cap canvas + never hold all decoded NFTs at once. */
var FLEX_MOBILE_EXPORT_MAX = 2048;
/** Export resolution (square). 8192 = max sharpness for print/social; falls back if canvas cap hit. */
var FLEX_CANVAS_SIZE = 8192;
/** Same as --og-lime / ogtriple wordmark yellow. */
var FLEX_BRAND_CELL_BG = "#dfff00";
/** Max fraction of brand cell height for the pblo band — matches `.flex-tile__brand-stack` max-height in CSS. */
var FLEX_BRAND_PBLO_MAX_FRAC = 0.52;
/** JPEG export: high visual quality, much smaller than PNG at8k. */
var FLEX_EXPORT_JPEG_QUALITY = 0.94;

function isValidWallet(s) {
  return typeof s === "string" && WALLET_RE.test(s.trim());
}

/** Split textarea / pasted list into unique valid 0x addresses (max 12). */
function parseWalletAddressesFromInput(raw) {
  var s = String(raw || "").trim();
  if (!s) return [];
  var parts = s.split(/[\s,;]+/g);
  var out = [];
  var seen = {};
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (!p) continue;
    if (!isValidWallet(p)) continue;
    var low = p.toLowerCase();
    if (seen[low]) continue;
    seen[low] = true;
    out.push(p);
    if (out.length >= 12) break;
  }
  return out;
}

/** Normalize API item: `{ tokenId, image, traits }` or legacy numeric id. */
function normalizeWalletNftEntry(x) {
  if (x && typeof x === "object" && "tokenId" in x) {
    return {
      tokenId: x.tokenId,
      image: x.image || null,
      traits: Array.isArray(x.traits) ? x.traits : [],
    };
  }
  return { tokenId: x, image: null, traits: [] };
}

function normalizeWalletNftList(arr) {
  var out = [];
  var i;
  for (i = 0; i < (arr || []).length; i++) {
    out.push(normalizeWalletNftEntry(arr[i]));
  }
  return out;
}

function sortWalletNftEntries(entries) {
  return entries.slice().sort(function (a, b) {
    try {
      var ba = BigInt(String(a.tokenId));
      var bb = BigInt(String(b.tokenId));
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    } catch {
      return String(a.tokenId).localeCompare(String(b.tokenId));
    }
  });
}

function hideFlexActions() {
  lastWalletApiData = null;
}

function flexSyncGenerateButtonState() {
  var co = document.getElementById("flex-opt-ogenies");
  var cc = document.getElementById("flex-opt-certs");
  var gen = document.getElementById("flex-generate-btn");
  if (!gen) return;
  var on = !!(co && co.checked) || !!(cc && cc.checked);
  gen.disabled = !on;
}

function flexSetDownloadButtonReady(ready) {
  var dl = document.getElementById("flex-download-btn");
  if (!dl) return;
  if (ready) {
    dl.classList.remove("hidden");
    dl.disabled = false;
  } else {
    dl.classList.add("hidden");
    dl.disabled = true;
  }
}

function flexWaitForPreviewGridImages() {
  return new Promise(function (resolve) {
    var grid = document.getElementById("flex-preview-grid");
    if (!grid) {
      resolve();
      return;
    }
    var imgs = grid.querySelectorAll("img.flex-tile__img");
    if (imgs.length === 0) {
      resolve();
      return;
    }
    var pending = [];
    var i;
    var im;
    for (i = 0; i < imgs.length; i++) {
      im = imgs[i];
      if (im.getAttribute("data-flex-src")) continue;
      pending.push(im);
    }
    var n = pending.length;
    if (n === 0) {
      resolve();
      return;
    }
    var left = n;
    function oneDone() {
      left--;
      if (left <= 0) resolve();
    }
    for (i = 0; i < n; i++) {
      im = pending[i];
      if (im.complete && im.src) oneDone();
      else {
        im.addEventListener("load", oneDone, { once: true });
        im.addEventListener("error", oneDone, { once: true });
      }
    }
  });
}

function openFlexModal() {
  if (!lastWalletApiData) return;
  resetFlexModalOutput();
  populateFlexTraitSelect();
  var co = document.getElementById("flex-opt-ogenies");
  var cc = document.getElementById("flex-opt-certs");
  if (co) co.checked = false;
  if (cc) cc.checked = false;
  flexSyncGenerateButtonState();
  setFlexModalOpen(true);
}

/** Artwork under pblo in the flex grid preview + JPEG export (not the site header logo). */
function getFlexGridBrandImageUrl() {
  try {
    return new URL("ogtriplegrid.png", window.location.href).href;
  } catch {
    return "ogtriplegrid.png";
  }
}

function getFlexPbloImageUrl() {
  try {
    return new URL("pblo.png", window.location.href).href;
  } catch {
    return "pblo.png";
  }
}

/** OGENIE block then CERT block; capped. Each item has image + traits for sorting. */
function collectFlexItems(data, wantOgenies, wantCerts) {
  var out = [];
  if (wantOgenies) {
    normalizeWalletNftList(data.ogenies).forEach(function (e) {
      if (e.image) {
        out.push({
          tokenId: e.tokenId,
          image: String(e.image),
          traits: e.traits || [],
          kind: "ogenie",
        });
      }
    });
  }
  if (wantCerts) {
    normalizeWalletNftList(data.certs).forEach(function (e) {
      if (e.image) {
        out.push({
          tokenId: e.tokenId,
          image: String(e.image),
          traits: e.traits || [],
          kind: "cert",
        });
      }
    });
  }
  return out.slice(0, FLEX_MAX_NFT_TILES);
}

function collectTraitTypesFromItems(items) {
  var seen = {};
  var list = [];
  var i;
  var j;
  for (i = 0; i < items.length; i++) {
    var traits = items[i].traits || [];
    for (j = 0; j < traits.length; j++) {
      var tt = traits[j].trait_type || traits[j].traitType;
      if (tt && !seen[tt]) {
        seen[tt] = true;
        list.push(String(tt));
      }
    }
  }
  list.sort(function (a, b) {
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return list;
}

/** Display label: first character uppercase, rest lowercase (metadata keys stay raw in option value). */
function flexFormatTraitLabel(raw) {
  if (raw == null || typeof raw !== "string") return "";
  var s = raw.trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Trait type names from OGENIE + CERT metadata in the wallet (Background, Clothing, etc.). */
function populateFlexTraitSelect() {
  var sel = document.getElementById("flex-trait-sort");
  if (!sel || !lastWalletApiData) return;
  var og = normalizeWalletNftList(lastWalletApiData.ogenies);
  var ce = normalizeWalletNftList(lastWalletApiData.certs);
  var types = collectTraitTypesFromItems(og.concat(ce));
  var keep = sel.value;
  sel.innerHTML = "";
  var randOpt = document.createElement("option");
  randOpt.value = "random";
  randOpt.textContent = "Random order";
  sel.appendChild(randOpt);
  var t;
  for (t = 0; t < types.length; t++) {
    var o = document.createElement("option");
    o.value = "trait:" + types[t];
    o.textContent = flexFormatTraitLabel(types[t]);
    sel.appendChild(o);
  }
  var ok = false;
  for (t = 0; t < sel.options.length; t++) {
    if (sel.options[t].value === keep) {
      ok = true;
      break;
    }
  }
  sel.value = ok ? keep : "random";
}

function flexTraitValue(traits, traitType) {
  if (!traits || !traitType) return "";
  var j;
  for (j = 0; j < traits.length; j++) {
    var tt = traits[j].trait_type || traits[j].traitType;
    if (tt === traitType) {
      var v = traits[j].value;
      return v != null ? String(v) : "";
    }
  }
  return "";
}

/** Sort value for a flex row: item traits, or same-token OGENIE traits for CERTs. */
function flexTraitValueForSort(item, traitKey, walletData) {
  var v = flexTraitValue(item.traits, traitKey);
  if (v !== "") return v;
  if (item.kind === "cert" && walletData && walletData.ogenies) {
    var ogs = normalizeWalletNftList(walletData.ogenies);
    var ti;
    for (ti = 0; ti < ogs.length; ti++) {
      if (String(ogs[ti].tokenId) === String(item.tokenId)) {
        return flexTraitValue(ogs[ti].traits, traitKey);
      }
    }
  }
  return "";
}

function flexCompareTokenId(a, b) {
  try {
    var ba = BigInt(String(a.tokenId));
    var bb = BigInt(String(b.tokenId));
    if (ba < bb) return -1;
    if (ba > bb) return 1;
    return 0;
  } catch {
    return String(a.tokenId).localeCompare(String(b.tokenId));
  }
}

/** OGENIEs always before CERTs when both are in the flex list. */
function flexCompareKind(a, b) {
  var oa = a.kind === "ogenie" ? 0 : 1;
  var ob = b.kind === "ogenie" ? 0 : 1;
  if (oa < ob) return -1;
  if (oa > ob) return 1;
  return 0;
}

function flexShuffleInPlace(arr) {
  var i, j, tmp;
  for (i = arr.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Shuffle within OGENIEs and within CERTs, then concatenate (OGENIE block first). */
function flexShufflePreserveKind(items) {
  var ogs = [];
  var certs = [];
  var ii;
  for (ii = 0; ii < items.length; ii++) {
    if (items[ii].kind === "ogenie") ogs.push(items[ii]);
    else certs.push(items[ii]);
  }
  flexShuffleInPlace(ogs);
  flexShuffleInPlace(certs);
  return ogs.concat(certs);
}

function flexSortOrShuffle(items, sortKey, walletData) {
  if (!sortKey || sortKey === "random") {
    return flexShufflePreserveKind(items);
  }
  if (sortKey.indexOf("trait:") === 0) {
    return applyFlexSort(items, sortKey, walletData);
  }
  return flexShufflePreserveKind(items);
}

function applyFlexSort(items, sortKey, walletData) {
  var copy = items.slice();
  if (!sortKey || sortKey.indexOf("trait:") !== 0) {
    return copy.sort(function (a, b) {
      var kc = flexCompareKind(a, b);
      if (kc !== 0) return kc;
      return flexCompareTokenId(a, b);
    });
  }
  var key = sortKey.slice(6);
  return copy.sort(function (a, b) {
    var kc = flexCompareKind(a, b);
    if (kc !== 0) return kc;
    var va = flexTraitValueForSort(a, key, walletData);
    var vb = flexTraitValueForSort(b, key, walletData);
    var cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return flexCompareTokenId(a, b);
  });
}

function rebuildFlexSlotsFromSortedNfts(sortedItems) {
  var brand = getFlexGridBrandImageUrl();
  var urls = [brand].concat(
    sortedItems.map(function (x) {
      return x.image;
    })
  );
  var g = flexComputeGrid(urls.length);
  var cells = g.cols * g.rows;
  var slots = [];
  var i;
  for (i = 0; i < cells; i++) {
    slots.push(i < urls.length ? urls[i] : null);
  }
  flexEditorState = { slots: slots, cols: g.cols, rows: g.rows };
}

function flexLoadImageWithFallbacks(rawUrl) {
  return new Promise(function (resolve) {
    if (!rawUrl) {
      resolve(null);
      return;
    }
    var c = buildImageCandidates(String(rawUrl));
    var tryList = [];
    if (c.primary) tryList.push(c.primary);
    var fi;
    for (fi = 0; fi < c.fallbacks.length; fi++) {
      tryList.push(c.fallbacks[fi]);
    }
    var idx = 0;
    function tryNext() {
      if (idx >= tryList.length) {
        resolve(null);
        return;
      }
      var u = tryList[idx++];
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        tryNext();
      };
      img.src = u;
    }
    tryNext();
  });
}

/** ~1% larger, centered — removes faint seams between cells in downloaded grid. */
function flexExportCellRect(x, y, w, h) {
  var bleed = 0.01;
  var ox = w * (bleed / 2);
  var oy = h * (bleed / 2);
  return { x: x - ox, y: y - oy, w: w * (1 + bleed), h: h * (1 + bleed) };
}

function flexDrawCover(ctx, img, x, y, w, h, cellBackdrop) {
  var backdrop = cellBackdrop || "#ffffff";
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = backdrop;
  ctx.fillRect(x, y, w, h);
  if (img && img.naturalWidth > 0) {
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var scale = Math.max(w / iw, h / ih);
    var tw = iw * scale;
    var th = ih * scale;
    ctx.drawImage(img, x + (w - tw) / 2, y + (h - th) / 2, tw, th);
  }
  ctx.restore();
}

/** Letterbox / full image inside rect (same idea as CSS object-fit: contain). */
function flexDrawContain(ctx, img, x, y, w, h, cellBackdrop) {
  var backdrop = cellBackdrop || "#ffffff";
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = backdrop;
  ctx.fillRect(x, y, w, h);
  if (img && img.naturalWidth > 0) {
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var scale = Math.min(w / iw, h / ih);
    var tw = iw * scale;
    var th = ih * scale;
    ctx.drawImage(img, x + (w - tw) / 2, y + (h - th) / 2, tw, th);
  }
  ctx.restore();
}

/** Download JPEG: ogtriplegrid fills tile (contain), pblo drawn on top (same as preview grid). */
function flexDrawBrandCellExport(ctx, ogImg, pbloImg, cellX, cellY, cw, ch) {
  var pbloCap = ch * FLEX_BRAND_PBLO_MAX_FRAC;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, cw, ch);
  ctx.clip();
  ctx.fillStyle = FLEX_BRAND_CELL_BG;
  ctx.fillRect(cellX, cellY, cw, ch);
  flexDrawContain(ctx, ogImg, cellX, cellY, cw, ch, FLEX_BRAND_CELL_BG);
  if (pbloImg && pbloImg.naturalWidth > 0) {
    var piw = pbloImg.naturalWidth;
    var pih = pbloImg.naturalHeight;
    var drawW = cw;
    var drawH = (pih / piw) * drawW;
    if (drawH > pbloCap) {
      drawH = pbloCap;
      drawW = (piw / pih) * drawH;
    }
    var px = cellX + (cw - drawW) / 2;
    ctx.drawImage(pbloImg, px, cellY, drawW, drawH);
  }
  ctx.restore();
}

function flexComputeGrid(totalCells) {
  var cols = Math.ceil(Math.sqrt(totalCells));
  var rows = Math.ceil(totalCells / cols);
  return { cols: cols, rows: rows };
}

function flexCreateExportCanvas(W, H) {
  var canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

function flexIsMemoryConstrainedDevice() {
  if (typeof navigator === "undefined") return false;
  var ua = navigator.userAgent || "";
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  if (typeof window !== "undefined") {
    try {
      if (window.matchMedia("(max-width: 768px)").matches) return true;
    } catch (e) {
      /* ignore */
    }
  }
  return false;
}

function flexExportCanvasSizeCandidates(slotsLen) {
  var n = typeof slotsLen === "number" ? slotsLen : 0;
  if (flexIsMemoryConstrainedDevice()) {
    if (n > 49) return [1024, 896, 768];
    if (n > 36) return [1280, 1024, 896];
    if (n > 24) return [1536, 1280, 1024];
    return [FLEX_MOBILE_EXPORT_MAX, 1536, 1024];
  }
  return [FLEX_CANVAS_SIZE, FLEX_CANVAS_SIZE_FALLBACK, 2048];
}

function flexPreviewConcurrentLoads() {
  var ua = navigator.userAgent || "";
  if (/iPhone|iPod/i.test(ua)) return 1;
  return 2;
}

function flexReleaseImageElement(img) {
  if (!img) return;
  try {
    img.onload = null;
    img.onerror = null;
    img.src = "";
    img.removeAttribute("src");
  } catch (e) {
    /* ignore */
  }
}

function flexReleaseCanvasMemory(canvas) {
  if (!canvas) return;
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch (e) {
    /* ignore */
  }
}

/** Stagger preview <img> loads on mobile so dozens of NFTs are not decoded at once. */
function flexAwaitPreviewGridLoads(gridEl) {
  return new Promise(function (resolve) {
    if (!gridEl) {
      resolve();
      return;
    }
    if (!flexIsMemoryConstrainedDevice()) {
      resolve();
      return;
    }
    var imgs = Array.prototype.slice.call(
      gridEl.querySelectorAll("img.flex-tile__img[data-flex-src]")
    );
    var n = imgs.length;
    if (n === 0) {
      resolve();
      return;
    }
    var concurrency = flexPreviewConcurrentLoads();
    var completed = 0;
    var nextIndex = 0;
    function tryFinish() {
      completed++;
      if (completed >= n) resolve();
    }
    function launchOne() {
      if (nextIndex >= n) return;
      var img = imgs[nextIndex++];
      var u = img.getAttribute("data-flex-src");
      img.removeAttribute("data-flex-src");
      img.addEventListener(
        "load",
        function () {
          tryFinish();
          launchOne();
        },
        { once: true }
      );
      img.addEventListener(
        "error",
        function () {
          tryFinish();
          launchOne();
        },
        { once: true }
      );
      img.src = u;
    }
    var initial = Math.min(concurrency, n);
    var j;
    for (j = 0; j < initial; j++) {
      launchOne();
    }
  });
}

/** Load each cell’s art, draw, then release — keeps peak memory low for huge grids. */
async function flexExportGridDrawCellsSequential(ctx, slots, cols, rows, cw, ch) {
  var cells = cols * rows;
  var i;
  var col;
  var row;
  var x;
  var y;
  var bg;
  for (i = 0; i < cells; i++) {
    col = i % cols;
    row = Math.floor(i / cols);
    x = col * cw;
    y = row * ch;
    var cellR = flexExportCellRect(x, y, cw, ch);
    var slotUrl = slots[i];
    if (i === 0) {
      var pbloM = await flexLoadImageWithFallbacks(getFlexPbloImageUrl());
      var ogM = null;
      if (slotUrl) ogM = await flexLoadImageWithFallbacks(slotUrl);
      flexDrawBrandCellExport(ctx, ogM, pbloM, cellR.x, cellR.y, cellR.w, cellR.h);
      flexReleaseImageElement(pbloM);
      flexReleaseImageElement(ogM);
    } else {
      bg = "#ffffff";
      var img = null;
      if (slotUrl) {
        img = await flexLoadImageWithFallbacks(slotUrl);
      }
      flexDrawCover(ctx, img, cellR.x, cellR.y, cellR.w, cellR.h, bg);
      flexReleaseImageElement(img);
    }
    if ((i & 3) === 3) {
      await new Promise(function (r) {
        setTimeout(r, 0);
      });
    }
  }
}

async function flexBuildGridCanvasFromSlots(slots, cols, rows) {
  var cells = cols * rows;
  var sizeTry = flexExportCanvasSizeCandidates(slots.length);
  var ti;
  var canvas = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  for (ti = 0; ti < sizeTry.length; ti++) {
    W = sizeTry[ti];
    H = sizeTry[ti];
    canvas = flexCreateExportCanvas(W, H);
    if (canvas.width !== W || canvas.height !== H) {
      canvas = null;
      continue;
    }
    ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas = null;
      continue;
    }
    break;
  }
  if (!ctx || !canvas) throw new Error("Canvas not supported.");
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
  var cw = W / cols;
  var ch = H / rows;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  var i;
  var col;
  var row;
  var x;
  var y;
  var bg;
  var seenForCap = {};
  var uniqueCount = 0;
  for (i = 0; i < slots.length; i++) {
    var uc = slots[i];
    if (uc && !seenForCap[uc]) {
      seenForCap[uc] = true;
      uniqueCount++;
    }
  }
  var useSequential =
    flexIsMemoryConstrainedDevice() ||
    uniqueCount > FLEX_DESKTOP_EXPORT_PARALLEL_UNIQUE_CAP;

  if (useSequential) {
    await flexExportGridDrawCellsSequential(ctx, slots, cols, rows, cw, ch);
  } else {
    var unique = [];
    var seen = {};
    for (i = 0; i < slots.length; i++) {
      var u = slots[i];
      if (u && !seen[u]) {
        seen[u] = true;
        unique.push(u);
      }
    }
    var loadedMap = {};
    await Promise.all(
      unique.map(function (url) {
        return flexLoadImageWithFallbacks(url).then(function (im) {
          loadedMap[url] = im;
        });
      })
    );
    var loadedSlots = [];
    for (i = 0; i < slots.length; i++) {
      var su = slots[i];
      loadedSlots.push(su ? loadedMap[su] || null : null);
    }
    var pbloD = await flexLoadImageWithFallbacks(getFlexPbloImageUrl());
    for (i = 0; i < cells; i++) {
      col = i % cols;
      row = Math.floor(i / cols);
      x = col * cw;
      y = row * ch;
      var cellR2 = flexExportCellRect(x, y, cw, ch);
      if (i === 0) {
        flexDrawBrandCellExport(
          ctx,
          loadedSlots[0] || null,
          pbloD,
          cellR2.x,
          cellR2.y,
          cellR2.w,
          cellR2.h
        );
      } else {
        bg = "#ffffff";
        flexDrawCover(ctx, loadedSlots[i] || null, cellR2.x, cellR2.y, cellR2.w, cellR2.h, bg);
      }
    }
    flexReleaseImageElement(pbloD);
  }
  return canvas;
}

function setFlexModalOpen(on) {
  var modal = document.getElementById("flex-modal");
  if (!modal) return;
  if (on) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("flex-modal-active");
  } else {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("flex-modal-active");
  }
}

function welcomeModalHasBeenSeen() {
  try {
    if (localStorage.getItem(WELCOME_SEEN_KEY) === "1") return true;
  } catch (e) {
    /* ignore */
  }
  try {
    if (sessionStorage.getItem(WELCOME_SEEN_KEY) === "1") return true;
  } catch (e2) {
    /* ignore */
  }
  return false;
}

function markWelcomeModalSeen() {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch (e) {
    /* ignore */
  }
  try {
    sessionStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch (e2) {
    /* ignore */
  }
}

function setWelcomeModalOpen(on) {
  var modal = document.getElementById("welcome-modal");
  if (!modal) return;
  if (on) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("welcome-modal-active");
    var cta = document.getElementById("welcome-modal-got-it");
    if (cta) cta.focus();
  } else {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("welcome-modal-active");
  }
}

function dismissWelcomeModal() {
  markWelcomeModalSeen();
  setWelcomeModalOpen(false);
}

function maybeShowWelcomeModal() {
  if (welcomeModalHasBeenSeen()) return;
  setWelcomeModalOpen(true);
}

/**
 * Hub lives at repo /links.html. On Cloudflare Workers (*.workers.dev) that file may not exist — use main site menu.
 */
function setupBackToMenu() {
  var a = document.querySelector(".back-to-menu");
  if (!a) return;
  try {
    var h = window.location.hostname || "";
    if (/\.workers\.dev$/i.test(h)) {
      a.href = "https://littleollielabs.com/links.html";
    }
  } catch (e) {
    /* keep default href */
  }
}

var THEME_STORAGE_KEY = "lo-labs-theme";

function setupThemeToggle() {
  var html = document.documentElement;
  var btn = document.getElementById("theme-toggle");
  function syncButton() {
    if (!btn) return;
    var t = html.getAttribute("data-theme") || "dark";
    var isLight = t === "light";
    btn.setAttribute("aria-checked", isLight ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      isLight ? "Switch to dark theme" : "Switch to light theme"
    );
  }
  function applyTheme(next) {
    if (next !== "light" && next !== "dark") next = "dark";
    html.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (e) {
      /* ignore */
    }
    syncButton();
  }
  if (btn) {
    btn.addEventListener("click", function () {
      var cur = html.getAttribute("data-theme") || "dark";
      applyTheme(cur === "dark" ? "light" : "dark");
    });
  }
  syncButton();
}

function setupWelcomeModal() {
  var modal = document.getElementById("welcome-modal");
  if (!modal) return;
  var closeBtn = document.getElementById("welcome-modal-close");
  var backdrop = document.getElementById("welcome-modal-backdrop");
  var gotIt = document.getElementById("welcome-modal-got-it");
  if (closeBtn) closeBtn.addEventListener("click", dismissWelcomeModal);
  if (backdrop) backdrop.addEventListener("click", dismissWelcomeModal);
  if (gotIt) gotIt.addEventListener("click", dismissWelcomeModal);
  var infoBtn = document.getElementById("welcome-info-btn");
  if (infoBtn) {
    infoBtn.addEventListener("click", function () {
      setWelcomeModalOpen(true);
    });
  }
  document.addEventListener(
    "keydown",
    function (ev) {
      if (ev.key !== "Escape") return;
      if (!modal.classList.contains("is-open")) return;
      ev.preventDefault();
      dismissWelcomeModal();
    },
    true
  );
  maybeShowWelcomeModal();
}

function resetFlexModalOutput() {
  var err = document.getElementById("flex-error");
  var wrap = document.getElementById("flex-preview-wrap");
  var grid = document.getElementById("flex-preview-grid");
  if (err) {
    err.textContent = "";
    err.classList.remove("is-visible");
  }
  if (wrap) wrap.classList.add("hidden");
  flexSetDownloadButtonReady(false);
  if (grid) grid.innerHTML = "";
  flexEditorState = null;
  flexLastExportDataUrl = null;
  flexDnDFromIndex = null;
}

function flexSetTileEmptyClass(cell, hasImg) {
  if (hasImg) cell.classList.remove("flex-tile--empty");
  else cell.classList.add("flex-tile--empty");
}

/**
 * Detach live preview <img> nodes keyed by slot URL so trait reorder can reparent them
 * (avoids white flash from destroying elements and reloading bitmaps).
 * Call while flexEditorState still reflects the grid before rebuildFlexSlotsFromSortedNfts.
 */
function flexHarvestPreviewDomPool() {
  var grid = document.getElementById("flex-preview-grid");
  var pool = { pblo: null, byUrl: {} };
  if (!grid || !flexEditorState || !flexEditorState.slots) return pool;
  var slots = flexEditorState.slots;
  var cells = grid.querySelectorAll(".flex-tile");
  var i;
  for (i = 0; i < cells.length; i++) {
    var cell = cells[i];
    var idx = parseInt(cell.dataset.index, 10);
    if (isNaN(idx)) continue;
    var url = slots[idx];
    if (!url) continue;
    if (idx === 0) {
      if (!pool.pblo) {
        var p = cell.querySelector(".flex-tile__brand-pblo");
        if (p && p.parentNode) {
          p.parentNode.removeChild(p);
          pool.pblo = p;
        }
      }
      var bimg = cell.querySelector(".flex-tile__img");
      if (bimg && bimg.parentNode) {
        bimg.parentNode.removeChild(bimg);
        pool.byUrl[url] = bimg;
      }
    } else {
      var img = cell.querySelector(".flex-tile__img");
      if (img && img.parentNode) {
        img.parentNode.removeChild(img);
        pool.byUrl[url] = img;
      }
    }
  }
  return pool;
}

function flexTakePooledImg(pool, url) {
  if (!pool || !pool.byUrl || !url) return null;
  var el = pool.byUrl[url];
  if (el) delete pool.byUrl[url];
  return el;
}

function flexTakePooledPblo(pool) {
  if (!pool || !pool.pblo) return null;
  var p = pool.pblo;
  pool.pblo = null;
  return p;
}

function flexDrainUnusedDomPool(pool) {
  if (!pool) return;
  if (pool.byUrl) {
    var k;
    for (k in pool.byUrl) {
      if (Object.prototype.hasOwnProperty.call(pool.byUrl, k)) {
        flexReleaseImageElement(pool.byUrl[k]);
      }
    }
    pool.byUrl = {};
  }
  if (pool.pblo) {
    flexReleaseImageElement(pool.pblo);
    pool.pblo = null;
  }
}

/** Viewport rects keyed by slot image URL (before a layout reorder). */
function flexCapturePreviewTileRectsByUrl() {
  var grid = document.getElementById("flex-preview-grid");
  var map = {};
  if (!grid || !flexEditorState || !flexEditorState.slots) return map;
  var cells = grid.querySelectorAll(".flex-tile");
  var i;
  for (i = 0; i < cells.length; i++) {
    var cell = cells[i];
    var idx = parseInt(cell.dataset.index, 10);
    if (isNaN(idx)) continue;
    var url = flexEditorState.slots[idx];
    if (!url) continue;
    map[url] = cell.getBoundingClientRect();
  }
  return map;
}

/** FLIP + stagger: same image URL glides from old cell to new; big moves lead for a fluid shuffle. */
function flexAnimatePreviewGridFlip(oldRectsByUrl) {
  var grid = document.getElementById("flex-preview-grid");
  if (!grid || !flexEditorState || !flexEditorState.slots) return;
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  if (!oldRectsByUrl || typeof oldRectsByUrl !== "object") return;
  var cells = grid.querySelectorAll(".flex-tile");
  var flipItems = [];
  var fadeIn = [];
  var i;
  for (i = 0; i < cells.length; i++) {
    var cell = cells[i];
    var idx = parseInt(cell.dataset.index, 10);
    if (isNaN(idx)) continue;
    var url = flexEditorState.slots[idx];
    if (!url) continue;
    var oldR = oldRectsByUrl[url];
    var neu = cell.getBoundingClientRect();
    if (!oldR) {
      cell.classList.add("flex-tile--shuffle-in");
      cell.style.opacity = "0";
      cell.style.transform = "scale(0.96)";
      cell.style.transition = "none";
      fadeIn.push(cell);
      continue;
    }
    var dx = oldR.left - neu.left;
    var dy = oldR.top - neu.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    flipItems.push({
      cell: cell,
      dx: dx,
      dy: dy,
      dist2: dx * dx + dy * dy,
    });
  }
  flipItems.sort(function (a, b) {
    return b.dist2 - a.dist2;
  });
  for (i = 0; i < flipItems.length; i++) {
    var it = flipItems[i];
    it.cell.style.transform =
      "translate(" + it.dx + "px, " + it.dy + "px)";
    it.cell.style.transition = "none";
    it.cell.style.transitionDelay = "";
    it.cell.classList.add("flex-tile--reordering");
  }
  void grid.offsetHeight;
  var durMs = 460;
  var staggerMs = 11;
  var maxStagger = 380;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var ease = "cubic-bezier(0.25, 0.82, 0.2, 1)";
      for (i = 0; i < flipItems.length; i++) {
        var c = flipItems[i].cell;
        var delay = Math.min(i * staggerMs, maxStagger);
        c.style.transition =
          "transform " + durMs + "ms " + ease + " " + delay + "ms";
        c.style.transform = "";
      }
      var cleaned = new WeakSet();
      function finishFlip(c) {
        if (!c || cleaned.has(c)) return;
        cleaned.add(c);
        c.style.transition = "";
        c.style.transitionDelay = "";
        c.style.transform = "";
        c.classList.remove("flex-tile--reordering");
      }
      var t;
      for (t = 0; t < flipItems.length; t++) {
        flipItems[t].cell.addEventListener(
          "transitionend",
          function (ev) {
            if (ev.propertyName !== "transform") return;
            finishFlip(ev.currentTarget);
          },
          { once: true }
        );
      }
      window.setTimeout(function () {
        for (t = 0; t < flipItems.length; t++) {
          finishFlip(flipItems[t].cell);
        }
      }, durMs + maxStagger + 80);

      if (fadeIn.length > 0) {
        requestAnimationFrame(function () {
          var fe = "cubic-bezier(0.25, 0.82, 0.35, 1)";
          var fi;
          for (fi = 0; fi < fadeIn.length; fi++) {
            var fc = fadeIn[fi];
            var fiDelay = Math.min(fi * 18, 220);
            fc.style.transition =
              "opacity 0.38s " + fe + " " + fiDelay + "ms, transform 0.42s " +
              fe +
              " " +
              fiDelay +
              "ms";
            fc.style.opacity = "1";
            fc.style.transform = "";
          }
          window.setTimeout(function () {
            for (fi = 0; fi < fadeIn.length; fi++) {
              var fcc = fadeIn[fi];
              fcc.style.transition = "";
              fcc.style.transitionDelay = "";
              fcc.classList.remove("flex-tile--shuffle-in");
            }
          }, 520);
        });
      }
    });
  });
}

/** Swap tile DOM only (keeps <img> nodes — no decode flicker on reorder). */
function flexSwapPreviewTileContents(i, j) {
  var grid = document.getElementById("flex-preview-grid");
  if (!grid || !flexEditorState) return;
  var cellI = grid.querySelector('.flex-tile[data-index="' + i + '"]');
  var cellJ = grid.querySelector('.flex-tile[data-index="' + j + '"]');
  if (!cellI || !cellJ) return;
  var imgI = cellI.querySelector(".flex-tile__img");
  var imgJ = cellJ.querySelector(".flex-tile__img");
  if (imgI) cellI.removeChild(imgI);
  if (imgJ) cellJ.removeChild(imgJ);
  if (imgJ) cellI.appendChild(imgJ);
  if (imgI) cellJ.appendChild(imgI);
  flexSetTileEmptyClass(cellI, !!cellI.querySelector(".flex-tile__img"));
  flexSetTileEmptyClass(cellJ, !!cellJ.querySelector(".flex-tile__img"));
}

/**
 * @param {{ pblo: HTMLImageElement | null, byUrl: Object.<string, HTMLImageElement> } | null | undefined} [domPool]
 *        From flexHarvestPreviewDomPool(); reused nodes keep decoded bitmaps (no white flash).
 */
function renderFlexPreviewGrid(domPool) {
  if (!flexEditorState) return;
  var el = document.getElementById("flex-preview-grid");
  if (!el) return;
  var pool =
    domPool && typeof domPool === "object"
      ? domPool
      : { pblo: null, byUrl: {} };
  if (!pool.byUrl) pool.byUrl = {};
  var st = flexEditorState;
  el.style.gridTemplateColumns = "repeat(" + st.cols + ", 1fr)";
  el.innerHTML = "";
  var i;
  for (i = 0; i < st.slots.length; i++) {
    var cell = document.createElement("div");
    cell.className = "flex-tile";
    cell.dataset.index = String(i);
    var url = st.slots[i];
    if (i === 0) {
      cell.classList.add("flex-tile--brand");
      if (url) {
        var stack = document.createElement("div");
        stack.className = "flex-tile__brand-stack";
        var pbloImg = flexTakePooledPblo(pool);
        if (!pbloImg) {
          pbloImg = document.createElement("img");
          pbloImg.src = getFlexPbloImageUrl();
        }
        pbloImg.className = "flex-tile__brand-pblo";
        pbloImg.alt = "";
        pbloImg.setAttribute("aria-hidden", "true");
        pbloImg.draggable = false;
        var brandImg = flexTakePooledImg(pool, url);
        if (!brandImg) {
          brandImg = document.createElement("img");
          brandImg.className = "flex-tile__img";
          brandImg.alt = "";
          brandImg.draggable = false;
          if (flexIsMemoryConstrainedDevice()) {
            brandImg.setAttribute("data-flex-src", url);
          } else {
            brandImg.src = url;
          }
        } else {
          brandImg.className = "flex-tile__img";
          brandImg.alt = "";
          brandImg.draggable = false;
        }
        stack.appendChild(pbloImg);
        cell.appendChild(brandImg);
        cell.appendChild(stack);
      } else {
        cell.classList.add("flex-tile--empty");
      }
    } else if (url) {
      var img = flexTakePooledImg(pool, url);
      if (!img) {
        img = document.createElement("img");
        img.className = "flex-tile__img";
        img.alt = "";
        if (flexIsMemoryConstrainedDevice()) {
          img.setAttribute("data-flex-src", url);
        } else {
          img.src = url;
        }
      } else {
        img.className = "flex-tile__img";
        img.alt = "";
      }
      img.draggable = true;
      cell.appendChild(img);
    } else {
      cell.classList.add("flex-tile--empty");
    }
    flexSetTileEmptyClass(cell, !!cell.querySelector(".flex-tile__img"));
    el.appendChild(cell);
  }
  flexDrainUnusedDomPool(pool);
}

function flexRefreshPreviewFromSlots() {
  if (!flexEditorState) return Promise.resolve();
  return flexBuildGridCanvasFromSlots(
    flexEditorState.slots,
    flexEditorState.cols,
    flexEditorState.rows
  )
    .then(function (canvas) {
      var dataUrl;
      try {
        dataUrl = canvas.toDataURL("image/jpeg", FLEX_EXPORT_JPEG_QUALITY);
      } catch (se) {
        flexReleaseCanvasMemory(canvas);
        throw new Error(
          "Could not export image (browser blocked cross-origin art). Try a different browser or VPN."
        );
      }
      flexReleaseCanvasMemory(canvas);
      flexLastExportDataUrl = dataUrl;
      var wrap = document.getElementById("flex-preview-wrap");
      if (wrap) wrap.classList.remove("hidden");
    })
    .catch(function (e) {
      var msg = e instanceof Error ? e.message : String(e);
      var errEl = document.getElementById("flex-error");
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.add("is-visible");
      }
      return Promise.reject(e);
    });
}

async function runFlexGenerate() {
  var errEl = document.getElementById("flex-error");
  if (!lastWalletApiData) {
    if (errEl) {
      errEl.textContent = "Load a wallet first.";
      errEl.classList.add("is-visible");
    }
    return;
  }
  var wantO = document.getElementById("flex-opt-ogenies");
  var wantC = document.getElementById("flex-opt-certs");
  var o = wantO && wantO.checked;
  var c = wantC && wantC.checked;
  if (!o && !c) {
    if (errEl) {
      errEl.textContent = "Select OGENIES and/or CERTS.";
      errEl.classList.add("is-visible");
    }
    return;
  }
  var items = collectFlexItems(lastWalletApiData, o, c);
  if (items.length === 0) {
    if (errEl) {
      errEl.textContent = "No image URLs in that selection.";
      errEl.classList.add("is-visible");
    }
    return;
  }
  if (errEl) errEl.classList.remove("is-visible");
  if (errEl) errEl.textContent = "";
  var sortSel = document.getElementById("flex-trait-sort");
  var sortKey =
    sortSel && sortSel.value ? sortSel.value : "random";
  var sorted = flexSortOrShuffle(items, sortKey, lastWalletApiData);
  rebuildFlexSlotsFromSortedNfts(sorted);
  var previewWrap = document.getElementById("flex-preview-wrap");
  if (previewWrap) previewWrap.classList.remove("hidden");
  flexSetDownloadButtonReady(false);
  renderFlexPreviewGrid();
  setGlobalLoading(true);
  try {
    await flexAwaitPreviewGridLoads(
      document.getElementById("flex-preview-grid")
    );
    await flexRefreshPreviewFromSlots();
    await flexWaitForPreviewGridImages();
    flexSetDownloadButtonReady(true);
  } catch {
    flexSetDownloadButtonReady(false);
  } finally {
    setGlobalLoading(false);
  }
}

function setupFlexYourGeniesUi() {
  var walletResults = document.getElementById("wallet-results");
  var modal = document.getElementById("flex-modal");
  var closeBtn = document.getElementById("flex-modal-close");
  var backdrop = document.getElementById("flex-modal-backdrop");
  var genBtn = document.getElementById("flex-generate-btn");
  if (walletResults) {
    walletResults.addEventListener("click", function (ev) {
      var btn = ev.target.closest("#flex-open-btn");
      if (!btn || !walletResults.contains(btn)) return;
      ev.preventDefault();
      openFlexModal();
    });
  }
  function closeModal() {
    setFlexModalOpen(false);
    resetFlexModalOutput();
  }
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);
  if (genBtn) genBtn.addEventListener("click", runFlexGenerate);
  var co = document.getElementById("flex-opt-ogenies");
  var cc = document.getElementById("flex-opt-certs");
  if (co) co.addEventListener("change", flexSyncGenerateButtonState);
  if (cc) cc.addEventListener("change", flexSyncGenerateButtonState);
  var traitSel = document.getElementById("flex-trait-sort");
  if (traitSel) {
    traitSel.addEventListener("change", function () {
      if (!flexEditorState || !lastWalletApiData) return;
      var wo = document.getElementById("flex-opt-ogenies");
      var wc = document.getElementById("flex-opt-certs");
      var items = collectFlexItems(
        lastWalletApiData,
        wo && wo.checked,
        wc && wc.checked
      );
      if (items.length === 0) return;
      var sk = traitSel.value || "random";
      var sorted = flexSortOrShuffle(items, sk, lastWalletApiData);
      var oldRects = flexCapturePreviewTileRectsByUrl();
      var domPool = flexHarvestPreviewDomPool();
      rebuildFlexSlotsFromSortedNfts(sorted);
      flexSetDownloadButtonReady(false);
      renderFlexPreviewGrid(domPool);
      flexAnimatePreviewGridFlip(oldRects);
      var gridEl = document.getElementById("flex-preview-grid");
      flexAwaitPreviewGridLoads(gridEl)
        .then(function () {
          return flexRefreshPreviewFromSlots();
        })
        .then(function () {
          return flexWaitForPreviewGridImages();
        })
        .then(function () {
          flexSetDownloadButtonReady(true);
        })
        .catch(function () {
          flexSetDownloadButtonReady(false);
        });
    });
  }
  var previewGrid = document.getElementById("flex-preview-grid");
  if (previewGrid) {
    previewGrid.addEventListener("dragstart", function (e) {
      var cell = e.target.closest(".flex-tile");
      if (!cell || !previewGrid.contains(cell)) return;
      var i = parseInt(cell.dataset.index, 10);
      if (i === 0 || !flexEditorState || !flexEditorState.slots[i]) {
        e.preventDefault();
        return;
      }
      flexDnDFromIndex = i;
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", String(i));
      } catch {
        /* IE / older */
      }
      cell.classList.add("flex-tile--dragging");
    });
    previewGrid.addEventListener("dragend", function (e) {
      var cell = e.target.closest(".flex-tile");
      if (cell) cell.classList.remove("flex-tile--dragging");
      flexDnDFromIndex = null;
    });
    previewGrid.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    previewGrid.addEventListener("drop", function (e) {
      e.preventDefault();
      var cell = e.target.closest(".flex-tile");
      if (!cell || !previewGrid.contains(cell) || !flexEditorState) return;
      var j = parseInt(cell.dataset.index, 10);
      var i = flexDnDFromIndex;
      if (i === null || i === undefined || j === 0 || i === 0) return;
      if (i === j) return;
      var tmp = flexEditorState.slots[i];
      flexEditorState.slots[i] = flexEditorState.slots[j];
      flexEditorState.slots[j] = tmp;
      flexDnDFromIndex = null;
      flexSwapPreviewTileContents(i, j);
      flexLastExportDataUrl = null;
    });
  }
  var flexDl = document.getElementById("flex-download-btn");
  if (flexDl) {
    flexDl.addEventListener("click", function () {
      if (!flexEditorState) return;
      function triggerDownload() {
        if (!flexLastExportDataUrl) return;
        var a = document.createElement("a");
        a.href = flexLastExportDataUrl;
        a.download = "ogtriple-flex.jpg";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      if (flexLastExportDataUrl) {
        triggerDownload();
        return;
      }
      setGlobalLoading(true);
      flexRefreshPreviewFromSlots()
        .then(function () {
          triggerDownload();
        })
        .finally(function () {
          setGlobalLoading(false);
        });
    });
  }
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    var welcome = document.getElementById("welcome-modal");
    if (welcome && welcome.classList.contains("is-open")) return;
    if (modal && modal.classList.contains("is-open")) closeModal();
  });
}

/**
 * Try alternate IPFS gateways if primary img fails (data-fb = JSON array of URLs).
 */
window.__nftImgErr = function (img) {
  if (!img) return;
  var raw = img.getAttribute("data-fb");
  var idx = parseInt(img.getAttribute("data-fbi") || "0", 10);
  if (raw) {
    try {
      var list = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(list) && idx < list.length) {
        img.setAttribute("data-fbi", String(idx + 1));
        img.src = list[idx];
        return;
      }
    } catch (e) {
      /* ignore */
    }
  }
  img.classList.add("is-broken");
};

function normalizeMediaUrl(u) {
  if (!u || typeof u !== "string") return null;
  var s = u.trim();
  if (!s) return null;
  if (s.indexOf("ipfs://") === 0) {
    var path = s.slice(7).replace(/^ipfs\//, "");
    return "https://ipfs.io/ipfs/" + path;
  }
  if (s.indexOf("ar://") === 0) {
    return "https://arweave.net/" + s.slice(5);
  }
  return s;
}

/** Primary URL + extra gateways for the same IPFS content */
function buildImageCandidates(raw) {
  var primary = normalizeMediaUrl(raw);
  if (!primary) return { primary: null, fallbacks: [] };
  var list = [primary];
  var pos = primary.indexOf("/ipfs/");
  if (pos !== -1) {
    var after = primary.slice(pos + 6);
    list.push("https://cloudflare-ipfs.com/ipfs/" + after);
    list.push("https://dweb.link/ipfs/" + after);
    list.push("https://w3s.link/ipfs/" + after);
  }
  var seen = {};
  var uniq = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && !seen[list[i]]) {
      seen[list[i]] = 1;
      uniq.push(list[i]);
    }
  }
  return { primary: uniq[0], fallbacks: uniq.slice(1) };
}

function thumbHtml(url, alt) {
  if (url) {
    var c = buildImageCandidates(String(url));
    if (!c.primary) {
      return (
        '<div class="nft-thumb nft-thumb--empty"><span class="nft-thumb-fallback">No image</span></div>'
      );
    }
    var fbAttr = "";
    if (c.fallbacks.length) {
      fbAttr =
        ' data-fb="' +
        escapeAttr(encodeURIComponent(JSON.stringify(c.fallbacks))) +
        '" data-fbi="0"';
    }
    return (
      '<div class="nft-thumb">' +
      '<img src="' +
      escapeAttr(c.primary) +
      '" alt="' +
      escapeAttr(alt || "NFT") +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
      fbAttr +
      ' onerror="window.__nftImgErr(this)" />' +
      '<div class="nft-thumb-fallback" aria-hidden="true">No image</div>' +
      "</div>"
    );
  }
  return (
    '<div class="nft-thumb nft-thumb--empty"><span class="nft-thumb-fallback">No image</span></div>'
  );
}

function renderWalletCardMatched(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--ok">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.imageOgenie, "OGENIE " + tid) +
    thumbHtml(item.imageCert, "CERT " + tid) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--ok">✅ Matched set</p>' +
    "</div>" +
    "</article>"
  );
}

function renderCounterpartSlot(missingLabel, openseaNft, counterpartImageUrl, altForImage) {
  var findBtn = openseaNft
    ? '<a class="nft-thumb__find" href="' +
      escapeHtml(openseaNft) +
      '" target="_blank" rel="noopener noreferrer">Find on OpenSea</a>'
    : '<span class="nft-thumb__find nft-thumb__find--disabled">Find</span>';

  var visual = "";
  if (counterpartImageUrl) {
    var c = buildImageCandidates(String(counterpartImageUrl));
    if (c.primary) {
      var fbAttr = "";
      if (c.fallbacks.length) {
        fbAttr =
          ' data-fb="' +
          escapeAttr(encodeURIComponent(JSON.stringify(c.fallbacks))) +
          '" data-fbi="0"';
      }
      visual =
        '<div class="nft-thumb__counterpart-visual">' +
        '<img class="nft-thumb__counterpart-img" src="' +
        escapeAttr(c.primary) +
        '" alt="' +
        escapeAttr(altForImage || "Counterpart NFT") +
        '" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
        fbAttr +
        ' onerror="window.__nftImgErr(this)" />' +
        '<div class="nft-thumb-fallback" aria-hidden="true">No image</div>' +
        "</div>";
    }
  }
  if (!visual) {
    visual =
      '<div class="nft-thumb__counterpart-visual nft-thumb__counterpart-visual--empty">' +
      '<span class="nft-thumb-fallback">No preview</span></div>';
  }

  return (
    '<div class="nft-thumb nft-thumb--counterpart" data-counterpart-slot tabindex="0" role="group" aria-label="' +
    escapeAttr(missingLabel) +
    '">' +
    visual +
    '<span class="nft-thumb__counterpart-label">' +
    escapeHtml(missingLabel) +
    "</span>" +
    findBtn +
    "</div>"
  );
}

function renderWalletCardMissingCert(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--warn">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.image, "OGENIE " + tid) +
    renderCounterpartSlot(
      "CERT #" + tid + " (missing)",
      item.openseaNft,
      getMissingCertCounterpartImageUrl(),
      "CERT " + tid
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--bad">❌ Missing CERT</p>' +
    "</div>" +
    "</article>"
  );
}

function renderWalletCardNoCert(item, certMaxTokenId) {
  var tid = formatTokenId(item.tokenId);
  var cap = certMaxTokenId != null ? String(certMaxTokenId) : "1000";
  return (
    '<article class="wallet-card wallet-card--nocert">' +
    '<div class="wallet-card__visuals wallet-card__visuals--single">' +
    thumbHtml(item.image, "OGENIE " + tid) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--nocert">No matching CERT</p>' +
    '<p class="wallet-card__meta">CERT exists only for token IDs 1–' +
    escapeHtml(cap) +
    ".</p>" +
    "</div>" +
    "</article>"
  );
}

function renderWalletCardExtraCert(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--info">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.image, "CERT " + tid) +
    renderCounterpartSlot(
      "OGENIE #" + tid + " (missing)",
      item.openseaNft,
      item.counterpartImage,
      "OGENIE " + tid
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--extra">❌ Missing OGENIE</p>' +
    "</div>" +
    "</article>"
  );
}

function applyWalletFilterShowSubs(subs, showKeys) {
  var si;
  var sub;
  var key;
  for (si = 0; si < subs.length; si++) {
    sub = subs[si];
    key = sub.getAttribute("data-unmatched-sub");
    if (showKeys.indexOf(key) !== -1) {
      sub.classList.remove("hidden");
    } else {
      sub.classList.add("hidden");
    }
  }
}

function applyWalletFilter(container, filter) {
  var m = container.querySelector("[data-wallet-section=\"matched\"]");
  var u = container.querySelector("[data-wallet-section=\"unmatched\"]");
  var buttons = container.querySelectorAll(".filter-btn");
  for (var b = 0; b < buttons.length; b++) {
    var btn = buttons[b];
    var f = btn.getAttribute("data-filter");
    var on = f === filter;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (!m || !u) return;

  var subs = u.querySelectorAll("[data-unmatched-sub]");
  if (filter === "all") {
    m.classList.remove("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, ["missing-ogenie", "missing-cert", "no-cert-id"]);
  } else if (filter === "matched") {
    m.classList.remove("hidden");
    u.classList.add("hidden");
  } else if (filter === "unmatched-genies") {
    m.classList.add("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, ["missing-cert"]);
  } else if (filter === "unmatched-certs") {
    m.classList.add("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, ["missing-ogenie"]);
  } else if (filter === "ogenies") {
    m.classList.add("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, ["no-cert-id"]);
  }
}

function walletStatsHtml(matchedLen, ogeniesLen, certsLen) {
  var oo = ogeniesLen !== 1 ? "s" : "";
  var co = certsLen !== 1 ? "s" : "";
  return (
    '<div class="wallet-stats" role="status" aria-live="polite">' +
    '<span class="wallet-stats__line">' +
    '<span class="wallet-stats__ogenies"><strong>' +
    String(ogeniesLen) +
    "</strong> Total Genie" +
    oo +
    "</span>" +
    '<span class="wallet-stats__sep" aria-hidden="true">·</span>' +
    '<span class="wallet-stats__certs"><strong>' +
    String(certsLen) +
    "</strong> Total Cert" +
    co +
    "</span>" +
    '<span class="wallet-stats__sep" aria-hidden="true">·</span>' +
    '<span class="wallet-stats__matched"><strong>' +
    String(matchedLen) +
    "</strong> Total Matched" +
    "</span>" +
    "</span></div>"
  );
}

function updateLookupShellMetaFromWalletData(data) {
  var matched = (data && data.matched) || [];
  var ogenies = (data && data.ogenies) || [];
  var certs = (data && data.certs) || [];
  var meta = document.getElementById("lookup-shell-meta");
  if (!meta) return;
  var nWallets = 1;
  if (data && data.wallets && Array.isArray(data.wallets) && data.wallets.length) {
    nWallets = data.wallets.length;
  } else if (data && data.wallet && String(data.wallet).indexOf(",") !== -1) {
    nWallets = String(data.wallet)
      .split(",")
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean).length;
  }
  var walletSuffix = nWallets > 1 ? " · " + nWallets + " wallets" : "";
  meta.textContent =
    " · " +
    ogenies.length +
    " Total Genie" +
    (ogenies.length !== 1 ? "s" : "") +
    " · " +
    certs.length +
    " Total Cert" +
    (certs.length !== 1 ? "s" : "") +
    " · " +
    matched.length +
    " Total Matched" +
    walletSuffix;
  meta.hidden = false;
}

function clearLookupShellMeta() {
  var meta = document.getElementById("lookup-shell-meta");
  if (!meta) return;
  meta.textContent = "";
  meta.hidden = true;
}

function setLookupShellCollapsed(collapsed) {
  var shell = document.getElementById("lookup-shell");
  var btn = document.getElementById("lookup-shell-toggle");
  if (!shell || !btn) return;
  shell.classList.toggle("is-collapsed", !!collapsed);
  btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function collapseLookupShellAfterWalletCheck() {
  var results = document.getElementById("wallet-results");
  setLookupShellCollapsed(true);
  if (results && !results.classList.contains("hidden")) {
    window.requestAnimationFrame(function () {
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function setupLookupShell() {
  var shell = document.getElementById("lookup-shell");
  var toggle = document.getElementById("lookup-shell-toggle");
  if (!shell || !toggle) return;
  toggle.addEventListener("click", function () {
    setLookupShellCollapsed(!shell.classList.contains("is-collapsed"));
  });
}

function renderWalletResults(container, data) {
  var matched = data.matched || [];
  var missingCerts = data.missingCerts || [];
  var noCert = data.noCert || [];
  var missingOgenies = data.missingOgenies || [];
  var ogenies = data.ogenies || [];
  var certs = data.certs || [];
  var certMaxTokenId = data.certMaxTokenId;

  var hasAny = ogenies.length > 0 || certs.length > 0;
  var html = "";

  if (!hasAny) {
    hideFlexActions();
    container.removeAttribute("data-last-wallet");
    html +=
      walletStatsHtml(0, 0, 0) +
      '<p class="empty-hint prominent">No NFTs found for the scanned wallet(s) in OGENIE or CERT on mainnet.</p>';
    container.innerHTML = html;
    container.classList.remove("hidden");
    updateLookupShellMetaFromWalletData(data);
    return;
  }

  html +=
    walletStatsHtml(matched.length, ogenies.length, certs.length) +
    '<div class="wallet-filter" role="tablist" aria-label="Filter wallet results">' +
    '<span class="wallet-filter-label">View:</span>' +
    '<button type="button" class="filter-btn is-active" data-filter="all" role="tab" aria-pressed="true">ALL</button>' +
    '<button type="button" class="filter-btn" data-filter="matched" role="tab" aria-pressed="false">Matched</button>' +
    '<button type="button" class="filter-btn" data-filter="unmatched-genies" role="tab" aria-pressed="false">Unmatched Genies</button>' +
    '<button type="button" class="filter-btn" data-filter="unmatched-certs" role="tab" aria-pressed="false">Unmatched certs</button>' +
    '<button type="button" class="filter-btn" data-filter="ogenies" role="tab" aria-pressed="false">OGENIES</button>' +
    "</div>" +
    '<div id="flex-actions" class="flex-actions">' +
    '<button type="button" id="flex-open-btn" class="btn-primary flex-open-btn">Flex Your Genies</button>' +
    "</div>";

  html += '<div class="wallet-section-wrap" data-wallet-section="matched">';
  html += '<h3 class="section-title">Complete sets</h3><div class="wallet-grid">';
  if (matched.length === 0) {
    html +=
      '<p class="empty-hint">' +
      (hasAny
        ? "No token IDs appear in both collections."
        : "—") +
      "</p>";
  } else {
    for (var i = 0; i < matched.length; i++) {
      html += renderWalletCardMatched(matched[i]);
    }
  }
  html += "</div></div>";

  html += '<div class="wallet-section-wrap" data-wallet-section="unmatched">';
  html +=
    '<div class="unmatched-sub" data-unmatched-sub="missing-ogenie">' +
    '<h3 class="section-title">Missing OGENIEs</h3><div class="wallet-grid">';
  if (missingOgenies.length === 0) {
    html +=
      '<p class="empty-hint">None — no CERTs in the scanned wallet(s) are missing their OGENIE.</p>';
  } else {
    for (var k = 0; k < missingOgenies.length; k++) {
      html += renderWalletCardExtraCert(missingOgenies[k]);
    }
  }
  html += "</div></div>";

  html +=
    '<div class="unmatched-sub" data-unmatched-sub="missing-cert">' +
    '<h3 class="section-title">Missing CERTs</h3><div class="wallet-grid">';
  if (missingCerts.length === 0) {
    if (ogenies.length === 0) {
      html +=
        '<p class="empty-hint">No OGENIEs detected — so no "missing CERT" rows. If you hold OGENIEs, they may be staked or filtered until the API returns them.</p>';
    } else if (noCert.length > 0) {
      html +=
        '<p class="empty-hint">None with a findable CERT on OpenSea — higher token IDs are listed under "No CERT for this ID".</p>';
    } else {
      html +=
        '<p class="empty-hint">None — every OGENIE here has a matching CERT.</p>';
    }
  } else {
    for (var j = 0; j < missingCerts.length; j++) {
      html += renderWalletCardMissingCert(missingCerts[j]);
    }
  }
  html += "</div></div>";

  html +=
    '<div class="unmatched-sub" data-unmatched-sub="no-cert-id">' +
    '<h3 class="section-title">No CERT for this ID</h3>' +
    '<p class="section-blurb">The OGTriple CERT collection was only minted for token IDs 1–' +
    escapeHtml(String(certMaxTokenId != null ? certMaxTokenId : 1000)) +
    ". There is no matching CERT for these OGENIEs, so OpenSea has no CERT page to open.</p>" +
    '<div class="wallet-grid">';
  if (noCert.length === 0) {
    html +=
      '<p class="empty-hint">None — no OGENIEs above the CERT token ID range (or all are paired).</p>';
  } else {
    for (var nc = 0; nc < noCert.length; nc++) {
      html += renderWalletCardNoCert(noCert[nc], certMaxTokenId);
    }
  }
  html += "</div></div></div>";

  container.innerHTML = html;
  container.classList.remove("hidden");

  var filterBar = container.querySelector(".wallet-filter");
  if (filterBar) {
    filterBar.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-filter]");
      if (!t || t.tagName !== "BUTTON") return;
      ev.preventDefault();
      applyWalletFilter(container, t.getAttribute("data-filter"));
    });
  }

  updateLookupShellMetaFromWalletData(data);
  lastWalletApiData = data;
  if (data.wallet) {
    container.setAttribute("data-last-wallet", String(data.wallet));
  } else {
    container.removeAttribute("data-last-wallet");
  }
  populateFlexTraitSelect();
}

function renderTokenResults(container, data) {
  var tid = formatTokenId(data.tokenId);
  var cap =
    data.certMaxTokenId != null ? String(data.certMaxTokenId) : "1000";

  if (data.noCertForId) {
    var oOnly = data.ogenie || {};
    var seaOnly = oOnly.opensea;
    var btnOnly = seaOnly
      ? '<a class="btn-secondary" href="' +
        escapeHtml(seaOnly) +
        '" target="_blank" rel="noopener noreferrer">OpenSea</a>'
      : "";
    container.innerHTML =
      '<div class="token-pair token-pair--nocert">' +
      '<article class="token-side token-side--ogenie">' +
      thumbHtml(oOnly.image, "OGENIE " + tid) +
      '<h4 class="token-side__label">OGENIE</h4>' +
      '<p class="token-side__owner mono" title="' +
      escapeAttr(oOnly.owner || "") +
      '">' +
      escapeHtml(oOnly.owner ? shortAddress(oOnly.owner) : "—") +
      "</p>" +
      btnOnly +
      "</article>" +
      '<div class="token-no-cert-pane">' +
      '<p class="token-no-cert-pane__title">No CERT for this OGENIE</p>' +
      "<p class=\"token-no-cert-pane__body\">The OGTriple CERT collection was only minted for token IDs 1–" +
      escapeHtml(cap) +
      ". This token ID has no matching CERT on-chain or on OpenSea.</p>" +
      "</div>" +
      "</div>" +
      '<p class="verdict verdict--nocert">Only OGENIE applies — there is no CERT for this ID.</p>';
    container.classList.remove("hidden");
    return;
  }

  var o = data.ogenie || {};
  var c = data.cert || {};
  var matched = !!data.matched;

  var verdict = matched
    ? '<p class="verdict verdict--ok">✅ Perfect match — same owner for OGENIE &amp; CERT.</p>'
    : '<p class="verdict verdict--bad">❌ Different owners (or one side has no owner).</p>';

  function sideCard(label, side, kind) {
    var img = side.image;
    var owner = side.owner;
    var sea = side.opensea;
    var btn = sea
      ? '<a class="btn-secondary" href="' +
        escapeHtml(sea) +
        '" target="_blank" rel="noopener noreferrer">OpenSea</a>'
      : "";
    return (
      '<article class="token-side token-side--' +
      kind +
      '">' +
      thumbHtml(img, label + " " + tid) +
      '<h4 class="token-side__label">' +
      escapeHtml(label) +
      "</h4>" +
      '<p class="token-side__owner mono" title="' +
      escapeAttr(owner || "") +
      '">' +
      escapeHtml(owner ? shortAddress(owner) : "—") +
      "</p>" +
      btn +
      "</article>"
    );
  }

  container.innerHTML =
    '<div class="token-pair">' +
    sideCard("OGENIE", o, "ogenie") +
    sideCard("CERT", c, "cert") +
    "</div>" +
    verdict;
  container.classList.remove("hidden");
}

async function checkWallet() {
  hideFlexActions();
  var input = document.getElementById("wallet-input");
  var btn = document.getElementById("check-wallet-btn");
  var statusEl = document.getElementById("wallet-status");
  var resultsEl = document.getElementById("wallet-results");
  var tokenResultsEl = document.getElementById("token-results");
  var tokenStatusEl = document.getElementById("token-status");

  tokenResultsEl.classList.add("hidden");
  tokenResultsEl.innerHTML = "";
  setStatus(tokenStatusEl, "", "");

  var addrs = parseWalletAddressesFromInput(input ? input.value : "");
  if (!addrs.length) {
    setStatus(
      statusEl,
      "error",
      "Enter at least one wallet — 0x + 40 hex characters. Separate multiple with a comma, space, or new line (max 12)."
    );
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    clearLookupShellMeta();
    setLookupShellCollapsed(false);
    return;
  }

  var params = new URLSearchParams();
  for (var ai = 0; ai < addrs.length; ai++) {
    params.append("address", addrs[ai]);
  }
  var url = apiUrl("/api/wallet?" + params.toString());

  btn.disabled = true;
  setStatus(statusEl, "loading", "Loading…");
  setGlobalLoading(true);
  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";
  resultsEl.removeAttribute("data-last-wallet");

  try {
    var res = await fetch(url, { method: "GET" });
    var text = await res.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server returned non-JSON.");
    }
    if (!res.ok) {
      var errMsg = (data && data.error) || text || "Request failed.";
      if (data && data.detail) {
        errMsg = errMsg + " — " + data.detail;
      }
      throw new Error(errMsg);
    }
    setStatus(statusEl, "", "");
    renderWalletResults(resultsEl, data);
    collapseLookupShellAfterWalletCheck();
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    setStatus(statusEl, "error", msg);
    resultsEl.classList.add("hidden");
    clearLookupShellMeta();
    setLookupShellCollapsed(false);
  } finally {
    setGlobalLoading(false);
    btn.disabled = false;
  }
}

async function findTokenMatch() {
  hideFlexActions();
  var input = document.getElementById("token-input");
  var btn = document.getElementById("find-match-btn");
  var statusEl = document.getElementById("token-status");
  var resultsEl = document.getElementById("token-results");
  var walletResultsEl = document.getElementById("wallet-results");
  var walletStatusEl = document.getElementById("wallet-status");

  walletResultsEl.classList.add("hidden");
  walletResultsEl.innerHTML = "";
  walletResultsEl.removeAttribute("data-last-wallet");
  setStatus(walletStatusEl, "", "");
  clearLookupShellMeta();

  var raw = (input.value || "").trim();
  if (!raw) {
    setStatus(statusEl, "error", "Enter a token ID.");
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    return;
  }

  var url = apiUrl("/api/token?id=" + encodeURIComponent(raw));

  btn.disabled = true;
  setStatus(statusEl, "loading", "Loading…");
  setGlobalLoading(true);
  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";

  try {
    var res = await fetch(url, { method: "GET" });
    var text = await res.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server returned non-JSON.");
    }
    if (!res.ok) {
      var err = (data && data.error) || "";
      if (res.status === 400 && /invalid id/i.test(err)) {
        throw new Error("Invalid token ID.");
      }
      throw new Error(err || text || "Request failed.");
    }
    setStatus(statusEl, "", "");
    renderTokenResults(resultsEl, data);
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    setStatus(statusEl, "error", msg);
    resultsEl.classList.add("hidden");
  } finally {
    setGlobalLoading(false);
    btn.disabled = false;
  }
}

(function setupCounterpartSlotInteractions() {
  var walletResults = document.getElementById("wallet-results");
  if (!walletResults) return;
  walletResults.addEventListener("click", function (ev) {
    var slot = ev.target.closest("[data-counterpart-slot]");
    if (!slot || !walletResults.contains(slot)) return;
    if (ev.target.closest("a.nft-thumb__find")) return;
    slot.classList.toggle("is-revealed");
  });
  walletResults.addEventListener("keydown", function (ev) {
    var slot = ev.target.closest("[data-counterpart-slot]");
    if (!slot || !walletResults.contains(slot)) return;
    if (ev.target.closest && ev.target.closest("a.nft-thumb__find")) return;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      slot.classList.toggle("is-revealed");
    }
  });
})();

document.getElementById("check-wallet-btn").addEventListener("click", checkWallet);
var walletInputEl = document.getElementById("wallet-input");
if (walletInputEl) {
  walletInputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      checkWallet();
    }
  });
}

document.getElementById("find-match-btn").addEventListener("click", findTokenMatch);
document.getElementById("token-input").addEventListener("keydown", function (e) {
  if (e.key === "Enter") findTokenMatch();
});

window.setGlobalLoading = setGlobalLoading;

setupBackToMenu();
setupThemeToggle();
setupWelcomeModal();
setupFlexYourGeniesUi();
setupLookupShell();
