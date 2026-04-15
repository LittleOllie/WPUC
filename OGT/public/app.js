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

/**
 * Progress pill: null/omit = animated indeterminate (red→green sweep);
 * 0–1 = solid fill, hue red → green.
 */
function setGlobalLoadingPill(progress) {
  var root = document.getElementById("global-loading");
  var fill = root && root.querySelector(".global-loading__pill-fill");
  if (!root || !fill) return;
  if (progress == null || typeof progress !== "number" || isNaN(progress)) {
    root.classList.add("global-loading--indeterminate");
    fill.style.width = "";
    fill.style.background = "";
    fill.style.transform = "";
    return;
  }
  root.classList.remove("global-loading--indeterminate");
  var p = Math.max(0, Math.min(1, progress));
  fill.style.width = p * 100 + "%";
  var hue = 120 * p;
  fill.style.background = "hsl(" + hue + ", 72%, 48%)";
}

/**
 * @param {boolean} on
 * @param {{ message?: string, progress?: number } | undefined} opts — progress 0–1 for determinate pill
 */
function setGlobalLoading(on, opts) {
  opts = opts || {};
  var el = document.getElementById("global-loading");
  if (!el) return;
  var label = document.getElementById("global-loading-label");
  if (on) {
    el.classList.add("is-active");
    el.setAttribute("aria-busy", "true");
    var msg =
      opts.message != null && String(opts.message).trim() !== ""
        ? String(opts.message)
        : "Loading…";
    el.setAttribute("aria-label", msg);
    if (label) label.textContent = msg;
    if (typeof opts.progress === "number" && isFinite(opts.progress)) {
      setGlobalLoadingPill(opts.progress);
    } else {
      setGlobalLoadingPill(null);
    }
    el.removeAttribute("aria-hidden");
  } else {
    el.classList.remove("is-active");
    el.removeAttribute("aria-busy");
    el.removeAttribute("aria-label");
    if (label) label.textContent = "";
    var fill = el.querySelector(".global-loading__pill-fill");
    if (fill) {
      fill.style.width = "0%";
      fill.style.background = "";
      fill.style.transform = "";
    }
    el.classList.add("global-loading--indeterminate");
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

function flexNormalizeCellIndexForMerge(slots, cols, idx) {
  if (idx < 0 || idx >= slots.length) return idx;
  if (slots[idx] !== FLEX_FILLER_SKIP) return idx;
  if (
    idx > 0 &&
    flexSlotIsFiller2Url(slots[idx - 1]) &&
    Math.floor((idx - 1) / cols) === Math.floor(idx / cols) &&
    idx % cols === (idx - 1) % cols + 1
  ) {
    return idx - 1;
  }
  if (
    idx >= cols &&
    flexSlotIsFiller2Url(slots[idx - cols]) &&
    slots[idx] === FLEX_FILLER_SKIP &&
    idx % cols === (idx - cols) % cols
  ) {
    return idx - cols;
  }
  return idx;
}

function flexGetMerge2Pair(slots, cols, headIdx) {
  var cells = slots.length;
  if (headIdx < 0 || headIdx >= cells) return null;
  if (!flexSlotIsFiller2Url(slots[headIdx])) return null;
  if (headIdx + 1 < cells && slots[headIdx + 1] === FLEX_FILLER_SKIP) {
    var r0 = Math.floor(headIdx / cols);
    var r1 = Math.floor((headIdx + 1) / cols);
    if (r0 === r1 && (headIdx + 1) % cols === (headIdx % cols) + 1) {
      return { a: headIdx, b: headIdx + 1, horiz: true };
    }
  }
  if (headIdx + cols < cells && slots[headIdx + cols] === FLEX_FILLER_SKIP) {
    if (headIdx % cols === (headIdx + cols) % cols) {
      return { a: headIdx, b: headIdx + cols, horiz: false };
    }
  }
  return null;
}

function flexPairIndicesOverlap(a0, a1, b0, b1) {
  if (a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1) return true;
  return false;
}

/**
 * Try placing a 2.png merge at drop cell toIdx, or the alternate anchor (left/up neighbor)
 * so dropping on the "right" or "bottom" cell of a pair still targets the same span.
 */
function flexTryPlaceMergeMove(slots, cols, cells, mFrom, toIdx) {
  var horiz = mFrom.horiz;
  var anchors = [];
  var c = toIdx % cols;
  if (horiz) {
    if (c < cols - 1) anchors.push(toIdx);
    if (c > 0) anchors.push(toIdx - 1);
  } else {
    if (toIdx + cols < cells) anchors.push(toIdx);
    if (toIdx >= cols) anchors.push(toIdx - cols);
  }
  var seen = {};
  var ai;
  for (ai = 0; ai < anchors.length; ai++) {
    var toN = anchors[ai];
    if (seen[toN]) continue;
    seen[toN] = true;
    var toB = horiz ? toN + 1 : toN + cols;
    if (toB >= cells) continue;
    if (slots[toN] === FLEX_FILLER_SKIP || slots[toB] === FLEX_FILLER_SKIP) {
      continue;
    }
    var srcA = mFrom.a;
    var srcB = mFrom.b;
    if (flexPairIndicesOverlap(srcA, srcB, toN, toB)) continue;

    var dA = slots[toN];
    var dB = slots[toB];
    var u2 = getFlexFiller2Url();

    if (dA === null && dB === null) {
      var spare = flexSpareNftUrlsOrdered(slots);
      var n1 = spare[0] || null;
      var n2 = spare[1] || null;
      slots[srcA] = n1;
      slots[srcB] = n2;
      slots[toN] = u2;
      slots[toB] = FLEX_FILLER_SKIP;
      return true;
    }

    if (dA && dB && dA !== FLEX_FILLER_SKIP && dB !== FLEX_FILLER_SKIP) {
      slots[srcA] = dA;
      slots[srcB] = dB;
      slots[toN] = u2;
      slots[toB] = FLEX_FILLER_SKIP;
      return true;
    }
  }
  return false;
}

function flexBuildNftUrlCountsFromWallet() {
  if (!lastWalletApiData) return null;
  var wo = document.getElementById("flex-opt-ogenies");
  var wc = document.getElementById("flex-opt-certs");
  var items = collectFlexItems(
    lastWalletApiData,
    wo && wo.checked,
    wc && wc.checked
  );
  var sortSel = document.getElementById("flex-trait-sort");
  var sk = sortSel && sortSel.value ? sortSel.value : "random";
  var sorted = flexSortOrShuffle(items, sk, lastWalletApiData);
  var counts = {};
  var i;
  for (i = 0; i < sorted.length; i++) {
    var im = sorted[i].image;
    counts[im] = (counts[im] || 0) + 1;
  }
  return {
    counts: counts,
    ordered: sorted.map(function (x) {
      return x.image;
    })
  };
}

function flexSubtractUsedNftsFromCounts(counts, slots) {
  var i;
  for (i = 0; i < slots.length; i++) {
    var u = slots[i];
    if (!u || u === FLEX_FILLER_SKIP) continue;
    if (flexSlotIsAnyFillerArtUrl(u)) continue;
    if (flexSlotUrlIsBrandGridOgt(u)) continue;
    if (counts[u] > 0) counts[u]--;
  }
}

/** NFT image URLs not currently placed in the grid (multiset remainder, sort order). */
function flexSpareNftUrlsOrdered(slots) {
  var data = flexBuildNftUrlCountsFromWallet();
  if (!data || !data.counts || !data.ordered) return [];
  var counts = {};
  var k;
  for (k in data.counts) {
    if (Object.prototype.hasOwnProperty.call(data.counts, k)) {
      counts[k] = data.counts[k];
    }
  }
  flexSubtractUsedNftsFromCounts(counts, slots);
  var spare = [];
  var i;
  for (i = 0; i < data.ordered.length; i++) {
    var u = data.ordered[i];
    if ((counts[u] || 0) > 0) {
      spare.push(u);
      counts[u]--;
    }
  }
  return spare;
}

/**
 * true if drop changed slots (caller re-renders grid).
 * Handles single↔single swap, 2.png merge moves (fills source with 2 NFTs or displaced pair), merge↔merge swap.
 */
function flexHandleFlexGridDrop(fromIdx, toIdx) {
  if (!flexEditorState) return false;
  var slots = flexEditorState.slots;
  var cols = flexEditorState.cols;
  var rows = flexEditorState.rows;
  var cells = slots.length;

  var fromN = flexNormalizeCellIndexForMerge(slots, cols, fromIdx);
  var toN = flexNormalizeCellIndexForMerge(slots, cols, toIdx);
  if (fromN === toN) return false;

  var mFrom = flexGetMerge2Pair(slots, cols, fromN);
  var mTo = flexGetMerge2Pair(slots, cols, toN);

  if (!mFrom && !mTo) {
    var tmp = slots[fromN];
    slots[fromN] = slots[toN];
    slots[toN] = tmp;
    return true;
  }

  if (mFrom && mTo) {
    if (mFrom.a === mTo.a) return false;
    if (mFrom.horiz !== mTo.horiz) return false;
    var ha = mFrom.a;
    var hb = mFrom.b;
    var va = mTo.a;
    var vb = mTo.b;
    var t2 = slots[ha];
    var ts = slots[hb];
    slots[ha] = slots[va];
    slots[hb] = slots[vb];
    slots[va] = t2;
    slots[vb] = ts;
    return true;
  }

  if (mFrom && !mTo) {
    return flexTryPlaceMergeMove(slots, cols, cells, mFrom, toN);
  }

  if (!mFrom && mTo) return false;

  return false;
}

/** Upper bound for flex grid NFT count (brand tile + this many collection cells max). */
var FLEX_MAX_NFT_TILES = 100000;
var FLEX_CANVAS_SIZE_FALLBACK = 4096;
/** Mobile Safari kills tabs under memory pressure; cap canvas + never hold all decoded NFTs at once. */
var FLEX_MOBILE_EXPORT_MAX = 2048;
/** Max pixel length for the longer grid side when exporting (aspect ratio matches preview). */
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

/** sessionStorage key prefix for ENS → 0x resolution cache. */
var ENS_RESOLVE_CACHE_PREFIX = "ogt_ens_resolve:";

function isLikelyEnsName(s) {
  var t = String(s || "").trim().toLowerCase();
  return t.length > 0 && t.endsWith(".eth");
}

/**
 * Resolve ENS via Worker (proxies ENS Ideas API — avoids browser CORS issues).
 * @returns {Promise<string>} checksummed-lowercase 0x address
 */
async function resolveEnsNameToAddressCached(ensName) {
  var norm = String(ensName || "").trim().toLowerCase();
  if (!norm.endsWith(".eth")) {
    return Promise.reject(new Error("Invalid ENS name or unable to resolve"));
  }
  try {
    var cached = sessionStorage.getItem(ENS_RESOLVE_CACHE_PREFIX + norm);
    if (cached && isValidWallet(cached)) {
      return Promise.resolve(cached.trim().toLowerCase());
    }
  } catch (e) {
    /* ignore storage blocked */
  }
  var url = apiUrl("/api/resolve-ens?name=" + encodeURIComponent(norm));
  var res;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    return Promise.reject(new Error("Invalid ENS name or unable to resolve"));
  }
  var text = await res.text();
  var data;
  try {
    data = JSON.parse(text);
  } catch (e2) {
    return Promise.reject(new Error("Invalid ENS name or unable to resolve"));
  }
  if (!res.ok || !data || typeof data.address !== "string") {
    var errMsg =
      data && typeof data.error === "string" ? data.error : "";
    return Promise.reject(
      new Error(
        errMsg || "Invalid ENS name or unable to resolve"
      )
    );
  }
  var addr = data.address.trim().toLowerCase();
  if (!isValidWallet(addr)) {
    return Promise.reject(new Error("Invalid ENS name or unable to resolve"));
  }
  try {
    sessionStorage.setItem(ENS_RESOLVE_CACHE_PREFIX + norm, addr);
  } catch (e3) {
    /* ignore */
  }
  return addr;
}

/**
 * Split textarea into tokens; resolve .eth names; collect unique 0x addresses (max 12).
 */
async function parseAndResolveWalletInputs(raw) {
  var s = String(raw || "").trim();
  if (!s) return [];
  var parts = s.split(/[\s,;]+/g);
  var out = [];
  var seen = {};
  var i;
  for (i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (!p) continue;
    var addr;
    if (isLikelyEnsName(p)) {
      addr = await resolveEnsNameToAddressCached(p);
    } else if (isValidWallet(p)) {
      addr = p.trim().toLowerCase();
    } else {
      continue;
    }
    if (seen[addr]) continue;
    seen[addr] = true;
    out.push(addr);
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

function flexRevealFlexModalStage2() {
  var el = document.getElementById("flex-modal-stage2");
  if (el) el.classList.remove("hidden");
}

function flexHideFlexModalStage2() {
  var el = document.getElementById("flex-modal-stage2");
  if (el) el.classList.add("hidden");
}

function flexSetDownloadButtonReady(ready) {
  var dl = document.getElementById("flex-download-btn");
  if (dl) {
    if (ready) {
      dl.classList.remove("hidden");
      dl.disabled = false;
    } else {
      dl.classList.add("hidden");
      dl.disabled = true;
    }
  }
  var gifBtn = document.getElementById("exportGifBtn");
  if (gifBtn) {
    if (ready) {
      gifBtn.classList.remove("hidden");
      gifBtn.disabled = false;
    } else {
      gifBtn.classList.add("hidden");
      gifBtn.disabled = true;
    }
  }
}

/** Wait until every preview tile has finished loading (or errored). */
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
      pending.push(im);
    }
    var n = pending.length;
    var left = n;
    function oneDone() {
      left--;
      if (left <= 0) resolve();
    }
    for (i = 0; i < n; i++) {
      im = pending[i];
      if (im.complete && im.naturalWidth > 0) oneDone();
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
    return new URL("ogeniegrid.png", window.location.href).href;
  } catch {
    return "ogeniegrid.png";
  }
}

function getFlexPbloImageUrl() {
  try {
    return new URL("pblo.png", window.location.href).href;
  } catch {
    return "pblo.png";
  }
}

/** Second slot of a merged 2.png pair — no tile / no canvas draw at this index. */
var FLEX_FILLER_SKIP = "__flex_filler_skip__";

function flexFillerAssetUrl(filename) {
  try {
    var base =
      typeof document !== "undefined" && document.baseURI
        ? document.baseURI
        : typeof window !== "undefined" && window.location
          ? window.location.href
          : filename;
    return new URL(filename, base).href;
  } catch {
    return filename;
  }
}

function getFlexFiller1Url() {
  return flexFillerAssetUrl("1.png");
}

function getFlexFiller2Url() {
  return flexFillerAssetUrl("2.png");
}

function getFlexFiller3Url() {
  return flexFillerAssetUrl("3.png");
}

/** Last path segment of a URL (filler compare must not rely on strict === full href). */
function flexFillerBasename(u) {
  if (!u || typeof u !== "string") return "";
  var s = u.trim();
  if (!s || s === FLEX_FILLER_SKIP) return "";
  try {
    if (typeof window !== "undefined" && window.location && window.location.href) {
      s = new URL(s, window.location.href).pathname || s;
    }
  } catch (e) {
    /* ignore */
  }
  var parts = s.split("/");
  var last = parts[parts.length - 1] || "";
  var q = last.indexOf("?");
  if (q !== -1) last = last.slice(0, q);
  return last.toLowerCase();
}

function flexSlotIsFiller1Url(u) {
  return flexFillerBasename(u) === "1.png";
}

function flexSlotIsFiller2Url(u) {
  return flexFillerBasename(u) === "2.png";
}

function flexSlotIsFiller3Url(u) {
  return flexFillerBasename(u) === "3.png";
}

/** Stable src for preview/export (avoids mismatched href vs slot string). */
function flexCanonicalFillerSrc(u) {
  if (flexSlotIsFiller1Url(u)) return getFlexFiller1Url();
  if (flexSlotIsFiller2Url(u)) return getFlexFiller2Url();
  if (flexSlotIsFiller3Url(u)) return getFlexFiller3Url();
  return u;
}

function flexSlotIsAnyFillerArtUrl(u) {
  return flexSlotIsFiller1Url(u) || flexSlotIsFiller2Url(u) || flexSlotIsFiller3Url(u);
}

/** Cover rect for two adjacent cells (same row or same column). */
function flexFillerMergedRect(i0, i1, cols, cw, ch) {
  var c0 = i0 % cols;
  var r0 = Math.floor(i0 / cols);
  var c1 = i1 % cols;
  var r1 = Math.floor(i1 / cols);
  var x;
  var y;
  var w;
  var h;
  if (r0 === r1 && c1 === c0 + 1) {
    x = c0 * cw;
    y = r0 * ch;
    w = cw * 2;
    h = ch;
  } else if (c0 === c1 && r1 === r0 + 1) {
    x = c0 * cw;
    y = r0 * ch;
    w = cw;
    h = ch * 2;
  } else {
    return null;
  }
  return flexExportCellRect(x, y, w, h);
}

/**
 * Fill trailing empty grid cells with 1.png / 2.png / 3.png (see Flex Your Genies spec).
 */
function applyFlexFillers(slots, cols, rows) {
  var cells = cols * rows;
  var firstEmpty = -1;
  var i;
  for (i = 0; i < cells; i++) {
    if (slots[i] === null) {
      firstEmpty = i;
      break;
    }
  }
  if (firstEmpty < 0) return;

  var nEmpty = 0;
  for (i = firstEmpty; i < cells; i++) {
    if (slots[i] === null) nEmpty++;
    else break;
  }

  var u1 = getFlexFiller1Url();
  var u2 = getFlexFiller2Url();
  var u3 = getFlexFiller3Url();

  /* Bottom-right layout: 2.png anchors on the last two grid cells; 3.png fills empties to the
     left until the last NFT (brand + OGENIEs/CERTs). Single empty → 1.png in bottom-right. */
  if (nEmpty === 1) {
    slots[cells - 1] = u1;
    return;
  }
  slots[cells - 2] = u2;
  slots[cells - 1] = FLEX_FILLER_SKIP;
  for (i = firstEmpty; i < cells - 2; i++) {
    slots[i] = u3;
  }
}

function flexEditorSlotIsDraggable(i) {
  if (!flexEditorState || !flexEditorState.slots) return false;
  var s = flexEditorState.slots[i];
  if (!s || s === FLEX_FILLER_SKIP) return false;
  return true;
}

/** True when url is the flex brand grid art (ogeniegrid.png), any path/query variant. */
function flexSlotUrlIsBrandGridOgt(url) {
  if (!url || typeof url !== "string") return false;
  try {
    var cu = new URL(url, window.location.href).pathname;
    var br = new URL(getFlexGridBrandImageUrl(), window.location.href).pathname;
    var a = (cu.split("/").pop() || "").toLowerCase();
    var b = (br.split("/").pop() || "").toLowerCase();
    return a === b && a.length > 0;
  } catch (e) {
    var bn = flexFillerBasename(url);
    return bn === "ogeniegrid.png" || bn === "ogtriplegrid.png";
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
  applyFlexFillers(slots, g.cols, g.rows);
  flexEditorState = { slots: slots, cols: g.cols, rows: g.rows };
}

/** Concurrent preview loads per batch (not sequential). */
var FLEX_IMG_BATCH_SIZE = 20;
/** Used to estimate on-screen tile px for /img?size= heuristic. */
var FLEX_PREVIEW_GRID_EST_PX = 520;

function flexImgDebug(msg, extra) {
  try {
    if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("flexImgDebug") === "1"
    ) {
      console.log("[flex-img]", msg, extra !== undefined ? extra : "");
    }
  } catch (e) {}
}

function flexBuildImgProxyUrl(directUrl, size) {
  return apiUrl("/img?url=" + encodeURIComponent(directUrl) + "&size=" + String(size));
}

function flexFlexQualityUltra() {
  var el = document.getElementById("flex-quality-ultra");
  return !!(el && el.checked);
}

function flexEstimateTilePixels(cols, rows) {
  var g = Math.max(1, cols, rows);
  return FLEX_PREVIEW_GRID_EST_PX / g;
}

function flexPickProxySizeForPreview(cols, rows) {
  if (flexFlexQualityUltra()) return 1024;
  var tile = flexEstimateTilePixels(cols, rows);
  if (tile < 150) return 256;
  if (tile < 300) return 512;
  return 1024;
}

function flexCountOccupiedSlots() {
  if (!flexEditorState || !flexEditorState.slots) return 0;
  var n = 0;
  var i;
  for (i = 0; i < flexEditorState.slots.length; i++) {
    var s = flexEditorState.slots[i];
    if (s && s !== FLEX_FILLER_SKIP) n++;
  }
  return n;
}

/**
 * Proxy dimension for canvas export: balances quality vs speed for large wallets.
 * @param {number} cellPixelWidth
 */
function flexPickProxySizeForExport(cellPixelWidth) {
  var cells = flexCountOccupiedSlots();
  if (flexFlexQualityUltra()) return 1024;
  if (cells >= 300) return 512;
  if (cells < 100) return 1024;
  if (cellPixelWidth < 150) return 256;
  if (cellPixelWidth < 300) return 512;
  return 1024;
}

function flexGetExportProxySizeForAnimation() {
  var cells = flexCountOccupiedSlots();
  if (flexFlexQualityUltra()) return 1024;
  if (cells >= 300) return 512;
  if (cells < 100) return 1024;
  return 512;
}

/** null = load direct (local / filler); else worker /img dimension */
function flexProxyPxForExportUrl(u, exportPx) {
  if (!u) return null;
  if (flexIsLikelyLocalFlexAsset(u)) return null;
  if (flexSlotIsAnyFillerArtUrl(u)) return null;
  return exportPx;
}

function flexIsLikelyLocalFlexAsset(u) {
  if (!u) return false;
  var b = flexFillerBasename(u);
  if (b === "1.png" || b === "2.png" || b === "3.png") return true;
  if (
    b === "pblo.png" ||
    b === "ogeniegrid.png" ||
    b === "ogtriplegrid.png" ||
    b === "ogtriplelogo.png"
  ) {
    return true;
  }
  return false;
}

function flexShouldProxyRemoteNftUrl(u) {
  if (!u || typeof u !== "string") return false;
  if (flexSlotIsAnyFillerArtUrl(u)) return false;
  if (flexIsLikelyLocalFlexAsset(u)) return false;
  return /^https?:\/\//i.test(u);
}

function flexAssignProxiedPreviewSrc(img, rawUrl, proxySize) {
  var c = buildImageCandidates(String(rawUrl));
  if (!c.primary) return;
  var primaryProxy = flexBuildImgProxyUrl(c.primary, proxySize);
  var chain = [];
  var fi;
  for (fi = 0; fi < c.fallbacks.length; fi++) {
    chain.push(flexBuildImgProxyUrl(c.fallbacks[fi], proxySize));
  }
  chain.push(c.primary);
  for (fi = 0; fi < c.fallbacks.length; fi++) {
    chain.push(c.fallbacks[fi]);
  }
  img.setAttribute("data-flex-src", primaryProxy);
  img.setAttribute("data-fb", encodeURIComponent(JSON.stringify(chain)));
  img.setAttribute("data-fbi", "0");
}

function flexLoadImageElementWithRetry(img) {
  return new Promise(function (resolve) {
    var src = img.getAttribute("data-flex-src");
    if (!src) {
      resolve();
      return;
    }
    img.removeAttribute("data-flex-src");
    var attempt = 0;
    function finish() {
      resolve();
    }
    function onError() {
      if (attempt < 1) {
        attempt++;
        flexImgDebug("flex tile img retry", src);
        img.src = src;
        return;
      }
      if (typeof window.__nftImgErr === "function") {
        window.__nftImgErr(img);
      }
      finish();
    }
    img.onload = finish;
    img.onerror = onError;
    img.src = src;
  });
}

/**
 * Batch-load preview tiles: resolves firstBatch after the first 20 images,
 * continues remaining loads in the background (allDone).
 */
function flexKickProgressivePreviewLoads(gridEl) {
  var resolveFirst;
  var resolveAll;
  var pFirst = new Promise(function (r) {
    resolveFirst = r;
  });
  var pAll = new Promise(function (r) {
    resolveAll = r;
  });
  if (!gridEl) {
    resolveFirst();
    resolveAll();
    return { firstBatch: pFirst, allDone: pAll };
  }
  var imgs = Array.prototype.slice.call(
    gridEl.querySelectorAll("img.flex-tile__img[data-flex-src]")
  );
  if (imgs.length === 0) {
    resolveFirst();
    resolveAll();
    return { firstBatch: pFirst, allDone: pAll };
  }
  var batchSize = FLEX_IMG_BATCH_SIZE;
  var i = 0;
  var isFirstBatch = true;
  function runBatch() {
    if (i >= imgs.length) {
      resolveAll();
      return;
    }
    var end = Math.min(i + batchSize, imgs.length);
    var batch = imgs.slice(i, end);
    i = end;
    Promise.all(batch.map(flexLoadImageElementWithRetry))
      .then(function () {
        flexImgDebug("preview batch", { loaded: i, total: imgs.length });
        if (isFirstBatch) {
          isFirstBatch = false;
          resolveFirst();
        }
        runBatch();
      })
      .catch(function (err) {
        console.warn("[flex-img] batch", err);
        if (isFirstBatch) {
          isFirstBatch = false;
          resolveFirst();
        }
        runBatch();
      });
  }
  runBatch();
  return { firstBatch: pFirst, allDone: pAll };
}

/**
 * @param {string} rawUrl
 * @param {number | null | undefined} proxySizeOpt — 256|512|1024 for worker /img; omit for direct URLs only
 */
function flexLoadImageWithFallbacks(rawUrl, proxySizeOpt) {
  return new Promise(function (resolve) {
    if (!rawUrl) {
      resolve(null);
      return;
    }
    var proxySize =
      typeof proxySizeOpt === "number" && isFinite(proxySizeOpt)
        ? proxySizeOpt
        : null;
    var c = buildImageCandidates(String(rawUrl));
    var tryList = [];
    if (c.primary) tryList.push(c.primary);
    var fi;
    for (fi = 0; fi < c.fallbacks.length; fi++) {
      tryList.push(c.fallbacks[fi]);
    }
    var idx = 0;
    var attemptForUrl = 0;
    var directPass = false;
    function tryNext() {
      if (idx >= tryList.length) {
        if (proxySize && !directPass) {
          directPass = true;
          idx = 0;
          attemptForUrl = 0;
          flexImgDebug("canvas img: direct pass after proxy");
          tryNext();
          return;
        }
        resolve(null);
        return;
      }
      var u = tryList[idx];
      var useProxy = proxySize && !directPass;
      var loadUrl = useProxy ? flexBuildImgProxyUrl(u, proxySize) : u;
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        if (attemptForUrl === 0) {
          attemptForUrl = 1;
          flexImgDebug("canvas img retry", loadUrl);
          img.src = loadUrl;
          return;
        }
        attemptForUrl = 0;
        idx++;
        tryNext();
      };
      img.src = loadUrl;
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

/** Download JPEG: ogeniegrid fills tile (contain), pblo drawn on top (same as preview grid). */
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

/**
 * Rectangular grid that fits all cells (e.g. 5×4). cols = ceil(sqrt(n)), rows = ceil(n/cols).
 * Preview tiles stay square (CSS); export uses the same cols:rows aspect ratio.
 */
function flexComputeGrid(totalCells) {
  var n = Math.max(1, totalCells);
  var cols = Math.ceil(Math.sqrt(n));
  var rows = Math.ceil(n / cols);
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

/**
 * Export dimensions: same aspect ratio as the preview grid (W:H = cols:rows), square pixels per cell.
 * maxDim caps the longer grid side so large rectangular grids stay within canvas limits.
 */
function flexExportCanvasDimensionCandidates(cols, rows) {
  var c = Math.max(1, cols);
  var r = Math.max(1, rows);
  var cells = c * r;
  var maxDims;
  if (flexIsMemoryConstrainedDevice()) {
    if (cells > 49) maxDims = [1024, 896, 768, 640];
    else if (cells > 36) maxDims = [1280, 1024, 896, 768];
    else if (cells > 24) maxDims = [1536, 1280, 1024, 896];
    else maxDims = [FLEX_MOBILE_EXPORT_MAX, 1536, 1280, 1024];
  } else {
    maxDims = [FLEX_CANVAS_SIZE, FLEX_CANVAS_SIZE_FALLBACK, 2048, 1536];
  }
  var out = [];
  var i;
  for (i = 0; i < maxDims.length; i++) {
    var maxDim = maxDims[i];
    var cellPx = Math.floor(maxDim / Math.max(c, r));
    if (cellPx < 1) cellPx = 1;
    out.push({ W: c * cellPx, H: r * cellPx });
  }
  return out;
}

/** Single export size cap (e.g. GIF) — same cols:rows aspect, square cells. */
function flexExportCanvasDimensionSingle(cols, rows, maxDim) {
  var c = Math.max(1, cols);
  var r = Math.max(1, rows);
  var cellPx = Math.floor(maxDim / Math.max(c, r));
  if (cellPx < 1) cellPx = 1;
  return [{ W: c * cellPx, H: r * cellPx }];
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

/** First batch of preview images (parallel); remaining loads continue in background. */
function flexAwaitPreviewGridLoads(gridEl) {
  return flexKickProgressivePreviewLoads(gridEl).firstBatch;
}

/** Load each cell’s art, draw, then release — keeps peak memory low for huge grids. */
async function flexExportGridDrawCellsSequential(
  ctx,
  slots,
  cols,
  rows,
  cw,
  ch,
  cellBg
) {
  var cellBackdrop = cellBg || "#ffffff";
  var exportPx = flexPickProxySizeForExport(cw);
  var cells = cols * rows;
  var i;
  var col;
  var row;
  var x;
  var y;
  var bg;
  for (i = 0; i < cells; i++) {
    if (slots[i] === FLEX_FILLER_SKIP) continue;
    col = i % cols;
    row = Math.floor(i / cols);
    x = col * cw;
    y = row * ch;
    if (
      i < cells - 1 &&
      flexSlotIsFiller2Url(slots[i]) &&
      slots[i + 1] === FLEX_FILLER_SKIP
    ) {
      var merged = flexFillerMergedRect(i, i + 1, cols, cw, ch);
      if (merged) {
        var img2 = await flexLoadImageWithFallbacks(
          flexCanonicalFillerSrc(slots[i]),
          null
        );
        flexDrawCover(
          ctx,
          img2,
          merged.x,
          merged.y,
          merged.w,
          merged.h,
          cellBackdrop
        );
        flexReleaseImageElement(img2);
      }
      if ((i & 3) === 3) {
        await new Promise(function (r) {
          setTimeout(r, 0);
        });
      }
      continue;
    }
    var cellR = flexExportCellRect(x, y, cw, ch);
    var slotUrl = slots[i];
    if (i === 0) {
      var pbloM = await flexLoadImageWithFallbacks(getFlexPbloImageUrl(), null);
      var ogM = null;
      if (slotUrl) {
        ogM = await flexLoadImageWithFallbacks(
          slotUrl,
          flexProxyPxForExportUrl(slotUrl, exportPx)
        );
      }
      flexDrawBrandCellExport(ctx, ogM, pbloM, cellR.x, cellR.y, cellR.w, cellR.h);
      flexReleaseImageElement(pbloM);
      flexReleaseImageElement(ogM);
    } else {
      bg = cellBackdrop;
      var img = null;
      if (slotUrl) {
        img = await flexLoadImageWithFallbacks(
          slotUrl,
          flexProxyPxForExportUrl(slotUrl, exportPx)
        );
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

async function flexBuildGridCanvasFromSlots(
  slots,
  cols,
  rows,
  maxSideOverride,
  cellBg
) {
  var cellBackdrop = cellBg || "#ffffff";
  var cells = cols * rows;
  var dimTry =
    typeof maxSideOverride === "number" &&
    maxSideOverride > 0 &&
    isFinite(maxSideOverride)
      ? flexExportCanvasDimensionSingle(cols, rows, maxSideOverride)
      : flexExportCanvasDimensionCandidates(cols, rows);
  var ti;
  var canvas = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  for (ti = 0; ti < dimTry.length; ti++) {
    W = dimTry[ti].W;
    H = dimTry[ti].H;
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
  var exportPx = flexPickProxySizeForExport(cw);
  ctx.fillStyle = cellBackdrop;
  ctx.fillRect(0, 0, W, H);
  var i;
  var col;
  var row;
  var x;
  var y;
  var bg;
  /* Desktop: batched parallel loads (below). Mobile: one cell at a time to limit RAM. */
  var useSequential = flexIsMemoryConstrainedDevice();

  if (useSequential) {
    await flexExportGridDrawCellsSequential(
      ctx,
      slots,
      cols,
      rows,
      cw,
      ch,
      cellBackdrop
    );
  } else {
    var unique = [];
    var seen = {};
    for (i = 0; i < slots.length; i++) {
      var u = slots[i];
      if (u && u !== FLEX_FILLER_SKIP && !seen[u]) {
        seen[u] = true;
        unique.push(u);
      }
    }
    var loadedMap = {};
    var u0;
    for (u0 = 0; u0 < unique.length; u0 += FLEX_IMG_BATCH_SIZE) {
      var slice = unique.slice(u0, u0 + FLEX_IMG_BATCH_SIZE);
      await Promise.all(
        slice.map(function (url) {
          var px = flexProxyPxForExportUrl(url, exportPx);
          return flexLoadImageWithFallbacks(url, px).then(function (im) {
            loadedMap[url] = im;
          });
        })
      );
      flexImgDebug("export unique batch", {
        loaded: Math.min(u0 + FLEX_IMG_BATCH_SIZE, unique.length),
        of: unique.length,
      });
    }
    var pbloD = await flexLoadImageWithFallbacks(getFlexPbloImageUrl(), null);
    for (i = 0; i < cells; i++) {
      if (slots[i] === FLEX_FILLER_SKIP) continue;
      col = i % cols;
      row = Math.floor(i / cols);
      x = col * cw;
      y = row * ch;
      if (
        i < cells - 1 &&
        flexSlotIsFiller2Url(slots[i]) &&
        slots[i + 1] === FLEX_FILLER_SKIP
      ) {
        var mergedP = flexFillerMergedRect(i, i + 1, cols, cw, ch);
        if (mergedP) {
          bg = cellBackdrop;
          var key2 = slots[i];
          var imgM = loadedMap[key2] || loadedMap[flexCanonicalFillerSrc(key2)];
          flexDrawCover(
            ctx,
            imgM || null,
            mergedP.x,
            mergedP.y,
            mergedP.w,
            mergedP.h,
            bg
          );
        }
        continue;
      }
      var cellR2 = flexExportCellRect(x, y, cw, ch);
      if (i === 0) {
        flexDrawBrandCellExport(
          ctx,
          loadedMap[slots[0]] || null,
          pbloD,
          cellR2.x,
          cellR2.y,
          cellR2.w,
          cellR2.h
        );
      } else {
        bg = cellBackdrop;
        var su2 = slots[i];
        flexDrawCover(
          ctx,
          su2 ? loadedMap[su2] || null : null,
          cellR2.x,
          cellR2.y,
          cellR2.w,
          cellR2.h,
          bg
        );
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
  flexHideFlexModalStage2();
  if (err) {
    err.textContent = "";
    err.classList.remove("is-visible");
  }
  if (wrap) wrap.classList.add("hidden");
  var gifSec = document.getElementById("flex-export-section");
  if (gifSec) gifSec.classList.add("hidden");
  flexExportSetProgress("");
  var gifModal = document.getElementById("flex-gif-modal");
  if (gifModal) {
    gifModal.classList.add("hidden");
    gifModal.setAttribute("aria-hidden", "true");
  }
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
    if (!url || url === FLEX_FILLER_SKIP) continue;
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
    if (!url || url === FLEX_FILLER_SKIP) continue;
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
    if (!url || url === FLEX_FILLER_SKIP) continue;
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
  var previewProxy = flexPickProxySizeForPreview(st.cols, st.rows);
  el.style.gridTemplateColumns = "repeat(" + st.cols + ", 1fr)";
  el.style.gridTemplateRows = "repeat(" + st.rows + ", minmax(0, 1fr))";
  el.innerHTML = "";
  var i;
  for (i = 0; i < st.slots.length; i++) {
    var url = st.slots[i];
    if (url === FLEX_FILLER_SKIP) continue;

    var col = i % st.cols;
    var row = Math.floor(i / st.cols);

    var cell = document.createElement("div");
    cell.className = "flex-tile";
    cell.dataset.index = String(i);

    if (i === 0) {
      cell.classList.add("flex-tile--brand");
      cell.style.gridColumn = "1";
      cell.style.gridRow = "1";
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
          brandImg.draggable = true;
          if (flexShouldProxyRemoteNftUrl(url)) {
            flexAssignProxiedPreviewSrc(brandImg, url, previewProxy);
          } else {
            brandImg.src = url;
          }
        } else {
          brandImg.className = "flex-tile__img";
          brandImg.alt = "";
          brandImg.draggable = true;
          if (flexShouldProxyRemoteNftUrl(url)) {
            flexAssignProxiedPreviewSrc(brandImg, url, previewProxy);
          } else {
            brandImg.src = url;
          }
        }
        stack.appendChild(pbloImg);
        cell.appendChild(brandImg);
        cell.appendChild(stack);
      } else {
        cell.classList.add("flex-tile--empty");
      }
    } else if (url) {
      var merged = false;
      if (
        i < st.slots.length - 1 &&
        flexSlotIsFiller2Url(url) &&
        st.slots[i + 1] === FLEX_FILLER_SKIP
      ) {
        var col2 = (i + 1) % st.cols;
        var row2 = Math.floor((i + 1) / st.cols);
        if (row === row2 && col2 === col + 1) {
          cell.style.gridColumn = col + 1 + " / span 2";
          cell.style.gridRow = String(row + 1);
          cell.classList.add("flex-tile--span2h");
          merged = true;
        } else if (col === col2 && row2 === row + 1) {
          cell.style.gridColumn = String(col + 1);
          cell.style.gridRow = row + 1 + " / span 2";
          cell.classList.add("flex-tile--span2v");
          merged = true;
        }
      }
      if (!merged) {
        cell.style.gridColumn = String(col + 1);
        cell.style.gridRow = String(row + 1);
      }

      var srcOut = flexSlotIsAnyFillerArtUrl(url)
        ? flexCanonicalFillerSrc(url)
        : url;
      if (flexSlotIsAnyFillerArtUrl(url)) {
        cell.classList.add("flex-tile--filler");
      }

      var img = flexTakePooledImg(pool, url);
      if (!img) {
        img = document.createElement("img");
        img.className = "flex-tile__img";
        img.alt = "";
        if (flexSlotIsAnyFillerArtUrl(url)) {
          img.src = srcOut;
        } else if (flexShouldProxyRemoteNftUrl(srcOut)) {
          flexAssignProxiedPreviewSrc(img, srcOut, previewProxy);
        } else {
          img.src = srcOut;
        }
      } else {
        img.className = "flex-tile__img";
        img.alt = "";
        if (flexSlotIsAnyFillerArtUrl(url)) {
          img.src = srcOut;
        } else if (flexShouldProxyRemoteNftUrl(srcOut)) {
          flexAssignProxiedPreviewSrc(img, srcOut, previewProxy);
        } else {
          img.src = srcOut;
        }
      }
      img.draggable = true;
      cell.appendChild(img);
    } else {
      cell.style.gridColumn = String(col + 1);
      cell.style.gridRow = String(row + 1);
      cell.classList.add("flex-tile--empty");
    }
    flexSetTileEmptyClass(cell, !!cell.querySelector(".flex-tile__img"));
    el.appendChild(cell);
  }
  flexDrainUnusedDomPool(pool);
}

/** GIF export (grid order; X / Discord–friendly defaults). */
function flexGetGifWorkerScriptUrl() {
  try {
    return new URL("gif.worker.js", document.baseURI || window.location.href).href;
  } catch (e) {
    return "gif.worker.js";
  }
}

/**
 * GIF export defaults: X / Discord–friendly dimensions, frame cap, and timing.
 * flexExportLimitFrames subsamples when there are more NFTs than maxFrames.
 */
var EXPORT_GIF_CONFIG = {
  size: 480,
  maxFrames: 25,
  delay: 350,
  quality: 25
};

/** Hard ceiling for “NFT frames” in the GIF options UI (first frame is always brand tile). */
var EXPORT_GIF_MAX_NFT_FRAMES = 200;

function flexExportLimitFrames(frames, maxFrames) {
  var cap =
    typeof maxFrames === "number" && isFinite(maxFrames) && maxFrames > 0
      ? maxFrames
      : frames.length;
  if (frames.length <= cap) return frames.slice();
  var step = Math.ceil(frames.length / cap);
  return frames.filter(function (_, i) {
    return i % step === 0;
  });
}

/**
 * Row-major image URLs (no fillers; no brand grid art — logo frame is separate).
 */
function flexExportBuildOrderedUrls() {
  if (!flexEditorState || !flexEditorState.slots) return [];
  var slots = flexEditorState.slots;
  var out = [];
  var i;
  for (i = 0; i < slots.length; i++) {
    var url = slots[i];
    if (url === FLEX_FILLER_SKIP) continue;
    if (!url) continue;
    if (flexSlotIsAnyFillerArtUrl(url)) continue;
    if (flexSlotUrlIsBrandGridOgt(url)) continue;
    out.push(url);
  }
  return out;
}

function flexExportSetProgress(msg) {
  var el = document.getElementById("export-progress");
  if (el) el.textContent = msg || "";
  var gl = document.getElementById("global-loading");
  var label = document.getElementById("global-loading-label");
  if (gl && gl.classList.contains("is-active") && label) {
    label.textContent = msg || "";
  }
  if (gl && gl.classList.contains("is-active")) {
    var m = /(\d+)\s*%/.exec(msg || "");
    if (m) {
      setGlobalLoadingPill(parseInt(m[1], 10) / 100);
    } else if (
      msg &&
      (/encoding|Est\./i.test(msg) ||
        /preparing|adding|building/i.test(msg))
    ) {
      setGlobalLoadingPill(null);
    }
  }
}

function flexExportEstimateMbHint(config, frameCount) {
  var px = config.size * config.size * 3;
  var est = ((px * (1 + frameCount)) / (1024 * 1024)) * 0.08;
  return est < 0.1 ? "<0.1" : est.toFixed(1);
}

async function flexExportCreateFrameCanvas(url, size) {
  var canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  var bg = "#0B0F1A";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  var animPx = flexGetExportProxySizeForAnimation();
  var img = await flexLoadImageWithFallbacks(
    url,
    flexProxyPxForExportUrl(url, animPx)
  );
  if (img && img.naturalWidth > 0) {
    flexDrawContain(ctx, img, 0, 0, size, size, bg);
  }
  flexReleaseImageElement(img);
  return canvas;
}

/** GIF frame 1: same as preview / JPEG export — ogeniegrid + pblo on the lime tile. */
async function flexExportCreateGifBrandTileCanvas(size) {
  var canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  var animPx = flexGetExportProxySizeForAnimation();
  var ogUrl = getFlexGridBrandImageUrl();
  var pbloUrl = getFlexPbloImageUrl();
  var ogImg = await flexLoadImageWithFallbacks(
    ogUrl,
    flexProxyPxForExportUrl(ogUrl, animPx)
  );
  var pbloImg = await flexLoadImageWithFallbacks(
    pbloUrl,
    flexProxyPxForExportUrl(pbloUrl, animPx)
  );
  flexDrawBrandCellExport(ctx, ogImg, pbloImg, 0, 0, size, size);
  flexReleaseImageElement(ogImg);
  flexReleaseImageElement(pbloImg);
  return canvas;
}

function flexExportGifAddFrame(gif, canvas, delayMs) {
  var ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  var w = canvas.width;
  var h = canvas.height;
  var idata;
  try {
    idata = ctx.getImageData(0, 0, w, h);
  } catch (e) {
    throw new Error(
      "Could not read pixels for export (cross-origin art blocked the canvas)."
    );
  }
  gif.addFrame(idata, { delay: delayMs, copy: true });
}

function flexGifRenderAndDownload(gif, filename) {
  var name = filename || "ogtriple-flex.gif";
  return new Promise(function (resolve, reject) {
    var t0 = Date.now();
    var lastPct = 0;
    var tick = window.setInterval(function () {
      var sec = Math.floor((Date.now() - t0) / 1000);
      flexExportSetProgress(
        "Encoding GIF " +
          lastPct +
          "% (" +
          sec +
          "s) — first frames take longest; please wait…"
      );
    }, 2500);
    function stopTick() {
      window.clearInterval(tick);
    }
    /**
     * gif.js runs LZW + palette in Web Workers. Progress stays at 0% until the first
     * frame finishes — can be minutes for many large frames — so we also show elapsed time.
     */
    gif.on("progress", function (p) {
      var pct = Math.max(
        0,
        Math.min(100, Math.round((typeof p === "number" ? p : 0) * 100))
      );
      lastPct = pct;
      var sec = Math.floor((Date.now() - t0) / 1000);
      flexExportSetProgress("Encoding GIF " + pct + "% (" + sec + "s)");
    });
    gif.on("finished", function (blob) {
      stopTick();
      try {
        if (!blob || blob.size < 32) {
          reject(new Error("GIF encoding failed (empty output)."));
          return;
        }
        var outBlob =
          blob.type === "image/gif"
            ? blob
            : new Blob([blob], { type: "image/gif" });
        /* Safari/macOS: File + MIME helps Quick Look, Mail, and Messages treat downloads as animated GIFs. */
        var dlSource = outBlob;
        if (typeof File !== "undefined") {
          try {
            dlSource = new File([outBlob], name, {
              type: "image/gif",
              lastModified: Date.now(),
            });
          } catch (e1) {
            /* keep Blob */
          }
        }
        var a = document.createElement("a");
        var u = URL.createObjectURL(dlSource);
        a.href = u;
        a.download = name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () {
          URL.revokeObjectURL(u);
        }, 1500);
      } catch (e) {
        reject(e);
        return;
      }
      resolve();
    });
    flexExportSetProgress("Encoding GIF 0% (0s) — starting workers…");
    try {
      gif.render();
    } catch (e) {
      stopTick();
      reject(e);
    }
  });
}

function flexExportWait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function flexExportRunGif(optMaxNftFrames) {
  if (typeof GIF === "undefined") {
    throw new Error("GIF library failed to load. Refresh the page.");
  }
  if (!flexEditorState) throw new Error("Generate a FlexGrid first.");
  var cap = EXPORT_GIF_CONFIG.maxFrames;
  if (
    typeof optMaxNftFrames === "number" &&
    isFinite(optMaxNftFrames) &&
    optMaxNftFrames > 0
  ) {
    cap = Math.min(
      Math.floor(optMaxNftFrames),
      EXPORT_GIF_MAX_NFT_FRAMES
    );
    cap = Math.max(1, cap);
  }
  var config = {
    size: EXPORT_GIF_CONFIG.size,
    maxFrames: cap,
    delay: EXPORT_GIF_CONFIG.delay,
    quality: EXPORT_GIF_CONFIG.quality
  };
  var ordered = flexExportBuildOrderedUrls();
  var finalFrames = flexExportLimitFrames(ordered, config.maxFrames);
  var delay = Math.max(300, config.delay);
  var size = config.size;
  var total = 1 + finalFrames.length;
  var nWorkers = Math.min(6, Math.max(2, total));
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    nWorkers = Math.min(
      nWorkers,
      Math.max(2, Math.min(6, navigator.hardwareConcurrency - 1))
    );
  }
  var gifEnc = new GIF({
    workers: nWorkers,
    quality: config.quality,
    workerScript: flexGetGifWorkerScriptUrl(),
    repeat: 0,
    background: "#0B0F1A",
    width: size,
    height: size
  });

  flexExportSetProgress(
    "Est. ~" +
      flexExportEstimateMbHint(config, finalFrames.length) +
      " MB · preparing frames (OGenie grid + pblo, then " +
      finalFrames.length +
      " NFT)…"
  );
  var brandCanvas = await flexExportCreateGifBrandTileCanvas(size);
  flexExportGifAddFrame(gifEnc, brandCanvas, 1200);
  flexReleaseCanvasMemory(brandCanvas);
  await flexExportWait(0);

  var fi;
  for (fi = 0; fi < finalFrames.length; fi++) {
    flexExportSetProgress(
      "Adding frames to GIF " +
        (fi + 1) +
        " / " +
        finalFrames.length +
        " · ~" +
        flexExportEstimateMbHint(config, finalFrames.length) +
        " MB"
    );
    var fc = await flexExportCreateFrameCanvas(finalFrames[fi], size);
    flexExportGifAddFrame(gifEnc, fc, delay);
    flexReleaseCanvasMemory(fc);
    await flexExportWait(0);
  }

  await flexGifRenderAndDownload(gifEnc, "ogtriple-flex.gif");
  flexExportSetProgress("");
}

async function flexExportWithUi(asyncFn) {
  var gifBtn = document.getElementById("exportGifBtn");
  if (gifBtn) gifBtn.disabled = true;
  setGlobalLoading(true, { message: "Rendering…" });
  flexExportSetProgress("");
  try {
    await asyncFn();
    setGlobalLoading(true, { message: "Download started.", progress: 1 });
    setTimeout(function () {
      setGlobalLoading(false);
    }, 450);
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    setGlobalLoading(true, { message: msg || "Export failed." });
    setTimeout(function () {
      setGlobalLoading(false);
    }, 2200);
  } finally {
    if (gifBtn) gifBtn.disabled = false;
  }
}

function flexGifModalOpen(show) {
  var el = document.getElementById("flex-gif-modal");
  if (!el) return;
  if (show) {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  } else {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
  }
}

function flexGifModalSetText(msg) {
  var el = document.getElementById("flex-gif-modal-title");
  if (el) el.textContent = msg || "";
}

function flexGifOptionsModalOpen() {
  var modal = document.getElementById("flex-gif-options-modal");
  var input = document.getElementById("flex-gif-options-max");
  var summary = document.getElementById("flex-gif-options-summary");
  if (!modal || !flexEditorState) return;
  var ordered = flexExportBuildOrderedUrls();
  var n = ordered.length;
  var maxPick =
    n === 0 ? 1 : Math.min(n, EXPORT_GIF_MAX_NFT_FRAMES);
  if (input) {
    input.min = "1";
    input.max = String(maxPick);
    var def = Math.min(EXPORT_GIF_CONFIG.maxFrames, maxPick);
    input.value = String(def);
  }
  if (summary) {
    if (n === 0) {
      summary.textContent =
        "No NFTs in the grid — the GIF will be the OGenie grid + pblo only.";
    } else {
      summary.textContent =
        n +
        " NFT(s) in your grid. If you pick fewer than " +
        n +
        ", frames are sampled evenly across the grid.";
    }
  }
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  if (input) {
    try {
      input.focus();
      input.select();
    } catch (e) {
      /* ignore */
    }
  }
}

function flexGifOptionsModalClose() {
  var modal = document.getElementById("flex-gif-options-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function flexGifOptionsConfirmAndRun() {
  var input = document.getElementById("flex-gif-options-max");
  var maxPick = 1;
  if (input) {
    maxPick = parseInt(input.value, 10);
    if (isNaN(maxPick) || maxPick < 1) maxPick = 1;
    var imax = parseInt(input.max, 10);
    if (!isNaN(imax) && maxPick > imax) maxPick = imax;
  }
  flexGifOptionsModalClose();
  flexExportWithUi(function () {
    return flexExportRunGif(maxPick);
  });
}

function setupFlexGifOptionsModal() {
  var modal = document.getElementById("flex-gif-options-modal");
  var cancel = document.getElementById("flex-gif-options-cancel");
  var confirm = document.getElementById("flex-gif-options-confirm");
  var backdrop = document.getElementById("flex-gif-options-backdrop");
  var closeBtn = document.getElementById("flex-gif-options-close");
  if (cancel) cancel.addEventListener("click", flexGifOptionsModalClose);
  if (closeBtn) closeBtn.addEventListener("click", flexGifOptionsModalClose);
  if (backdrop) backdrop.addEventListener("click", flexGifOptionsModalClose);
  if (confirm) confirm.addEventListener("click", flexGifOptionsConfirmAndRun);
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
      flexRevealFlexModalStage2();
      var wrap = document.getElementById("flex-preview-wrap");
      if (wrap) wrap.classList.remove("hidden");
      var gifSec = document.getElementById("flex-export-section");
      if (gifSec) gifSec.classList.remove("hidden");
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
  flexRevealFlexModalStage2();
  var previewWrap = document.getElementById("flex-preview-wrap");
  if (previewWrap) previewWrap.classList.remove("hidden");
  var gifSec = document.getElementById("flex-export-section");
  if (gifSec) gifSec.classList.remove("hidden");
  flexSetDownloadButtonReady(false);
  renderFlexPreviewGrid();
  var gridEl = document.getElementById("flex-preview-grid");
  var loads = flexKickProgressivePreviewLoads(gridEl);
  setGlobalLoading(true, { message: "Loading artwork…" });
  try {
    await loads.firstBatch;
    setGlobalLoading(false);
    await Promise.all([flexRefreshPreviewFromSlots(), loads.allDone]);
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
  var exportGifBtn = document.getElementById("exportGifBtn");
  if (exportGifBtn) {
    exportGifBtn.addEventListener("click", function () {
      flexGifOptionsModalOpen();
    });
  }
  setupFlexGifOptionsModal();
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
      var loads = flexKickProgressivePreviewLoads(gridEl);
      loads.firstBatch
        .then(function () {
          return Promise.all([
            flexRefreshPreviewFromSlots(),
            loads.allDone,
          ]);
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
      if (!flexEditorState || !flexEditorSlotIsDraggable(i)) {
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
      if (i === null || i === undefined || i === j) return;
      if (!flexEditorSlotIsDraggable(i) || !flexEditorSlotIsDraggable(j)) return;
      flexDnDFromIndex = null;
      var oldRects = flexCapturePreviewTileRectsByUrl();
      var domPool = flexHarvestPreviewDomPool();
      if (!flexHandleFlexGridDrop(i, j)) return;
      flexLastExportDataUrl = null;
      renderFlexPreviewGrid(domPool);
      flexAnimatePreviewGridFlip(oldRects);
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
      setGlobalLoading(true, { message: "Preparing image…" });
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
    var gifOpts = document.getElementById("flex-gif-options-modal");
    if (gifOpts && !gifOpts.classList.contains("hidden")) {
      flexGifOptionsModalClose();
      ev.preventDefault();
      return;
    }
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

  var addrs;
  try {
    addrs = await parseAndResolveWalletInputs(input ? input.value : "");
  } catch (ensErr) {
    setStatus(
      statusEl,
      "error",
      "Invalid ENS name or unable to resolve"
    );
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    clearLookupShellMeta();
    setLookupShellCollapsed(false);
    return;
  }
  if (!addrs.length) {
    setStatus(
      statusEl,
      "error",
      "Enter at least one valid 0x address or ENS name. Separate multiple with a comma, space, or new line (max 12)."
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
  setGlobalLoading(true, { message: "Loading wallet…" });
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
  setGlobalLoading(true, { message: "Loading token…" });
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
