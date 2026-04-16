/**
 * Quirks Builder — isolated clone of Flex grid UX for Quirkies / Quirklings / INX.
 * Pairing rules live in ./quirksPairing.js. Dev-only: URL ?quirksFlat=1 skips pairing (smoke test).
 */
import {
  pairQuirksWalletData,
  shuffleQuirksPairing,
  sortPairingByQuirkieTrait,
  buildQuirksGridSequence,
  collectQuirksItemsFlat,
  traitValCanonical,
  quirksTraitCanonicalKey,
} from "./quirksPairing.js";

const WORKER_ORIGIN = "https://quirks-set-checker.littleollienft.workers.dev";

function getApiBase() {
  const loc = window.location;
  if (!WORKER_ORIGIN) return "";
  if (loc.protocol === "file:") return WORKER_ORIGIN;
  try {
    if (loc.hostname === new URL(WORKER_ORIGIN).hostname) return "";
  } catch {
    /* ignore */
  }
  if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") {
    return WORKER_ORIGIN;
  }
  return WORKER_ORIGIN;
}

function apiUrl(pathAndQuery) {
  const base = getApiBase().replace(/\/$/, "");
  if (base) return base + pathAndQuery;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "") + pathAndQuery;
  }
  return pathAndQuery;
}

function quirksNormalizeProxyUrlIfPossible(u) {
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  if (NL && typeof NL.normalizeApiImgUrl === "function") {
    return NL.normalizeApiImgUrl(u);
  }
  return u;
}

/** QuirkKid S3 has no CORS; Worker /api/img — API may return absolute proxy URLs. */
function quirksProxyKidCdnForCanvas(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
  const s = rawUrl.trim();
  if (s.indexOf("/api/img") === 0) {
    return quirksNormalizeProxyUrlIfPossible(apiUrl(s));
  }
  try {
    const parsed = new URL(s);
    if (
      parsed.pathname === "/api/img" &&
      parsed.search.indexOf("url=") !== -1
    ) {
      return quirksNormalizeProxyUrlIfPossible(s);
    }
    const h = parsed.hostname.toLowerCase();
    if (h === "quirkids-images.s3.ap-southeast-2.amazonaws.com") {
      return quirksNormalizeProxyUrlIfPossible(
        apiUrl("/api/img?url=" + encodeURIComponent(s))
      );
    }
  } catch {
    /* ignore */
  }
  return s;
}

const QUIRKS_MAX_NFT_TILES = 100000;
const QUIRKS_DESKTOP_EXPORT_PARALLEL_UNIQUE_CAP = 80;
const QUIRKS_CANVAS_SIZE_FALLBACK = 4096;
const QUIRKS_MOBILE_EXPORT_MAX = 2048;
const QUIRKS_CANVAS_SIZE = 8192;
const QUIRKS_BRAND_CELL_BG = "#000000";
const QUIRKS_BRAND_PBLO_MAX_FRAC = 0.52;
const QUIRKS_EXPORT_JPEG_QUALITY = 0.94;
/** Per candidate when drawing export canvas (FlexGrid-style: don’t hang on one slow gateway). */
const QUIRKS_EXPORT_IMAGE_TRY_MS = 12000;
/** Cap wait when enabling download after preview paint (aligned with FlexGrid export wait). */
const QUIRKS_PREVIEW_IMAGE_WAIT_MS = 12000;
/** Sentinel wallet for token-ID-only FLECKS sessions (app token search). */
const QUIRKS_TOKEN_SEARCH_WALLET_ADDR =
  "0x0000000000000000000000000000000000000bad";
/** Preview-only: probe each NFT candidate before assigning img.src (fail fast, avoid broken first paint). */
const QUIRKS_IMAGE_PREFLIGHT_MS = 2600;

let quirksWalletData = null;
let quirksEditorState = null;
let quirksLastExportDataUrl = null;
let quirksDnDFromIndex = null;
/** Grouped preview: drag single image `{ u, sub }` vs whole unit via `quirksDnDFromIndex`. */
let quirksDnDGroupedPayload = null;
/** Last wallet item list used to build the flat grid — for optional collection-logo toggle. */
let quirksLastSortedGridItems = null;

const QUIRKS_GIF_CONFIG = {
  size: 480,
  maxFrames: 25,
  delay: 350,
  quality: 25,
};

const QUIRKS_GIF_MAX_NFT_FRAMES = 200;
let quirksGifLastSpeedPos = 50;

function quirksGifFinalFrameMsEstimate(nftDelayMs) {
  const L = typeof window !== "undefined" ? window.LO_GIF_BRANDING : null;
  if (L && typeof L.finalFrameDelayMs === "function") {
    return L.finalFrameDelayMs(nftDelayMs);
  }
  const d = Math.round(Number(nftDelayMs) || 0);
  return Math.round((d < 1 ? 1 : d) * 1.5) + 500;
}

function quirksCollectionLogoToggleShows() {
  return (
    quirksEditorState &&
    quirksBrandingIsMultiCollection() &&
    !quirksUseQuirkTripleBrandSquareCell()
  );
}

function quirksSyncCollectionLogoButton() {
  const btn = document.getElementById("quirks-add-collection-logo-btn");
  if (!btn) return;
  if (!quirksCollectionLogoToggleShows()) {
    btn.hidden = true;
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = "Add collection logo";
    return;
  }
  btn.hidden = false;
  const on = btn.getAttribute("aria-pressed") === "true";
  btn.textContent = on ? "Remove collection logo" : "Add collection logo";
}

function quirksClamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function quirksGifSpeedPosToNftDelayMs(pos) {
  const p = quirksClamp(Math.round(parseInt(String(pos), 10) || 0), 0, 100);
  if (p <= 50) {
    return Math.round(2000 + (QUIRKS_GIF_CONFIG.delay - 2000) * (p / 50));
  }
  return Math.round(
    QUIRKS_GIF_CONFIG.delay +
      (150 - QUIRKS_GIF_CONFIG.delay) * ((p - 50) / 50)
  );
}

function quirksExportLimitFrames(frames, maxFrames) {
  const cap =
    typeof maxFrames === "number" && isFinite(maxFrames) && maxFrames > 0
      ? maxFrames
      : frames.length;
  if (frames.length <= cap) return frames.slice();
  const step = Math.ceil(frames.length / cap);
  return frames.filter((_, i) => i % step === 0);
}

function quirksGifEffectiveNftFrameCount(orderedLength, maxPick) {
  if (orderedLength <= 0) return 0;
  const cap = Math.min(
    Math.max(1, Math.floor(maxPick)),
    QUIRKS_GIF_MAX_NFT_FRAMES,
    orderedLength
  );
  const phantom = new Array(orderedLength);
  for (let i = 0; i < orderedLength; i++) phantom[i] = i;
  return quirksExportLimitFrames(phantom, cap).length;
}

function quirksFormatGifSeconds(ms) {
  const sec = Math.max(0, Math.round(ms)) / 1000;
  const d = sec >= 10 ? 1 : 2;
  return Number(sec.toFixed(d)).toString() + " s";
}

function quirksGetGifWorkerScriptUrl() {
  try {
    return new URL("gif.worker.js", document.baseURI || window.location.href)
      .href;
  } catch {
    return "gif.worker.js";
  }
}

function quirksExportBuildOrderedUrls() {
  const st = quirksEditorState;
  if (!st) return [];
  const out = [];
  if (st.mode === "grouped") {
    for (let r = 0; r < st.packed.length; r++) {
      const row = st.packed[r];
      for (let c = 0; c < row.length; c++) {
        const unit = row[c];
        for (let si = 0; si < unit.items.length; si++) {
          const url = quirksProxyKidCdnForCanvas(unit.items[si].image);
          if (!url) continue;
          if (quirksPublicBrandingBasename(url) === "pblo.png") continue;
          if (quirksPublicBrandingBasename(url) === "quirkieslogo.png") continue;
          out.push(url);
        }
      }
    }
    return out;
  }
  for (let i = 0; i < st.slots.length; i++) {
    const url = st.slots[i];
    if (!url) continue;
    const b = quirksPublicBrandingBasename(url);
    if (b === "pblo.png" || b === "quirkieslogo.png") continue;
    out.push(url);
  }
  return out;
}

async function quirksExportCreateGifBrandTileCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.fillStyle = QUIRKS_BRAND_CELL_BG;
  ctx.fillRect(0, 0, size, size);
  const brandUrl = getQuirksGridBrandImageUrl();
  const brandImg = await quirksLoadImageWithFallbacks(brandUrl, null);
  quirksDrawContain(ctx, brandImg, 0, 0, size, size, QUIRKS_BRAND_CELL_BG);
  quirksReleaseImageElement(brandImg);
  return canvas;
}

function quirksExportGifBranding() {
  const L = typeof window !== "undefined" ? window.LO_GIF_BRANDING : null;
  if (!L || typeof L.drawWatermark !== "function") {
    throw new Error("GIF branding utilities failed to load. Refresh the page.");
  }
  return L;
}

function quirksExportGifAddFrame(gif, canvas, delayMs) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  const w = canvas.width;
  const h = canvas.height;
  quirksExportGifBranding().drawWatermark(ctx, w, h);
  let idata;
  try {
    idata = ctx.getImageData(0, 0, w, h);
  } catch (e) {
    throw new Error(
      "Could not read pixels for export (cross-origin art blocked the canvas)."
    );
  }
  gif.addFrame(idata, { delay: delayMs, copy: true });
}

async function quirksExportCreateGifFrameCanvas(url, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  const bg = "#0B0F1A";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const img = await quirksLoadImageWithFallbacks(url, null);
  quirksDrawContain(ctx, img, 0, 0, size, size, bg);
  quirksReleaseImageElement(img);
  return canvas;
}

function quirksGifDownloadBlob(blob, filename) {
  const name = filename || "quirks-flex.gif";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Session: last known-good tile image URL per collection + token (preview/export). */
const quirksSessionTileWinUrl = new Map();
/** Session: proxy-normalized URLs that failed for that token this tab (skip when retrying). */
const quirksSessionTileFailedUrls = new Map();
/** Coalesce in-flight preview probes by normalized URL (avoid duplicate requests for same candidate). */
const quirksPreflightInflight = new Map();

function quirksSessionTileMemoKey(r2Meta) {
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  if (!NL || !r2Meta || r2Meta.tokenId == null) return "";
  const slug =
    typeof NL.resolveCollectionSlugForCache === "function"
      ? NL.resolveCollectionSlugForCache(r2Meta)
      : "";
  const tid =
    typeof NL.canonicalTokenIdStr === "function"
      ? NL.canonicalTokenIdStr(r2Meta.tokenId)
      : String(r2Meta.tokenId);
  if (!slug || !tid) return "";
  return slug + "\0" + tid;
}

function quirksDedupeUrlCandidates(arr) {
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  const norm = (u) => {
    const s = String(u || "").trim();
    if (!s) return "";
    return NL && typeof NL.normalizeApiImgUrl === "function"
      ? NL.normalizeApiImgUrl(s)
      : s;
  };
  const seen = new Set();
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    const k = norm(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(s).trim());
  }
  return out;
}

function quirksApplySessionMemoToCandidates(candidates, r2Meta) {
  const base = Array.isArray(candidates) ? candidates.slice() : [];
  const key = quirksSessionTileMemoKey(r2Meta);
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  const norm = (u) => {
    const s = String(u || "").trim();
    if (!s) return "";
    return NL && typeof NL.normalizeApiImgUrl === "function"
      ? NL.normalizeApiImgUrl(s)
      : s;
  };
  let list = base;
  if (key) {
    const failed = quirksSessionTileFailedUrls.get(key);
    if (failed && failed.size) {
      list = list.filter((u) => u && !failed.has(norm(u)));
    }
    const win = quirksSessionTileWinUrl.get(key);
    if (win && String(win).trim()) {
      const wn = norm(win);
      if (!failed || !failed.has(wn)) {
        list = [win].concat(list.filter((u) => norm(u) !== wn));
      }
    }
  }
  let out = quirksDedupeUrlCandidates(list);
  if (!out.length && base.length) {
    out = quirksDedupeUrlCandidates(base);
  }
  return out;
}

function quirksRecordTileSessionWin(r2Meta, url) {
  const key = quirksSessionTileMemoKey(r2Meta);
  if (!key || !url) return;
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  const u =
    NL && typeof NL.normalizeApiImgUrl === "function"
      ? NL.normalizeApiImgUrl(String(url).trim())
      : String(url).trim();
  if (!u || /^data:image\/svg\+xml/i.test(u)) return;
  if (NL && typeof NL.normalizeApiImgUrl === "function" && NL.NFT_PLACEHOLDER_SVG) {
    const ph = NL.normalizeApiImgUrl(NL.NFT_PLACEHOLDER_SVG);
    if (ph && u === ph) return;
  }
  quirksSessionTileWinUrl.set(key, u);
}

function quirksRecordTileSessionFail(r2Meta, url) {
  const key = quirksSessionTileMemoKey(r2Meta);
  if (!key || !url) return;
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  const u =
    NL && typeof NL.normalizeApiImgUrl === "function"
      ? NL.normalizeApiImgUrl(String(url).trim())
      : String(url).trim();
  if (!u) return;
  let s = quirksSessionTileFailedUrls.get(key);
  if (!s) {
    s = new Set();
    quirksSessionTileFailedUrls.set(key, s);
  }
  s.add(u);
}

function quirksAttachSessionTileMemoHooks(img, r2Meta) {
  if (!img || !quirksSessionTileMemoKey(r2Meta)) return;
  if (img.__quirksMemoCtl) {
    try {
      img.__quirksMemoCtl.abort();
    } catch {
      /* ignore */
    }
  }
  const ctl = new AbortController();
  img.__quirksMemoCtl = ctl;
  const sig = ctl.signal;
  function onLoad() {
    quirksRecordTileSessionWin(r2Meta, img.src);
    img.removeEventListener("error", onErr);
  }
  function onErr() {
    quirksRecordTileSessionFail(r2Meta, img.src);
  }
  img.addEventListener("load", onLoad, { once: true, signal: sig });
  img.addEventListener("error", onErr, { signal: sig });
}

function quirksNormTileUrl(u) {
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  const s = String(u || "").trim();
  if (!s) return "";
  return NL && typeof NL.normalizeApiImgUrl === "function"
    ? NL.normalizeApiImgUrl(s)
    : s;
}

function quirksFirstCandidateIsTrustedMemoWin(merged, r2Meta) {
  const key = quirksSessionTileMemoKey(r2Meta);
  if (!key || !merged || !merged.length) return false;
  const win = quirksSessionTileWinUrl.get(key);
  if (!win) return false;
  const a = quirksNormTileUrl(merged[0]);
  const b = quirksNormTileUrl(win);
  return !!a && a === b;
}

function quirksProbeImageUrl(url, timeoutMs) {
  const s = String(url || "").trim();
  if (!s || /^javascript:/i.test(s)) return Promise.resolve(false);
  if (/^data:image\//i.test(s)) return Promise.resolve(true);
  const norm = quirksNormTileUrl(s);
  if (!norm) return Promise.resolve(false);
  const existing = quirksPreflightInflight.get(norm);
  if (existing) return existing;
  const p = new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      quirksPreflightInflight.delete(norm);
      resolve(ok);
    };
    const t = window.setTimeout(() => finish(false), timeoutMs);
    im.onload = () => {
      window.clearTimeout(t);
      finish(true);
    };
    im.onerror = () => {
      window.clearTimeout(t);
      finish(false);
    };
    im.src = s;
  });
  quirksPreflightInflight.set(norm, p);
  return p;
}

async function quirksPreflightReorderForPreview(merged, r2Meta) {
  if (!merged || !merged.length) return merged || [];
  if (quirksFirstCandidateIsTrustedMemoWin(merged, r2Meta)) {
    return merged;
  }
  const key = quirksSessionTileMemoKey(r2Meta);
  const failed = key ? quirksSessionTileFailedUrls.get(key) : null;
  const timeoutMs = QUIRKS_IMAGE_PREFLIGHT_MS;
  for (let i = 0; i < merged.length; i++) {
    const u = merged[i];
    if (!u) continue;
    const un = quirksNormTileUrl(u);
    if (failed && failed.has(un)) continue;
    if (/^data:image\//i.test(String(u).trim())) {
      const rest = merged.filter((_, j) => j !== i);
      return quirksDedupeUrlCandidates([u].concat(rest));
    }
    const ok = await quirksProbeImageUrl(u, timeoutMs);
    if (ok) {
      const rest = merged.filter((_, j) => j !== i);
      return quirksDedupeUrlCandidates([u].concat(rest));
    }
    quirksRecordTileSessionFail(r2Meta, u);
  }
  return merged;
}

function quirksApplyNftGridImageAfterPreflight(
  img,
  rawUrl,
  slotIndex,
  r2Meta,
  finalList,
  ipfsPath
) {
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  if (!img || !NL || !finalList || !finalList.length) return;
  if (quirksIsMemoryConstrainedDevice()) {
    img.setAttribute("data-quirks-src", finalList[0]);
    img.setAttribute(
      "data-nft-c",
      encodeURIComponent(JSON.stringify(finalList))
    );
    img.setAttribute("data-nft-ci", "0");
    if (ipfsPath) {
      img.setAttribute("data-nft-ipfs-path", ipfsPath);
    }
    if (NL.resolveCollectionSlugForCache) {
      const sg = NL.resolveCollectionSlugForCache(r2Meta || {});
      if (sg) img.setAttribute("data-nft-collection", sg);
    }
    if (r2Meta && r2Meta.contract) {
      img.setAttribute("data-nft-contract", String(r2Meta.contract));
    }
    if (r2Meta && r2Meta.tokenId != null) {
      img.setAttribute("data-nft-token-id", String(r2Meta.tokenId));
    }
    img.onload = function () {
      if (typeof window.__nftImgLoad === "function") {
        window.__nftImgLoad(img);
      }
    };
    img.onerror = function () {
      if (typeof window.__nftImgErr === "function") {
        window.__nftImgErr(img);
      }
    };
    const tileMem = img.closest && img.closest(".quirks-tile");
    if (
      tileMem &&
      typeof NL.ensureSlotReloadControl === "function"
    ) {
      NL.ensureSlotReloadControl(tileMem);
    }
  } else {
    NL.applyToGridImg(img, rawUrl, slotIndex, r2Meta || null, {
      candidates: finalList,
      ipfsPath: ipfsPath,
    });
  }
  if (quirksSessionTileMemoKey(r2Meta) && finalList.length) {
    quirksAttachSessionTileMemoHooks(img, r2Meta);
  }
}

async function quirksAwaitQuirksGridPreflights(gridEl) {
  if (!gridEl) return;
  const imgs = gridEl.querySelectorAll("img.quirks-tile__img");
  const pending = [];
  for (let i = 0; i < imgs.length; i++) {
    const p = imgs[i].__quirksPreflightPromise;
    if (p) pending.push(p);
  }
  if (pending.length) {
    await Promise.all(pending);
  }
}

function quirksUseFlatMode() {
  try {
    return new URLSearchParams(window.location.search).get("quirksFlat") === "1";
  } catch {
    return false;
  }
}

/** Maps grid item kind → /api/img + client image-cache params (collection slug + optional contract). */
function quirksR2MetaForGridItem(item) {
  if (!item || item.tokenId == null) return null;
  const tid = item.tokenId;
  const c =
    typeof window !== "undefined" ? window.__quirksWalletContracts : null;
  const k = String(item.kind || "");
  if (k.includes("quirkkid")) {
    return { collection: "quirkkids", tokenId: tid };
  }
  if (k.includes("inx")) {
    return {
      contract: c && c.inx,
      collection: "inx",
      tokenId: tid,
    };
  }
  if (k.includes("quirking")) {
    return {
      contract: c && c.quirklings,
      collection: "quirklings",
      tokenId: tid,
    };
  }
  if (k.includes("quirkie")) {
    return {
      contract: c && c.quirkies,
      collection: "quirkies",
      tokenId: tid,
    };
  }
  return { tokenId: tid };
}

/** Basename of URL path — must match exactly; avoid `indexOf("pblo.png")` (NFT filenames can contain that substring). */
function quirksPublicBrandingBasename(url) {
  if (!url || typeof url !== "string") return "";
  const s = url.trim();
  try {
    const base =
      typeof document !== "undefined" && document.baseURI
        ? document.baseURI
        : typeof window !== "undefined"
          ? window.location.href
          : "https://local.invalid/";
    const path = new URL(s, base).pathname || "";
    const seg = path.replace(/\/+$/, "").split("/");
    const last = seg[seg.length - 1] || "";
    return String(last).toLowerCase();
  } catch {
    const t = s.split("?")[0].split("#")[0];
    const seg = t.replace(/\/+$/, "").split("/");
    return String(seg[seg.length - 1] || "").toLowerCase();
  }
}

/** Local /public branding files — NftImageLoader proxies other URLs via /api/img and breaks these. */
function quirksIsLocalBrandingAssetUrl(url) {
  if (!url || typeof url !== "string") return false;
  const s = url.trim();
  const base = quirksPublicBrandingBasename(s);
  if (base !== "pblo.png" && base !== "quirkieslogo.png") return false;
  if (!/^https?:/i.test(s)) return true;
  try {
    const pageBase =
      typeof document !== "undefined" && document.baseURI
        ? document.baseURI
        : typeof window !== "undefined"
          ? window.location.href
          : "";
    const abs = new URL(s);
    const page = new URL(pageBase);
    return abs.origin === page.origin;
  } catch {
    return true;
  }
}

function quirksBindGridImage(img, rawUrl, slotIndex, r2Meta) {
  if (quirksIsLocalBrandingAssetUrl(String(rawUrl || ""))) {
    img.removeAttribute("data-nft-c");
    img.removeAttribute("data-nft-ci");
    img.decoding = "async";
    img.removeAttribute("referrerpolicy");
    img.src = String(rawUrl).trim();
    img.onload = function () {
      if (typeof window.__nftImgLoad === "function") {
        window.__nftImgLoad(img);
      } else {
        const t = img.closest && img.closest(".quirks-tile");
        if (t && t.classList) t.classList.add("is-loaded");
      }
    };
    img.onerror = function () {
      const t = img.closest && img.closest(".quirks-tile");
      if (t && t.classList) t.classList.add("is-loaded");
    };
    return;
  }
  const NL =
    typeof window !== "undefined" && window.NftImageLoader;
  if (NL && typeof NL.applyToGridImg === "function") {
    const b = NL.buildImageCandidates(String(rawUrl || ""), r2Meta || {});
    const merged = quirksApplySessionMemoToCandidates(
      b.candidates || [],
      r2Meta
    );
    if (merged && merged.length) {
      img.__quirksBindGen = (img.__quirksBindGen || 0) + 1;
      const bindGen = img.__quirksBindGen;
      if (quirksFirstCandidateIsTrustedMemoWin(merged, r2Meta)) {
        quirksApplyNftGridImageAfterPreflight(
          img,
          rawUrl,
          slotIndex,
          r2Meta,
          merged,
          b.ipfsPath
        );
      } else {
        const task = (async () => {
          const finalList = await quirksPreflightReorderForPreview(
            merged,
            r2Meta
          );
          if (img.__quirksBindGen !== bindGen) return;
          quirksApplyNftGridImageAfterPreflight(
            img,
            rawUrl,
            slotIndex,
            r2Meta,
            finalList,
            b.ipfsPath
          );
        })().finally(() => {
          if (img.__quirksPreflightPromise === task) {
            img.__quirksPreflightPromise = null;
          }
        });
        img.__quirksPreflightPromise = task;
      }
    } else if (quirksIsMemoryConstrainedDevice()) {
      img.setAttribute("data-quirks-src", rawUrl);
    } else {
      NL.applyToGridImg(img, rawUrl, slotIndex, r2Meta || null);
    }
    return;
  }
  if (quirksIsMemoryConstrainedDevice()) {
    img.setAttribute("data-quirks-src", rawUrl);
  } else {
    img.src = rawUrl;
  }
}

/**
 * Branding in `public/` — use the same relative URLs as index.html (`src="quirkieslogo.png"`).
 * Resolving via `new URL(file, document.baseURI)` can diverge from `location.origin` (www vs bare * domain, file: opaque origins) and route art through /api/img, which breaks these assets.
 */
function getQuirksGridBrandImageUrl() {
  return "quirkieslogo.png";
}

function getQuirksPbloImageUrl() {
  return "pblo.png";
}

function normalizeWalletNftEntry(x) {
  if (x && typeof x === "object" && "tokenId" in x) {
    return {
      tokenId: x.tokenId,
      image: x.image || null,
      kidImage: x.kidImage || null,
      traits: Array.isArray(x.traits) ? x.traits : [],
    };
  }
  return { tokenId: x, image: null, kidImage: null, traits: [] };
}

function normalizeWalletNftList(arr) {
  const out = [];
  for (let i = 0; i < (arr || []).length; i++) {
    out.push(normalizeWalletNftEntry(arr[i]));
  }
  return out;
}

/** Merge trait names like "Background" / "Backgrounds"; prefer shortest label for display. */
function collectMergedTraitOptions(items) {
  const seen = {};
  for (let i = 0; i < items.length; i++) {
    const traits = items[i].traits || [];
    for (let j = 0; j < traits.length; j++) {
      const tt = traits[j].trait_type || traits[j].traitType;
      if (!tt) continue;
      const key = quirksTraitCanonicalKey(tt);
      if (!key) continue;
      const rawLabel = String(tt).trim();
      if (!seen[key] || rawLabel.length < seen[key].length) {
        seen[key] = rawLabel;
      }
    }
  }
  const entries = Object.keys(seen).map((k) => ({
    canonical: k,
    label: seen[k],
  }));
  entries.sort((a, b) =>
    a.canonical.localeCompare(b.canonical, undefined, { sensitivity: "base" })
  );
  return entries;
}

function quirksFormatTraitLabel(raw) {
  if (raw == null || typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function quirksTraitValueForSort(item, traitKey, walletData) {
  let v = traitValCanonical(item.traits, traitKey);
  if (v !== "") return v;
  const useQuirkieTraits =
    item.kind === "quirking" ||
    item.kind === "quirking-pair" ||
    item.kind === "quirking-unmatched" ||
    item.kind === "quirking-high" ||
    item.kind === "quirking-section" ||
    item.kind === "quirkkid-pair" ||
    item.kind === "quirkkid-lone" ||
    item.kind === "quirkkid" ||
    item.kind === "quirkkid-section";
  if (useQuirkieTraits && walletData?.quirkies) {
    const ogs = normalizeWalletNftList(walletData.quirkies);
    for (let ti = 0; ti < ogs.length; ti++) {
      if (String(ogs[ti].tokenId) === String(item.tokenId)) {
        return traitValCanonical(ogs[ti].traits, traitKey);
      }
    }
  }
  return "";
}

function quirksCompareTokenId(a, b) {
  try {
    const ba = BigInt(String(a.tokenId));
    const bb = BigInt(String(b.tokenId));
    if (ba < bb) return -1;
    if (ba > bb) return 1;
    return 0;
  } catch {
    return String(a.tokenId).localeCompare(String(b.tokenId));
  }
}

const QUIRKS_KIND_RANK = {
  "quirkie-pair": 0,
  "quirkkid-pair": 1,
  "quirking-pair": 2,
  inx: 3,
  "quirkie-lone": 4,
  "quirkkid-lone": 5,
  "quirking-unmatched": 6,
  "quirking-high": 7,
  quirkie: 0,
  quirkkid: 1,
  quirking: 2,
  "quirkie-section": 0,
  "quirkkid-section": 1,
  "quirking-section": 2,
  "inx-section": 3,
};

function quirksKindRank(k) {
  return QUIRKS_KIND_RANK[k] != null ? QUIRKS_KIND_RANK[k] : 99;
}

function quirksCompareKind(a, b) {
  const oa = quirksKindRank(a.kind);
  const ob = quirksKindRank(b.kind);
  if (oa < ob) return -1;
  if (oa > ob) return 1;
  return 0;
}

function quirksShuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function quirksShufflePreserveKind(items) {
  if (items.length === 0) return [];
  const order = [];
  const seen = new Set();
  for (let ii = 0; ii < items.length; ii++) {
    const k = items[ii].kind || "";
    if (!seen.has(k)) {
      seen.add(k);
      order.push(k);
    }
  }
  const byKind = new Map();
  for (const k of order) byKind.set(k, []);
  for (const it of items) {
    const k = it.kind || "";
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(it);
  }
  for (const arr of byKind.values()) quirksShuffleInPlace(arr);
  const out = [];
  for (const k of order) out.push(...(byKind.get(k) || []));
  return out;
}

function quirksApplySort(items, sortKey, walletData) {
  const copy = items.slice();
  if (!sortKey || sortKey.indexOf("trait:") !== 0) {
    return copy.sort((a, b) => {
      const kc = quirksCompareKind(a, b);
      if (kc !== 0) return kc;
      return quirksCompareTokenId(a, b);
    });
  }
  const key = sortKey.slice(6);
  return copy.sort((a, b) => {
    const kc = quirksCompareKind(a, b);
    if (kc !== 0) return kc;
    const va = quirksTraitValueForSort(a, key, walletData);
    const vb = quirksTraitValueForSort(b, key, walletData);
    const cmp = va.localeCompare(vb, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (cmp !== 0) return cmp;
    return quirksCompareTokenId(a, b);
  });
}

function quirksSortOrShuffleFlat(items, sortKey, walletData) {
  if (!sortKey || sortKey === "random") {
    return quirksShufflePreserveKind(items);
  }
  if (sortKey.indexOf("trait:") === 0) {
    return quirksApplySort(items, sortKey, walletData);
  }
  return quirksShufflePreserveKind(items);
}

function quirksGetGridLayoutMode() {
  const el = document.querySelector(
    'input[name="quirks-grid-layout"]:checked'
  );
  return el && el.value === "sections" ? "sections" : "grouped";
}

/** True when 2+ collection checkboxes are on (multi-collection grid). */
function quirksBrandingIsMultiCollection() {
  const ids = [
    "quirks-opt-quirkies",
    "quirks-opt-quirkkids",
    "quirks-opt-quirklings",
    "quirks-opt-inx",
  ];
  let n = 0;
  for (let i = 0; i < ids.length; i++) {
    if (document.getElementById(ids[i])?.checked) n++;
  }
  return n >= 2;
}

function quirksIsTokenSearchWalletSession() {
  try {
    const a = String(window.__quirksWalletPayloadAddress || "").toLowerCase();
    return a === QUIRKS_TOKEN_SEARCH_WALLET_ADDR.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Token lookup with Quirkie + QuirkKid + Quirkling only (INX off): use a full first tile for
 * quirkieslogo + pblo (same as single-collection brand cell), not the slim multi overlay.
 */
function quirksUseQuirkTripleBrandSquareCell() {
  if (!quirksIsTokenSearchWalletSession()) return false;
  if (document.getElementById("quirks-opt-inx")?.checked) return false;
  const wantQ = document.getElementById("quirks-opt-quirkies")?.checked;
  const wantKid = document.getElementById("quirks-opt-quirkkids")?.checked;
  const wantQl = document.getElementById("quirks-opt-quirklings")?.checked;
  return !!(wantQ && wantKid && wantQl);
}

function quirksBuildItemList(data, wantQ, wantKid, wantQl, wantIx, sortKey) {
  const gridLayout = quirksGetGridLayoutMode();
  if (quirksUseFlatMode()) {
    const items = collectQuirksItemsFlat(
      data,
      wantQ,
      wantKid,
      wantQl,
      wantIx,
      QUIRKS_MAX_NFT_TILES
    );
    return quirksSortOrShuffleFlat(items, sortKey, data);
  }
  let pairing = pairQuirksWalletData(data);
  if (!sortKey || sortKey === "random") {
    pairing = shuffleQuirksPairing(pairing);
  } else if (sortKey.indexOf("trait:") === 0) {
    pairing = sortPairingByQuirkieTrait(pairing, sortKey.slice(6));
  }
  return buildQuirksGridSequence(
    pairing,
    {
      wantQuirkies: wantQ,
      wantQuirkKid: wantKid,
      wantQuirklings: wantQl,
      wantInx: wantIx,
      gridLayout,
    },
    QUIRKS_MAX_NFT_TILES
  );
}

function quirksComputeGrid(totalCells) {
  const cols = Math.ceil(Math.sqrt(totalCells));
  const rows = Math.ceil(totalCells / cols);
  return { cols, rows };
}

/**
 * Grouped layout uses width-2 units (Quirkie + QuirkKid). An odd column count leaves a
 * permanent empty grid track on every row of pairs; use an even column count near √n
 * (round down when ceil is odd so we stay closer to square, e.g. 9 → 8 not 10).
 */
function quirksGroupedGridColumnCount(totalW) {
  const n = Math.max(1, totalW);
  let c = Math.max(2, Math.ceil(Math.sqrt(n)));
  if (c % 2 === 1) c = Math.max(2, c - 1);
  return c;
}

function quirksRowUsedWidth(row) {
  let s = 0;
  for (let i = 0; i < row.length; i++) s += row[i].width;
  return s;
}

/**
 * Pull units from the next row into slack width so the preview grid does not show empty
 * column tracks mid-grid (user OK with order shifting slightly across row boundaries).
 */
function quirksCompactPackedRows(rows, cols) {
  const out = rows.map((r) => r.slice());
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < out.length - 1; i++) {
      let used = quirksRowUsedWidth(out[i]);
      while (used < cols) {
        if (i + 1 >= out.length) break;
        const nxt = out[i + 1];
        if (!nxt.length) {
          out.splice(i + 1, 1);
          changed = true;
          continue;
        }
        const j = nxt.findIndex((u) => used + u.width <= cols);
        if (j === -1) break;
        const u = nxt.splice(j, 1)[0];
        out[i].push(u);
        used += u.width;
        changed = true;
        if (!nxt.length) out.splice(i + 1, 1);
      }
    }
  }
  return out.filter((r) => r.length > 0);
}

function quirksItemIdStr(it) {
  return String(it.tokenId != null ? it.tokenId : "");
}

/**
 * Build horizontal layout units from grouped sequence (quirksPairing output).
 * Width-2: Quirkie + QuirkKid when both appear back-to-back for the same token id.
 */
function buildLayoutUnitsFromGroupedSequence(items) {
  const out = [];
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    const k = it.kind;
    const id = quirksItemIdStr(it);
    const next = items[i + 1];
    const idNext = next ? quirksItemIdStr(next) : "";
    if (k === "quirkie-lone" && next?.kind === "quirkkid-lone" && id === idNext) {
      out.push({ type: "pair", width: 2, items: [it, next] });
      i += 2;
      continue;
    }
    out.push({ type: "single", width: 1, items: [it] });
    i += 1;
  }
  return out;
}

function packLayoutUnitsIntoRows(units, cols) {
  const rows = [];
  let row = [];
  let used = 0;
  for (let u = 0; u < units.length; u++) {
    const unit = units[u];
    const w = unit.width;
    if (w > cols) {
      if (row.length) {
        rows.push(row);
        row = [];
        used = 0;
      }
      rows.push([unit]);
      continue;
    }
    if (used + w > cols && used > 0) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(unit);
    used += w;
  }
  if (row.length) rows.push(row);
  return quirksCompactPackedRows(rows, cols);
}

function quirksRepackGroupedUnits() {
  const st = quirksEditorState;
  if (!st || st.mode !== "grouped" || !Array.isArray(st.units)) return;
  const totalW = st.units.reduce((s, u) => s + u.width, 0);
  const cols = quirksGroupedGridColumnCount(totalW);
  st.packed = packLayoutUnitsIntoRows(st.units, cols);
  st.cols = cols;
  st.rows = st.packed.length;
}

function quirksUnitStableKey(unit) {
  return unit.items
    .map((it) => quirksProxyKidCdnForCanvas(it.image))
    .join("|");
}

function quirksFlipKeyForCell(st, cell) {
  if (!st || !cell) return null;
  if (st.mode === "grouped") {
    const ui = parseInt(cell.dataset.unitIndex, 10);
    if (isNaN(ui) || !st.units[ui]) return null;
    return quirksUnitStableKey(st.units[ui]);
  }
  const idx = parseInt(cell.dataset.index, 10);
  if (isNaN(idx)) return null;
  const url = st.slots[idx];
  return url || null;
}

function quirksRenderBrandOverlay() {
  const overlay = document.getElementById("quirks-preview-brand-overlay");
  if (!overlay) return;
  overlay.innerHTML = "";
  overlay.classList.add("quirks-preview-brand-overlay--pblo-only");
  const pblo = document.createElement("img");
  const pbloSrc = getQuirksPbloImageUrl();
  pblo.src = pbloSrc;
  pblo.alt = "";
  pblo.className = "quirks-preview-brand-overlay__pblo";
  pblo.setAttribute("aria-hidden", "true");
  pblo.decoding = "async";
  pblo.addEventListener(
    "error",
    () => {
      if (pblo.getAttribute("data-quirks-pblo-fb") === "1") return;
      pblo.setAttribute("data-quirks-pblo-fb", "1");
      pblo.src = getQuirksPbloImageUrl() + "?r=1";
    },
    { once: true }
  );
  overlay.appendChild(pblo);
}

/**
 * Corner watermark: multi-collection only (pblo, one column wide).
 * Single-collection branding is drawn in the first grid cell, not here.
 */
async function quirksDrawBrandWatermark(ctx, canvasW, canvasH, opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const multi =
    o.multiCollection != null
      ? o.multiCollection
      : quirksBrandingIsMultiCollection();
  const cols = Math.max(1, typeof o.cols === "number" ? o.cols : 1);
  if (!multi) return;
  const pbloOnly = await quirksLoadImageWithFallbacks(getQuirksPbloImageUrl());
  if (!pbloOnly || pbloOnly.naturalWidth <= 0) {
    quirksReleaseImageElement(pbloOnly);
    return;
  }
  const cellW = canvasW / cols;
  const bx = 0;
  const by = 0;
  const drawW = cellW;
  const piw = pbloOnly.naturalWidth;
  const pih = pbloOnly.naturalHeight;
  const drawH = (pih / piw) * drawW;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = Math.max(4, canvasW * 0.004);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.drawImage(pbloOnly, bx, by, drawW, drawH);
  ctx.restore();
  quirksReleaseImageElement(pbloOnly);
}

function quirksGroupedExportUniqueUrlCount(state) {
  const seen = {};
  let n = 0;
  const units = state.units || [];
  for (let u = 0; u < units.length; u++) {
    const unit = units[u];
    const items = unit.items || [];
    for (let j = 0; j < items.length; j++) {
      const url = quirksProxyKidCdnForCanvas(items[j].image);
      if (url && !seen[url]) {
        seen[url] = true;
        n++;
      }
    }
  }
  return n;
}

async function quirksBuildGroupedExportCanvas(state) {
  const packed = state.packed;
  const cols = state.cols;
  const rows = packed.length;
  const cellCount = Math.max(1, cols * rows);
  const { canvas, ctx, W, H, cellPx } = quirksTryCreateFlushSquareCellCanvas(
    cols,
    rows,
    cellCount
  );
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
  const cw = cellPx;
  const ch = cellPx;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const uniqueCount = quirksGroupedExportUniqueUrlCount(state);
  const useSequential =
    quirksIsMemoryConstrainedDevice() ||
    uniqueCount > QUIRKS_DESKTOP_EXPORT_PARALLEL_UNIQUE_CAP;

  if (useSequential) {
    for (let r = 0; r < packed.length; r++) {
      const rowUnits = packed[r];
      let col = 0;
      for (let u = 0; u < rowUnits.length; u++) {
        const unit = rowUnits[u];
        const uw = unit.width;
        const x = col * cw;
        const y = r * ch;
        const cellW = uw * cw;
        const cellR = quirksExportCellRect(x, y, cellW, ch);
        const nSub = unit.items.length;
        const subW = cellR.w / nSub;
        for (let si = 0; si < nSub; si++) {
          const url = quirksProxyKidCdnForCanvas(unit.items[si].image);
          const img = await quirksLoadImageWithFallbacks(
            url,
            quirksR2MetaForGridItem(unit.items[si])
          );
          quirksDrawContain(
            ctx,
            img,
            cellR.x + si * subW,
            cellR.y,
            subW,
            cellR.h,
            "#ffffff"
          );
          quirksReleaseImageElement(img);
        }
        col += uw;
      }
      if ((r & 3) === 3) {
        await new Promise((res) => setTimeout(res, 0));
      }
    }
  } else {
    const urls = [];
    const seen = {};
    for (let u = 0; u < state.units.length; u++) {
      const unit = state.units[u];
      for (let j = 0; j < unit.items.length; j++) {
        const uu = quirksProxyKidCdnForCanvas(unit.items[j].image);
        if (uu && !seen[uu]) {
          seen[uu] = true;
          urls.push({
            url: uu,
            r2Meta: quirksR2MetaForGridItem(unit.items[j]),
          });
        }
      }
    }
    const loadedMap = {};
    await Promise.all(
      urls.map((entry) =>
        quirksLoadImageWithFallbacks(entry.url, entry.r2Meta).then((im) => {
          loadedMap[entry.url] = im;
        })
      )
    );
    for (let r = 0; r < packed.length; r++) {
      const rowUnits = packed[r];
      let col = 0;
      for (let u = 0; u < rowUnits.length; u++) {
        const unit = rowUnits[u];
        const uw = unit.width;
        const x = col * cw;
        const y = r * ch;
        const cellW = uw * cw;
        const cellR = quirksExportCellRect(x, y, cellW, ch);
        const nSub = unit.items.length;
        const subW = cellR.w / nSub;
        for (let si = 0; si < nSub; si++) {
          const url = quirksProxyKidCdnForCanvas(unit.items[si].image);
          const img = url ? loadedMap[url] || null : null;
          quirksDrawContain(
            ctx,
            img,
            cellR.x + si * subW,
            cellR.y,
            subW,
            cellR.h,
            "#ffffff"
          );
        }
        col += uw;
      }
    }
  }
  await quirksDrawBrandWatermark(ctx, W, H, {
    multiCollection: quirksBrandingIsMultiCollection(),
    cols: state.cols,
  });
  return canvas;
}

function quirksRebuildSlotsFromSorted(sortedItems) {
  const gridLayout = quirksGetGridLayoutMode();
  const wantQ = document.getElementById("quirks-opt-quirkies")?.checked;
  const wantQl = document.getElementById("quirks-opt-quirklings")?.checked;
  const logoBtn = document.getElementById("quirks-add-collection-logo-btn");
  const addCollectionLogoOpt =
    !!logoBtn && logoBtn.getAttribute("aria-pressed") === "true";
  const forceFlatForCollectionLogo =
    addCollectionLogoOpt &&
    quirksBrandingIsMultiCollection() &&
    !quirksUseQuirkTripleBrandSquareCell();

  if (
    gridLayout === "grouped" &&
    wantQ &&
    wantQl &&
    !quirksUseFlatMode() &&
    !quirksUseQuirkTripleBrandSquareCell() &&
    !forceFlatForCollectionLogo
  ) {
    const units = buildLayoutUnitsFromGroupedSequence(sortedItems);
    const totalW = units.reduce((s, u) => s + u.width, 0);
    const cols = quirksGroupedGridColumnCount(totalW);
    const packed = packLayoutUnitsIntoRows(units, cols);
    quirksEditorState = {
      mode: "grouped",
      units,
      packed,
      cols,
      rows: packed.length,
      gridLayout,
      firstCellBrand: false,
    };
    return;
  }

  const multi = quirksBrandingIsMultiCollection();
  const brandSquare = quirksUseQuirkTripleBrandSquareCell();
  const itemUrls = sortedItems.map((x) => quirksProxyKidCdnForCanvas(x.image));
  const prependBrand =
    !multi ||
    brandSquare ||
    (multi && !brandSquare && addCollectionLogoOpt);
  const urls = prependBrand
    ? [quirksProxyKidCdnForCanvas(getQuirksGridBrandImageUrl())].concat(itemUrls)
    : itemUrls;
  const g = quirksComputeGrid(urls.length);
  const cells = g.cols * g.rows;
  const slots = [];
  const slotR2Metas = [];
  for (let i = 0; i < cells; i++) {
    slots.push(i < urls.length ? urls[i] : null);
    if (multi && !brandSquare && !prependBrand) {
      slotR2Metas.push(
        i < sortedItems.length ? quirksR2MetaForGridItem(sortedItems[i]) : null
      );
    } else if (prependBrand && i === 0) {
      slotR2Metas.push(null);
    } else {
      const itemIdx = prependBrand ? i - 1 : i;
      slotR2Metas.push(
        itemIdx < sortedItems.length
          ? quirksR2MetaForGridItem(sortedItems[itemIdx])
          : null
      );
    }
  }
  quirksEditorState = {
    mode: "flat",
    slots,
    slotR2Metas,
    cols: g.cols,
    rows: g.rows,
    gridLayout,
    firstCellBrand: false,
  };
}

function setGlobalLoadingQuirks(on) {
  if (typeof window.setGlobalLoading === "function") {
    window.setGlobalLoading(on);
    return;
  }
  const el = document.getElementById("global-loading");
  if (!el) return;
  el.classList.toggle("is-active", !!on);
}

function quirksSyncGenerateButtonState() {
  const cq = document.getElementById("quirks-opt-quirkies");
  const cqk = document.getElementById("quirks-opt-quirkkids");
  const cql = document.getElementById("quirks-opt-quirklings");
  const cix = document.getElementById("quirks-opt-inx");
  const gen = document.getElementById("quirks-generate-btn");
  if (!gen) return;
  const on =
    !!(cq && cq.checked) ||
    !!(cqk && cqk.checked) ||
    !!(cql && cql.checked) ||
    !!(cix && cix.checked);
  gen.disabled = !on;
}

function quirksSetDownloadButtonReady(ready) {
  const dl = document.getElementById("quirks-download-btn");
  if (!dl) return;
  if (ready) {
    dl.classList.remove("hidden");
    dl.disabled = false;
  } else {
    dl.classList.add("hidden");
    dl.disabled = true;
  }
}

function quirksSetGifButtonReady(ready) {
  const sec = document.getElementById("quirks-export-section");
  const btn = document.getElementById("quirksExportGifBtn");
  if (sec) sec.classList.toggle("hidden", !ready);
  if (!btn) return;
  if (ready) {
    btn.classList.remove("hidden");
    btn.disabled = false;
  } else {
    btn.classList.add("hidden");
    btn.disabled = true;
  }
}

function quirksExportSetProgress(msg) {
  const el = document.getElementById("quirks-export-progress");
  if (el) el.textContent = msg || "";
}

function quirksSetGifOptionsModalOpen(on) {
  const modal = document.getElementById("quirks-gif-options-modal");
  if (!modal) return;
  modal.classList.toggle("hidden", !on);
  modal.setAttribute("aria-hidden", on ? "false" : "true");
  if (on) {
    try {
      modal.focus();
    } catch {
      /* ignore */
    }
  }
}

function quirksSetGifModalOpen(on) {
  const modal = document.getElementById("quirks-gif-modal");
  if (!modal) return;
  modal.classList.toggle("hidden", !on);
  modal.setAttribute("aria-hidden", on ? "false" : "true");
}

function setQuirksModalOpen(on) {
  const modal = document.getElementById("quirks-modal");
  if (!modal) return;
  if (on) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("quirks-modal-active");
  } else {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("quirks-modal-active");
  }
}

function resetQuirksModalOutput() {
  const err = document.getElementById("quirks-error");
  const wrap = document.getElementById("quirks-preview-wrap");
  const grid = document.getElementById("quirks-preview-grid");
  if (err) {
    err.textContent = "";
    err.classList.remove("is-visible");
  }
  if (wrap) wrap.classList.add("hidden");
  quirksSetDownloadButtonReady(false);
  quirksSetGifButtonReady(false);
  quirksExportSetProgress("");
  if (grid) grid.innerHTML = "";
  const brandOv = document.getElementById("quirks-preview-brand-overlay");
  if (brandOv) brandOv.innerHTML = "";
  const logoBtn = document.getElementById("quirks-add-collection-logo-btn");
  if (logoBtn) {
    logoBtn.hidden = true;
    logoBtn.setAttribute("aria-pressed", "false");
    logoBtn.textContent = "Add collection logo";
  }
  quirksEditorState = null;
  quirksLastExportDataUrl = null;
  quirksDnDFromIndex = null;
  quirksDnDGroupedPayload = null;
  quirksLastSortedGridItems = null;
}

function quirksSetTileEmptyClass(cell, hasImg) {
  if (hasImg) cell.classList.remove("quirks-tile--empty");
  else cell.classList.add("quirks-tile--empty");
}

function quirksIsMemoryConstrainedDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  try {
    if (window.matchMedia("(max-width: 768px)").matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function quirksPreviewConcurrentLoads() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod/i.test(ua)) return 2;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 5;
  return 4;
}

function quirksAwaitPreviewGridLoads(gridEl) {
  return new Promise((resolve) => {
    if (!gridEl) {
      resolve();
      return;
    }
    if (!quirksIsMemoryConstrainedDevice()) {
      resolve();
      return;
    }
    const imgs = Array.prototype.slice.call(
      gridEl.querySelectorAll("img.quirks-tile__img[data-quirks-src]")
    );
    const n = imgs.length;
    if (n === 0) {
      resolve();
      return;
    }
    const concurrency = quirksPreviewConcurrentLoads();
    let completed = 0;
    let nextIndex = 0;
    function tryFinish() {
      completed++;
      if (completed >= n) resolve();
    }
    function launchOne() {
      if (nextIndex >= n) return;
      const img = imgs[nextIndex++];
      const u = img.getAttribute("data-quirks-src");
      img.removeAttribute("data-quirks-src");
      img.addEventListener("load", () => { tryFinish(); launchOne(); }, { once: true });
      img.addEventListener("error", () => { tryFinish(); launchOne(); }, { once: true });
      img.src = u;
    }
    const initial = Math.min(concurrency, n);
    for (let j = 0; j < initial; j++) launchOne();
  });
}

function quirksLoadImageWithFallbacks(rawUrl, r2Meta) {
  return new Promise((resolve) => {
    if (!rawUrl) {
      resolve(null);
      return;
    }
    const s0 = String(rawUrl).trim();
    /** Same-origin /public branding — load directly (no proxy pipeline, no CORS mode that breaks canvas/export). */
    if (quirksIsLocalBrandingAssetUrl(s0)) {
      const img = new Image();
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        if (ok && img.naturalWidth > 0) resolve(img);
        else resolve(null);
      };
      const t = window.setTimeout(() => finish(false), QUIRKS_EXPORT_IMAGE_TRY_MS);
      img.onload = () => {
        window.clearTimeout(t);
        finish(true);
      };
      img.onerror = () => {
        window.clearTimeout(t);
        finish(false);
      };
      img.src = s0;
      return;
    }
    const tryOne = (u, onOk, onFail) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        if (ok) onOk(img);
        else onFail();
      };
      const t = window.setTimeout(() => finish(false), QUIRKS_EXPORT_IMAGE_TRY_MS);
      img.onload = () => {
        window.clearTimeout(t);
        finish(true);
      };
      img.onerror = () => {
        window.clearTimeout(t);
        finish(false);
      };
      img.src = u;
    };
    const NL =
      typeof window !== "undefined" && window.NftImageLoader;
    if (NL && typeof NL.buildImageCandidates === "function") {
      const b = NL.buildImageCandidates(String(rawUrl), r2Meta || {});
      const tryList = quirksApplySessionMemoToCandidates(
        (b && b.candidates) || [],
        r2Meta
      );
      if (tryList.length === 0) {
        resolve(null);
        return;
      }
      let idx = 0;
      function tryNext() {
        if (idx >= tryList.length) {
          resolve(null);
          return;
        }
        const u = tryList[idx++];
        tryOne(
          u,
          (img) => {
            quirksRecordTileSessionWin(r2Meta, img.src);
            resolve(img);
          },
          () => {
            if (quirksSessionTileMemoKey(r2Meta)) {
              quirksRecordTileSessionFail(r2Meta, u);
            }
            window.setTimeout(tryNext, 120);
          }
        );
      }
      tryNext();
      return;
    }
    const u = String(rawUrl).trim();
    if (!u) {
      resolve(null);
      return;
    }
    tryOne(
      u,
      (img) => resolve(img),
      () => resolve(null)
    );
  });
}

/** Flush tile rect — no bleed (avoids gaps / overlap seams in the JPEG). */
function quirksExportCellRect(x, y, w, h) {
  return { x, y, w, h };
}

/**
 * Export uses square cells edge-to-edge: W = cellPx×cols, H = cellPx×rows (not a square canvas unless cols === rows).
 * Picks the largest cellPx that fits the pixel budget and browser canvas limits.
 */
function quirksExportPixelBudgets(slotsLen) {
  const n = typeof slotsLen === "number" ? slotsLen : 0;
  if (quirksIsMemoryConstrainedDevice()) {
    if (n > 49) return [1024, 896, 768];
    if (n > 36) return [1280, 1024, 896];
    if (n > 24) return [1536, 1280, 1024];
    return [QUIRKS_MOBILE_EXPORT_MAX, 1536, 1024];
  }
  return [QUIRKS_CANVAS_SIZE, QUIRKS_CANVAS_SIZE_FALLBACK, 2048];
}

function quirksTryCreateFlushSquareCellCanvas(cols, rows, slotsLen) {
  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  const budgets = quirksExportPixelBudgets(slotsLen);
  const maxEdge = QUIRKS_CANVAS_SIZE;
  for (let bi = 0; bi < budgets.length; bi++) {
    const B = budgets[bi];
    let cellPx = Math.floor(B / Math.max(c, r));
    cellPx = Math.min(cellPx, Math.floor(maxEdge / c));
    cellPx = Math.min(cellPx, Math.floor(maxEdge / r));
    if (cellPx < 32) continue;
    const W = cellPx * c;
    const H = cellPx * r;
    const canvas = quirksCreateExportCanvas(W, H);
    if (canvas.width !== W || canvas.height !== H) continue;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    return { canvas, ctx, W, H, cellPx };
  }
  let cellPx = 32;
  cellPx = Math.min(cellPx, Math.floor(maxEdge / c));
  cellPx = Math.min(cellPx, Math.floor(maxEdge / r));
  cellPx = Math.max(32, cellPx);
  const W = cellPx * c;
  const H = cellPx * r;
  const canvas = quirksCreateExportCanvas(W, H);
  const ctx = canvas && canvas.getContext("2d");
  if (!ctx || !canvas) throw new Error("Canvas not supported.");
  return { canvas, ctx, W, H, cellPx };
}

function quirksDrawContain(ctx, img, x, y, w, h, cellBackdrop) {
  const backdrop = cellBackdrop || "#ffffff";
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = backdrop;
  ctx.fillRect(x, y, w, h);
  if (img && img.naturalWidth > 0) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min(w / iw, h / ih);
    const tw = iw * scale;
    const th = ih * scale;
    ctx.drawImage(img, x + (w - tw) / 2, y + (h - th) / 2, tw, th);
  }
  ctx.restore();
}

function quirksDrawBrandCellExport(ctx, brandImg, pbloImg, cellX, cellY, cw, ch) {
  const pbloCap = ch * QUIRKS_BRAND_PBLO_MAX_FRAC;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, cw, ch);
  ctx.clip();
  ctx.fillStyle = QUIRKS_BRAND_CELL_BG;
  ctx.fillRect(cellX, cellY, cw, ch);
  quirksDrawContain(ctx, brandImg, cellX, cellY, cw, ch, QUIRKS_BRAND_CELL_BG);
  if (pbloImg && pbloImg.naturalWidth > 0) {
    const piw = pbloImg.naturalWidth;
    const pih = pbloImg.naturalHeight;
    let drawW = cw;
    let drawH = (pih / piw) * drawW;
    if (drawH > pbloCap) {
      drawH = pbloCap;
      drawW = (piw / pih) * drawH;
    }
    const px = cellX;
    ctx.drawImage(pbloImg, px, cellY, drawW, drawH);
  }
  ctx.restore();
}

function quirksIsBrandLogoUrl(u) {
  return quirksPublicBrandingBasename(u) === "quirkieslogo.png";
}

function quirksDrawPbloOverlayExport(ctx, pbloImg, cellX, cellY, cw, ch) {
  if (!pbloImg || pbloImg.naturalWidth <= 0) return;
  const pbloCap = ch * QUIRKS_BRAND_PBLO_MAX_FRAC;
  const piw = pbloImg.naturalWidth;
  const pih = pbloImg.naturalHeight;
  let drawW = cw;
  let drawH = (pih / piw) * drawW;
  if (drawH > pbloCap) {
    drawH = pbloCap;
    drawW = (piw / pih) * drawH;
  }
  const px = cellX + (cw - drawW) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, cw, ch);
  ctx.clip();
  ctx.drawImage(pbloImg, px, cellY, drawW, drawH);
  ctx.restore();
}

function quirksCreateExportCanvas(W, H) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

function quirksReleaseImageElement(img) {
  if (!img) return;
  try {
    if (img.__quirksMemoCtl) {
      try {
        img.__quirksMemoCtl.abort();
      } catch {
        /* ignore */
      }
      img.__quirksMemoCtl = null;
    }
    img.onload = null;
    img.onerror = null;
    img.src = "";
    img.removeAttribute("src");
  } catch {
    /* ignore */
  }
}

function quirksReleaseCanvasMemory(canvas) {
  if (!canvas) return;
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    /* ignore */
  }
}

async function quirksExportGridDrawCellsSequential(
  ctx,
  slots,
  cols,
  rows,
  cw,
  ch,
  firstCellBrand,
  slotR2Metas
) {
  const cells = cols * rows;
  const pbloM = await quirksLoadImageWithFallbacks(getQuirksPbloImageUrl());
  for (let i = 0; i < cells; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cw;
    const y = row * ch;
    const cellR = quirksExportCellRect(x, y, cw, ch);
    const slotUrl = slots[i];
    const slotMeta = slotR2Metas && slotR2Metas[i];
    const isBrand = slotUrl && quirksIsBrandLogoUrl(slotUrl);
    const bg = isBrand ? QUIRKS_BRAND_CELL_BG : "#ffffff";
    let img = null;
    if (slotUrl) img = await quirksLoadImageWithFallbacks(slotUrl, slotMeta);
    quirksDrawContain(ctx, img, cellR.x, cellR.y, cellR.w, cellR.h, bg);
    quirksReleaseImageElement(img);
    if ((i & 3) === 3) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  /* pblo overlay is always fixed at the top-left cell. */
  quirksDrawPbloOverlayExport(ctx, pbloM, 0, 0, cw, ch);
  quirksReleaseImageElement(pbloM);
}

async function quirksBuildGridCanvasFromSlots(
  slots,
  cols,
  rows,
  firstCellBrand,
  slotR2Metas
) {
  const cells = cols * rows;
  const { canvas, ctx, W, H, cellPx } = quirksTryCreateFlushSquareCellCanvas(
    cols,
    rows,
    slots.length
  );
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
  const cw = cellPx;
  const ch = cellPx;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const seenForCap = {};
  let uniqueCount = 0;
  for (let i = 0; i < slots.length; i++) {
    const uc = slots[i];
    if (uc && !seenForCap[uc]) {
      seenForCap[uc] = true;
      uniqueCount++;
    }
  }
  const useSequential =
    quirksIsMemoryConstrainedDevice() ||
    uniqueCount > QUIRKS_DESKTOP_EXPORT_PARALLEL_UNIQUE_CAP;

  if (useSequential) {
    await quirksExportGridDrawCellsSequential(
      ctx,
      slots,
      cols,
      rows,
      cw,
      ch,
      !!firstCellBrand,
      slotR2Metas
    );
  } else {
    const unique = [];
    const seen = {};
    for (let i = 0; i < slots.length; i++) {
      const u = slots[i];
      if (u && !seen[u]) {
        seen[u] = true;
        unique.push({
          url: u,
          r2Meta: slotR2Metas && slotR2Metas[i],
        });
      }
    }
    const loadedMap = {};
    await Promise.all(
      unique.map((entry) =>
        quirksLoadImageWithFallbacks(entry.url, entry.r2Meta).then((im) => {
          loadedMap[entry.url] = im;
        })
      )
    );
    const loadedSlots = [];
    for (let i = 0; i < slots.length; i++) {
      const su = slots[i];
      loadedSlots.push(su ? loadedMap[su] || null : null);
    }
    for (let i = 0; i < cells; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cw;
      const y = row * ch;
      const cellR2 = quirksExportCellRect(x, y, cw, ch);
      const su = slots[i];
      const isBrand = su && quirksIsBrandLogoUrl(su);
      const bg = isBrand ? QUIRKS_BRAND_CELL_BG : "#ffffff";
      quirksDrawContain(
        ctx,
        loadedSlots[i] || null,
        cellR2.x,
        cellR2.y,
        cellR2.w,
        cellR2.h,
        bg
      );
    }
  }
  const pbloD = await quirksLoadImageWithFallbacks(getQuirksPbloImageUrl());
  quirksDrawPbloOverlayExport(ctx, pbloD, 0, 0, cw, ch);
  quirksReleaseImageElement(pbloD);
  return canvas;
}

function quirksPreviewImgPaintReady(im) {
  return (
    im &&
    im.complete &&
    im.naturalWidth > 0 &&
    im.naturalHeight > 0
  );
}

/**
 * Wait until preview tiles have painted or settled (load/error/timeout).
 * Mirrors FlexGrid waitForExportImages: natural dimensions + per-tile cap so UI never stalls.
 */
function quirksWaitForPreviewGridImages() {
  return new Promise((resolve) => {
    const grid = document.getElementById("quirks-preview-grid");
    if (!grid) {
      resolve();
      return;
    }
    const imgs = grid.querySelectorAll("img.quirks-tile__img");
    if (imgs.length === 0) {
      resolve();
      return;
    }
    const pending = [];
    for (let i = 0; i < imgs.length; i++) {
      const im = imgs[i];
      if (im.getAttribute("data-quirks-src")) continue;
      pending.push(im);
    }
    const n = pending.length;
    if (n === 0) {
      resolve();
      return;
    }
    let left = n;
    function oneDone() {
      left--;
      if (left <= 0) resolve();
    }
    for (let i = 0; i < n; i++) {
      const im = pending[i];
      if (quirksPreviewImgPaintReady(im)) {
        oneDone();
        continue;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        oneDone();
      };
      im.addEventListener("load", done, { once: true });
      im.addEventListener("error", done, { once: true });
      window.setTimeout(done, QUIRKS_PREVIEW_IMAGE_WAIT_MS);
    }
  });
}

function quirksRefreshPreviewFromSlots() {
  if (!quirksEditorState) return Promise.resolve();
  const st = quirksEditorState;
  const build =
    st.mode === "grouped"
      ? quirksBuildGroupedExportCanvas(st)
      : quirksBuildGridCanvasFromSlots(
          st.slots,
          st.cols,
          st.rows,
          !!st.firstCellBrand,
          st.slotR2Metas
        );
  return build
    .then((canvas) => {
      let dataUrl;
      try {
        dataUrl = canvas.toDataURL("image/jpeg", QUIRKS_EXPORT_JPEG_QUALITY);
      } catch {
        quirksReleaseCanvasMemory(canvas);
        throw new Error(
          "Could not export image (browser blocked cross-origin art)."
        );
      }
      quirksReleaseCanvasMemory(canvas);
      quirksLastExportDataUrl = dataUrl;
      const wrap = document.getElementById("quirks-preview-wrap");
      if (wrap) wrap.classList.remove("hidden");
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      const errEl = document.getElementById("quirks-error");
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.add("is-visible");
      }
      return Promise.reject(e);
    });
}

function quirksHarvestPreviewDomPool() {
  const grid = document.getElementById("quirks-preview-grid");
  const pool = { pblo: null, byUrl: {} };
  if (!grid || !quirksEditorState) return pool;
  const st = quirksEditorState;
  if (st.mode === "grouped") {
    const cells = grid.querySelectorAll(".quirks-tile[data-unit-index]");
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const ui = parseInt(cell.dataset.unitIndex, 10);
      if (isNaN(ui) || !st.units[ui]) continue;
      const unit = st.units[ui];
      const imgs = cell.querySelectorAll("img.quirks-tile__img");
      for (let ii = 0; ii < imgs.length; ii++) {
        const img = imgs[ii];
        const item = unit.items[ii];
        if (!item) continue;
        const url = quirksProxyKidCdnForCanvas(item.image);
        if (!url) continue;
        if (img.parentNode) {
          img.parentNode.removeChild(img);
          pool.byUrl[url] = img;
        }
      }
    }
    return pool;
  }
  const slots = st.slots;
  if (!slots) return pool;
  const cells = grid.querySelectorAll(".quirks-tile");
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const idx = parseInt(cell.dataset.index, 10);
    if (isNaN(idx)) continue;
    const url = slots[idx];
    if (!url) continue;
    if (idx === 0 && st.firstCellBrand) {
      if (!pool.pblo) {
        const p = cell.querySelector(".quirks-tile__brand-pblo");
        if (p?.parentNode) {
          p.parentNode.removeChild(p);
          pool.pblo = p;
        }
      }
      const bimg = cell.querySelector(".quirks-tile__img");
      if (bimg?.parentNode) {
        bimg.parentNode.removeChild(bimg);
        pool.byUrl[url] = bimg;
      }
      continue;
    }
    const img = cell.querySelector(".quirks-tile__img");
    if (img?.parentNode) {
      img.parentNode.removeChild(img);
      pool.byUrl[url] = img;
    }
  }
  return pool;
}

function quirksTakePooledImg(pool, url) {
  if (!pool?.byUrl || !url) return null;
  const el = pool.byUrl[url];
  if (el) delete pool.byUrl[url];
  return el;
}

function quirksTakePooledPblo(pool) {
  if (!pool?.pblo) return null;
  const p = pool.pblo;
  pool.pblo = null;
  return p;
}

function quirksDrainUnusedDomPool(pool) {
  if (!pool) return;
  if (pool.byUrl) {
    for (const k in pool.byUrl) {
      if (Object.prototype.hasOwnProperty.call(pool.byUrl, k)) {
        quirksReleaseImageElement(pool.byUrl[k]);
      }
    }
    pool.byUrl = {};
  }
  if (pool.pblo) {
    quirksReleaseImageElement(pool.pblo);
    pool.pblo = null;
  }
}

function quirksCapturePreviewTileRectsForFlip() {
  const grid = document.getElementById("quirks-preview-grid");
  const map = {};
  if (!grid || !quirksEditorState) return map;
  const st = quirksEditorState;
  const cells = grid.querySelectorAll(".quirks-tile");
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const key = quirksFlipKeyForCell(st, cell);
    if (!key) continue;
    map[key] = cell.getBoundingClientRect();
  }
  return map;
}

function quirksAnimatePreviewGridFlip(oldRectsMap) {
  const grid = document.getElementById("quirks-preview-grid");
  if (!grid || !quirksEditorState) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  if (!oldRectsMap || typeof oldRectsMap !== "object") return;
  const st = quirksEditorState;
  const cells = grid.querySelectorAll(".quirks-tile");
  const flipItems = [];
  const fadeIn = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const key = quirksFlipKeyForCell(st, cell);
    if (!key) continue;
    const oldR = oldRectsMap[key];
    const neu = cell.getBoundingClientRect();
    if (!oldR) {
      cell.classList.add("quirks-tile--shuffle-in");
      cell.style.opacity = "0";
      cell.style.transform = "scale(0.96)";
      cell.style.transition = "none";
      fadeIn.push(cell);
      continue;
    }
    const dx = oldR.left - neu.left;
    const dy = oldR.top - neu.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    flipItems.push({ cell, dx, dy, dist2: dx * dx + dy * dy });
  }
  flipItems.sort((a, b) => b.dist2 - a.dist2);
  for (let i = 0; i < flipItems.length; i++) {
    const it = flipItems[i];
    it.cell.style.transform = `translate(${it.dx}px, ${it.dy}px)`;
    it.cell.style.transition = "none";
    it.cell.classList.add("quirks-tile--reordering");
  }
  void grid.offsetHeight;
  const durMs = 460;
  const staggerMs = 11;
  const maxStagger = 380;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ease = "cubic-bezier(0.25, 0.82, 0.2, 1)";
      for (let i = 0; i < flipItems.length; i++) {
        const c = flipItems[i].cell;
        const delay = Math.min(i * staggerMs, maxStagger);
        c.style.transition = `transform ${durMs}ms ${ease} ${delay}ms`;
        c.style.transform = "";
      }
      const cleaned = new WeakSet();
      function finishFlip(c) {
        if (!c || cleaned.has(c)) return;
        cleaned.add(c);
        c.style.transition = "";
        c.style.transitionDelay = "";
        c.style.transform = "";
        c.classList.remove("quirks-tile--reordering");
      }
      for (let t = 0; t < flipItems.length; t++) {
        flipItems[t].cell.addEventListener(
          "transitionend",
          (ev) => {
            if (ev.propertyName !== "transform") return;
            finishFlip(ev.currentTarget);
          },
          { once: true }
        );
      }
      window.setTimeout(() => {
        for (let t = 0; t < flipItems.length; t++) {
          finishFlip(flipItems[t].cell);
        }
      }, durMs + maxStagger + 80);

      if (fadeIn.length > 0) {
        requestAnimationFrame(() => {
          const fe = "cubic-bezier(0.25, 0.82, 0.35, 1)";
          for (let fi = 0; fi < fadeIn.length; fi++) {
            const fc = fadeIn[fi];
            const fiDelay = Math.min(fi * 18, 220);
            fc.style.transition =
              `opacity 0.38s ${fe} ${fiDelay}ms, transform 0.42s ${fe} ${fiDelay}ms`;
            fc.style.opacity = "1";
            fc.style.transform = "";
          }
          window.setTimeout(() => {
            for (let fi = 0; fi < fadeIn.length; fi++) {
              const fcc = fadeIn[fi];
              fcc.style.transition = "";
              fcc.style.transitionDelay = "";
              fcc.classList.remove("quirks-tile--shuffle-in");
            }
          }, 520);
        });
      }
    });
  });
}

function quirksSwapPreviewTileContents(i, j) {
  const grid = document.getElementById("quirks-preview-grid");
  if (!grid || !quirksEditorState || quirksEditorState.mode !== "flat") {
    return;
  }
  if (quirksEditorState.firstCellBrand && (i === 0 || j === 0)) return;
  const cellI = grid.querySelector(`.quirks-tile[data-index="${i}"]`);
  const cellJ = grid.querySelector(`.quirks-tile[data-index="${j}"]`);
  if (!cellI || !cellJ) return;
  const imgI = cellI.querySelector(".quirks-tile__img");
  const imgJ = cellJ.querySelector(".quirks-tile__img");
  if (imgI) cellI.removeChild(imgI);
  if (imgJ) cellJ.removeChild(imgJ);
  if (imgJ) cellI.appendChild(imgJ);
  if (imgI) cellJ.appendChild(imgI);
  quirksSetTileEmptyClass(cellI, !!cellI.querySelector(".quirks-tile__img"));
  quirksSetTileEmptyClass(cellJ, !!cellJ.querySelector(".quirks-tile__img"));
}

function renderQuirksPreviewGrid(domPool) {
  if (!quirksEditorState) return;
  const el = document.getElementById("quirks-preview-grid");
  if (!el) return;
  const pool =
    domPool && typeof domPool === "object"
      ? domPool
      : { pblo: null, byUrl: {} };
  if (!pool.byUrl) pool.byUrl = {};
  const st = quirksEditorState;
  el.style.gridTemplateColumns = `repeat(${st.cols}, 1fr)`;
  el.innerHTML = "";
  if (st.mode === "grouped") {
    let slotCounter = 0;
    for (let r = 0; r < st.packed.length; r++) {
      const row = st.packed[r];
      for (let c = 0; c < row.length; c++) {
        const unit = row[c];
        const uIdx = st.units.indexOf(unit);
        const cell = document.createElement("div");
        cell.className = "quirks-tile";
        if (unit.width === 2) cell.classList.add("quirks-tile--span2");
        else if (unit.width === 3) cell.classList.add("quirks-tile--span3");
        cell.dataset.unitIndex = String(uIdx);
        const loadEl = document.createElement("span");
        loadEl.className = "quirks-tile__loading";
        loadEl.setAttribute("aria-hidden", "true");
        cell.appendChild(loadEl);
        const strip = document.createElement("div");
        strip.className = "quirks-tile__strip";
        for (let si = 0; si < unit.items.length; si++) {
          const item = unit.items[si];
          const url = quirksProxyKidCdnForCanvas(item.image);
          let img = quirksTakePooledImg(pool, url);
          if (!img) {
            img = document.createElement("img");
            img.className = "quirks-tile__img";
            img.alt = "";
            quirksBindGridImage(
              img,
              url,
              slotCounter++,
              quirksR2MetaForGridItem(item)
            );
          } else {
            img.className = "quirks-tile__img";
            img.alt = "";
            quirksBindGridImage(
              img,
              url,
              slotCounter++,
              quirksR2MetaForGridItem(item)
            );
          }
          img.draggable = true;
          strip.appendChild(img);
        }
        cell.appendChild(strip);
        quirksSetTileEmptyClass(cell, unit.items.length > 0);
        el.appendChild(cell);
      }
    }
  } else {
    for (let i = 0; i < st.slots.length; i++) {
      const cell = document.createElement("div");
      cell.className = "quirks-tile";
      cell.dataset.index = String(i);
      const url = st.slots[i];
      if (url) {
        const loadEl = document.createElement("span");
        loadEl.className = "quirks-tile__loading";
        loadEl.setAttribute("aria-hidden", "true");
        cell.appendChild(loadEl);
        if (quirksPublicBrandingBasename(url) === "quirkieslogo.png") {
          cell.classList.add("quirks-tile--brand");
        }
        let img = quirksTakePooledImg(pool, url);
        if (!img) {
          img = document.createElement("img");
          img.className = "quirks-tile__img";
          img.alt = "";
          quirksBindGridImage(
            img,
            url,
            i,
            st.slotR2Metas && st.slotR2Metas[i]
          );
        } else {
          img.className = "quirks-tile__img";
          img.alt = "";
          quirksBindGridImage(
            img,
            url,
            i,
            st.slotR2Metas && st.slotR2Metas[i]
          );
        }
        img.draggable = true;
        cell.appendChild(img);
      } else {
        cell.classList.add("quirks-tile--empty");
      }
      quirksSetTileEmptyClass(cell, !!cell.querySelector(".quirks-tile__img"));
      el.appendChild(cell);
    }
  }
  quirksDrainUnusedDomPool(pool);
  const stage = document.querySelector(".quirks-preview-stage");
  if (stage) {
    stage.style.setProperty("--quirks-grid-cols", String(st.cols));
  }
  quirksSyncCollectionLogoButton();
  quirksRenderBrandOverlay();
}

function populateQuirksTraitSelect() {
  const sel = document.getElementById("quirks-trait-sort");
  if (!sel || !quirksWalletData) return;
  const wantQ = document.getElementById("quirks-opt-quirkies")?.checked;
  const wantKid = document.getElementById("quirks-opt-quirkkids")?.checked;
  const wantQl = document.getElementById("quirks-opt-quirklings")?.checked;
  const wantIx = document.getElementById("quirks-opt-inx")?.checked;
  const q = normalizeWalletNftList(quirksWalletData.quirkies);
  const ql = normalizeWalletNftList(quirksWalletData.quirklings);
  const ix = normalizeWalletNftList(quirksWalletData.inx);
  const pieces = [];
  if (wantQ) pieces.push(...q);
  if (wantKid) pieces.push(...q);
  if (wantQl) pieces.push(...ql);
  if (wantIx) pieces.push(...ix);
  const merged = collectMergedTraitOptions(pieces);
  const keep = sel.value;
  sel.innerHTML = "";
  const randOpt = document.createElement("option");
  randOpt.value = "random";
  randOpt.textContent = "Random order";
  sel.appendChild(randOpt);
  for (let t = 0; t < merged.length; t++) {
    const o = document.createElement("option");
    o.value = "trait:" + merged[t].canonical;
    o.textContent = quirksFormatTraitLabel(merged[t].label);
    sel.appendChild(o);
  }
  let ok = false;
  for (let ti = 0; ti < sel.options.length; ti++) {
    if (sel.options[ti].value === keep) {
      ok = true;
      break;
    }
  }
  sel.value = ok ? keep : "random";
}

function quirksNormalizeWalletCacheKey(cacheKey) {
  const parts = String(cacheKey || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[a-fA-F0-9]{40}$/.test(s));
  return [...new Set(parts)].sort().join(",");
}

function quirksWalletApiUrlFromCacheKey(cacheKey) {
  const norm = quirksNormalizeWalletCacheKey(cacheKey);
  if (!norm) return null;
  const params = new URLSearchParams();
  for (const p of norm.split(",")) {
    params.append("address", p);
  }
  return apiUrl("/api/wallet?" + params.toString());
}

function quirksCacheKeyFromWalletJson(data) {
  if (!data) return "";
  if (data.wallets && Array.isArray(data.wallets) && data.wallets.length) {
    return quirksNormalizeWalletCacheKey(data.wallets.join(","));
  }
  return quirksNormalizeWalletCacheKey(data.wallet || "");
}

function quirksRefreshWalletInBackground(cacheKey) {
  const url = quirksWalletApiUrlFromCacheKey(cacheKey);
  if (!url) return;
  const want = quirksNormalizeWalletCacheKey(cacheKey);
  fetch(url)
    .then((res) => res.text())
    .then((text) => {
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }
      if (!data || data.error) return;
      if (quirksCacheKeyFromWalletJson(data) !== want) return;
      quirksWalletData = data;
      try {
        window.__quirksWalletPayload = data;
        window.__quirksWalletPayloadAddress = want;
      } catch {
        /* ignore */
      }
      populateQuirksTraitSelect();
    })
    .catch(() => {});
}

async function openQuirksModal() {
  const results = document.getElementById("wallet-results");
  const raw =
    results?.getAttribute("data-wallets")?.trim() ||
    results?.getAttribute("data-last-wallet")?.trim() ||
    "";
  const cacheKey = quirksNormalizeWalletCacheKey(raw);
  if (!cacheKey) {
    return;
  }
  resetQuirksModalOutput();
  const cached =
    typeof window !== "undefined" &&
    window.__quirksWalletPayload &&
    window.__quirksWalletPayloadAddress === cacheKey;

  if (cached) {
    quirksWalletData = window.__quirksWalletPayload;
    populateQuirksTraitSelect();
    const cq = document.getElementById("quirks-opt-quirkies");
    const cqk = document.getElementById("quirks-opt-quirkkids");
    const cql = document.getElementById("quirks-opt-quirklings");
    const cix = document.getElementById("quirks-opt-inx");
    if (cq) cq.checked = false;
    if (cqk) cqk.checked = false;
    if (cql) cql.checked = false;
    if (cix) cix.checked = false;
    const layoutGrouped = document.getElementById("quirks-layout-grouped");
    if (layoutGrouped) layoutGrouped.checked = true;
    quirksSyncGenerateButtonState();
    setQuirksModalOpen(true);
    quirksRefreshWalletInBackground(cacheKey);
    return;
  }

  setGlobalLoadingQuirks(true);
  try {
    const fetchUrl = quirksWalletApiUrlFromCacheKey(cacheKey);
    if (!fetchUrl) throw new Error("Invalid wallet cache key.");
    const res = await fetch(fetchUrl);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server returned non-JSON.");
    }
    if (!res.ok) {
      let errMsg = (data && data.error) || text || "Request failed.";
      if (data?.detail) errMsg += " — " + data.detail;
      throw new Error(errMsg);
    }
    quirksWalletData = data;
    try {
      window.__quirksWalletPayload = data;
      window.__quirksWalletPayloadAddress = quirksCacheKeyFromWalletJson(data);
    } catch {
      /* ignore */
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errEl = document.getElementById("quirks-error");
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add("is-visible");
    }
    quirksWalletData = null;
    setGlobalLoadingQuirks(false);
    setQuirksModalOpen(true);
    return;
  } finally {
    setGlobalLoadingQuirks(false);
  }
  populateQuirksTraitSelect();
  const cq = document.getElementById("quirks-opt-quirkies");
  const cqk = document.getElementById("quirks-opt-quirkkids");
  const cql = document.getElementById("quirks-opt-quirklings");
  const cix = document.getElementById("quirks-opt-inx");
  if (cq) cq.checked = false;
  if (cqk) cqk.checked = false;
  if (cql) cql.checked = false;
  if (cix) cix.checked = false;
  const layoutGrouped = document.getElementById("quirks-layout-grouped");
  if (layoutGrouped) layoutGrouped.checked = true;
  quirksSyncGenerateButtonState();
  setQuirksModalOpen(true);
}

async function runQuirksGenerate() {
  const errEl = document.getElementById("quirks-error");
  if (!quirksWalletData) {
    if (errEl) {
      errEl.textContent = "Load a wallet first.";
      errEl.classList.add("is-visible");
    }
    return;
  }
  const wantQ = document.getElementById("quirks-opt-quirkies")?.checked;
  const wantKid = document.getElementById("quirks-opt-quirkkids")?.checked;
  const wantQl = document.getElementById("quirks-opt-quirklings")?.checked;
  const wantIx = document.getElementById("quirks-opt-inx")?.checked;
  if (!wantQ && !wantKid && !wantQl && !wantIx) {
    if (errEl) {
      errEl.textContent = "Select at least one collection.";
      errEl.classList.add("is-visible");
    }
    return;
  }
  const items = quirksBuildItemList(
    quirksWalletData,
    wantQ,
    wantKid,
    wantQl,
    wantIx,
    document.getElementById("quirks-trait-sort")?.value || "random"
  );
  if (items.length === 0) {
    if (errEl) {
      errEl.textContent = "No image URLs in that selection.";
      errEl.classList.add("is-visible");
    }
    return;
  }
  if (errEl) {
    errEl.classList.remove("is-visible");
    errEl.textContent = "";
  }
  quirksLastSortedGridItems = items.slice();
  const logoBtnPre = document.getElementById("quirks-add-collection-logo-btn");
  if (logoBtnPre) logoBtnPre.setAttribute("aria-pressed", "false");
  quirksRebuildSlotsFromSorted(items);
  const previewWrap = document.getElementById("quirks-preview-wrap");
  if (previewWrap) previewWrap.classList.remove("hidden");
  quirksSetDownloadButtonReady(false);
  quirksSetGifButtonReady(false);
  renderQuirksPreviewGrid();
  void (async () => {
    try {
      const gridForPreview = document.getElementById("quirks-preview-grid");
      await quirksAwaitQuirksGridPreflights(gridForPreview);
      await quirksAwaitPreviewGridLoads(gridForPreview);
      // Export must run after preview tiles have painted (or settled): session win
      // URLs and stable loads align with what the user sees; otherwise parallel
      // canvas Image() loads can race ahead and leave white cells (often QuirkKids).
      await quirksWaitForPreviewGridImages();
      await quirksRefreshPreviewFromSlots();
      quirksSetDownloadButtonReady(true);
      quirksSetGifButtonReady(true);
    } catch {
      quirksSetDownloadButtonReady(false);
      quirksSetGifButtonReady(false);
    }
  })();
}

function injectQuirksOpenButton() {
  const fa = document.getElementById("quirks-grid-actions");
  if (!fa || document.getElementById("quirks-open-btn")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.id = "quirks-open-btn";
  b.className = "btn-secondary quirks-open-btn";
  b.textContent = "FLECKS GRID BUILDER";
  fa.appendChild(b);
  b.addEventListener("click", (ev) => {
    ev.preventDefault();
    openQuirksModal();
  });
}

function setupQuirksBuilderUi() {
  const results = document.getElementById("wallet-results");
  if (results) {
    const obs = new MutationObserver(() => injectQuirksOpenButton());
    obs.observe(results, { childList: true, subtree: true });
    injectQuirksOpenButton();
  }
  const modal = document.getElementById("quirks-modal");
  const closeBtn = document.getElementById("quirks-modal-close");
  const backdrop = document.getElementById("quirks-modal-backdrop");
  const genBtn = document.getElementById("quirks-generate-btn");
  function closeModal() {
    setQuirksModalOpen(false);
    resetQuirksModalOutput();
  }
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);
  if (genBtn) genBtn.addEventListener("click", runQuirksGenerate);
  function onQuirksCollectionChange() {
    quirksSyncGenerateButtonState();
    if (quirksWalletData) populateQuirksTraitSelect();
    if (
      quirksWalletData &&
      quirksEditorState &&
      quirksIsTokenSearchWalletSession()
    ) {
      void runQuirksGenerate();
    } else if (quirksEditorState) {
      quirksRenderBrandOverlay();
    }
  }
  [
    "quirks-opt-quirkies",
    "quirks-opt-quirkkids",
    "quirks-opt-quirklings",
    "quirks-opt-inx",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", onQuirksCollectionChange);
  });
  document.querySelectorAll('input[name="quirks-grid-layout"]').forEach((el) => {
    el.addEventListener("change", quirksSyncGenerateButtonState);
  });
  const traitSel = document.getElementById("quirks-trait-sort");
  if (traitSel) {
    traitSel.addEventListener("change", () => {
      if (!quirksEditorState || !quirksWalletData) return;
      const wantQ = document.getElementById("quirks-opt-quirkies")?.checked;
      const wantKid = document.getElementById("quirks-opt-quirkkids")?.checked;
      const wantQl = document.getElementById("quirks-opt-quirklings")?.checked;
      const wantIx = document.getElementById("quirks-opt-inx")?.checked;
      const items = quirksBuildItemList(
        quirksWalletData,
        wantQ,
        wantKid,
        wantQl,
        wantIx,
        traitSel.value || "random"
      );
      if (items.length === 0) return;
      quirksLastSortedGridItems = items.slice();
      const oldRects = quirksCapturePreviewTileRectsForFlip();
      const domPool = quirksHarvestPreviewDomPool();
      quirksRebuildSlotsFromSorted(items);
      quirksSetDownloadButtonReady(false);
      quirksSetGifButtonReady(false);
      renderQuirksPreviewGrid(domPool);
      quirksAnimatePreviewGridFlip(oldRects);
      const gridEl = document.getElementById("quirks-preview-grid");
      void (async () => {
        try {
          await quirksAwaitQuirksGridPreflights(gridEl);
          await quirksAwaitPreviewGridLoads(gridEl);
          await quirksWaitForPreviewGridImages();
          await quirksRefreshPreviewFromSlots();
          quirksSetDownloadButtonReady(true);
          quirksSetGifButtonReady(true);
        } catch {
          quirksSetDownloadButtonReady(false);
          quirksSetGifButtonReady(false);
        }
      })();
    });
  }
  const previewGrid = document.getElementById("quirks-preview-grid");
  if (previewGrid) {
    previewGrid.addEventListener("dragstart", (e) => {
      const cell = e.target.closest(".quirks-tile");
      if (!cell || !previewGrid.contains(cell)) return;
      const st = quirksEditorState;
      if (!st) {
        e.preventDefault();
        return;
      }
      if (st.mode === "grouped") {
        const u = parseInt(cell.dataset.unitIndex, 10);
        if (isNaN(u) || !st.units[u]) {
          e.preventDefault();
          return;
        }
        quirksDnDGroupedPayload = null;
        quirksDnDFromIndex = null;
        const img =
          e.target instanceof HTMLImageElement &&
          e.target.classList.contains("quirks-tile__img")
            ? e.target
            : e.target.closest("img.quirks-tile__img");
        if (img) {
          const strip = img.closest(".quirks-tile__strip");
          const imgs = strip
            ? Array.from(strip.querySelectorAll("img.quirks-tile__img"))
            : [];
          const sub = imgs.indexOf(img);
          const unit = st.units[u];
          if (
            sub >= 0 &&
            unit &&
            Array.isArray(unit.items) &&
            sub < unit.items.length
          ) {
            quirksDnDGroupedPayload = { u, sub };
          }
        }
        if (!quirksDnDGroupedPayload) {
          quirksDnDFromIndex = u;
        }
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData(
            "text/plain",
            quirksDnDGroupedPayload
              ? "item:" + u + ":" + quirksDnDGroupedPayload.sub
              : String(u)
          );
        } catch {
          /* ignore */
        }
        cell.classList.add("quirks-tile--dragging");
        return;
      }
      quirksDnDGroupedPayload = null;
      const i = parseInt(cell.dataset.index, 10);
      if (isNaN(i) || !st.slots[i]) {
        e.preventDefault();
        return;
      }
      if (st.firstCellBrand && i === 0) {
        e.preventDefault();
        return;
      }
      quirksDnDFromIndex = i;
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", String(i));
      } catch {
        /* ignore */
      }
      cell.classList.add("quirks-tile--dragging");
    });
    previewGrid.addEventListener("dragend", (e) => {
      const cell = e.target.closest(".quirks-tile");
      if (cell) cell.classList.remove("quirks-tile--dragging");
      quirksDnDFromIndex = null;
      quirksDnDGroupedPayload = null;
    });
    previewGrid.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    previewGrid.addEventListener("drop", (e) => {
      e.preventDefault();
      const cell = e.target.closest(".quirks-tile");
      if (!cell || !previewGrid.contains(cell) || !quirksEditorState) return;
      const st = quirksEditorState;
      if (st.mode === "grouped") {
        const j = parseInt(cell.dataset.unitIndex, 10);
        if (isNaN(j) || !st.units[j]) return;
        if (quirksDnDGroupedPayload) {
          const from = quirksDnDGroupedPayload;
          const toImg =
            e.target instanceof HTMLImageElement &&
            e.target.classList.contains("quirks-tile__img")
              ? e.target
              : e.target.closest("img.quirks-tile__img");
          let subJ = 0;
          if (toImg) {
            const stripJ = toImg.closest(".quirks-tile__strip");
            const imgsJ = stripJ
              ? Array.from(stripJ.querySelectorAll("img.quirks-tile__img"))
              : [];
            const k = imgsJ.indexOf(toImg);
            if (k >= 0) subJ = k;
          }
          const uFrom = st.units[from.u];
          const uTo = st.units[j];
          if (
            !uFrom ||
            !uTo ||
            !Array.isArray(uFrom.items) ||
            !Array.isArray(uTo.items)
          ) {
            quirksDnDGroupedPayload = null;
            return;
          }
          if (from.sub < 0 || from.sub >= uFrom.items.length) {
            quirksDnDGroupedPayload = null;
            return;
          }
          if (subJ < 0) subJ = 0;
          if (subJ >= uTo.items.length) subJ = uTo.items.length - 1;
          if (from.u === j && from.sub === subJ) {
            quirksDnDGroupedPayload = null;
            return;
          }
          const tmpIt = uFrom.items[from.sub];
          uFrom.items[from.sub] = uTo.items[subJ];
          uTo.items[subJ] = tmpIt;
          quirksRepackGroupedUnits();
          quirksDnDGroupedPayload = null;
          quirksDnDFromIndex = null;
          renderQuirksPreviewGrid();
          quirksLastExportDataUrl = null;
          return;
        }
        const i = quirksDnDFromIndex;
        if (i == null || isNaN(j) || !st.units[j]) return;
        if (i === j) return;
        const tmp = st.units[i];
        st.units[i] = st.units[j];
        st.units[j] = tmp;
        quirksRepackGroupedUnits();
        quirksDnDFromIndex = null;
        renderQuirksPreviewGrid();
        quirksLastExportDataUrl = null;
        return;
      }
      const j = parseInt(cell.dataset.index, 10);
      const i = quirksDnDFromIndex;
      if (i == null || isNaN(j)) return;
      if (st.firstCellBrand && j === 0) return;
      if (i === j) return;
      const tmp = st.slots[i];
      st.slots[i] = st.slots[j];
      st.slots[j] = tmp;
      quirksDnDFromIndex = null;
      quirksSwapPreviewTileContents(i, j);
      quirksLastExportDataUrl = null;
    });
  }
  const retryMissing = document.getElementById("quirks-retry-missing-btn");
  if (retryMissing) {
    retryMissing.addEventListener("click", (ev) => {
      ev.preventDefault();
      const grid = document.getElementById("quirks-preview-grid");
      const NL = typeof window !== "undefined" ? window.NftImageLoader : null;
      if (NL && typeof NL.retryAllMissingNftImages === "function") {
        NL.retryAllMissingNftImages(grid || document.getElementById("quirks-modal"));
      }
    });
  }
  const dl = document.getElementById("quirks-download-btn");
  if (dl) {
    dl.addEventListener("click", () => {
      if (!quirksEditorState) return;
      function triggerDownload() {
        if (!quirksLastExportDataUrl) return;
        const a = document.createElement("a");
        a.href = quirksLastExportDataUrl;
        a.download = "quirks-flex.jpg";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      if (quirksLastExportDataUrl) {
        triggerDownload();
        return;
      }
      setGlobalLoadingQuirks(true);
      quirksWaitForPreviewGridImages()
        .then(() => quirksRefreshPreviewFromSlots())
        .then(triggerDownload)
        .finally(() => setGlobalLoadingQuirks(false));
    });
  }

  const gifBtn = document.getElementById("quirksExportGifBtn");
  const gifBackdrop = document.getElementById("quirks-gif-options-backdrop");
  const gifClose = document.getElementById("quirks-gif-options-close");
  const gifCancel = document.getElementById("quirks-gif-options-cancel");
  const gifConfirm = document.getElementById("quirks-gif-options-confirm");
  const gifMaxInput = document.getElementById("quirks-gif-options-max");
  const gifSpeed = document.getElementById("quirks-gif-options-speed");

  function closeGifOptions() {
    quirksSetGifOptionsModalOpen(false);
  }

  function openGifOptions() {
    if (!quirksEditorState) return;
    const ordered = quirksExportBuildOrderedUrls();
    if (gifMaxInput) {
      const auto = Math.min(QUIRKS_GIF_MAX_NFT_FRAMES, Math.max(1, ordered.length));
      gifMaxInput.value = String(auto);
    }
    const maxPick =
      parseInt(
        String(gifMaxInput?.value || QUIRKS_GIF_CONFIG.maxFrames),
        10
      ) || QUIRKS_GIF_CONFIG.maxFrames;
    const eff = quirksGifEffectiveNftFrameCount(ordered.length, maxPick);
    const sum = document.getElementById("quirks-gif-options-summary");
    if (sum) {
      sum.textContent =
        "Your grid has " +
        ordered.length +
        " NFT tiles. This will export " +
        eff +
        " NFT frames plus the opening brand frame and a closing CTA frame.";
    }
    const dur = document.getElementById("quirks-gif-options-duration");
    const delayMs = quirksGifSpeedPosToNftDelayMs(quirksGifLastSpeedPos);
    const finalMs = quirksGifFinalFrameMsEstimate(delayMs);
    const total = 1000 + eff * delayMs + finalMs;
    if (dur) dur.textContent = "Estimated length: " + quirksFormatGifSeconds(total);
    quirksSetGifOptionsModalOpen(true);
  }

  async function runGifExport(maxFrames, speedPos) {
    const ordered = quirksExportBuildOrderedUrls();
    const capped = quirksExportLimitFrames(
      ordered,
      Math.min(QUIRKS_GIF_MAX_NFT_FRAMES, Math.max(1, Math.floor(maxFrames)))
    );
    quirksExportSetProgress("");
    quirksSetGifModalOpen(true);
    quirksSetGifOptionsModalOpen(false);
    const delayMs = quirksGifSpeedPosToNftDelayMs(speedPos);
    let gif;
    try {
      if (typeof window.GIF !== "function") {
        throw new Error("GIF library not loaded.");
      }
      gif = new window.GIF({
        workers: 2,
        quality: QUIRKS_GIF_CONFIG.quality,
        repeat: 0,
        workerScript: quirksGetGifWorkerScriptUrl(),
        width: QUIRKS_GIF_CONFIG.size,
        height: QUIRKS_GIF_CONFIG.size,
      });
    } catch (e) {
      quirksSetGifModalOpen(false);
      quirksExportSetProgress("Could not start GIF export.");
      throw e;
    }

    gif.on("progress", (p) => {
      const pct = Math.round((p || 0) * 100);
      quirksExportSetProgress("Encoding GIF " + pct + "%");
    });

    gif.on("finished", (blob) => {
      quirksSetGifModalOpen(false);
      quirksExportSetProgress("");
      quirksGifDownloadBlob(blob, "quirks-flex.gif");
    });

    gif.on("abort", () => {
      quirksSetGifModalOpen(false);
      quirksExportSetProgress("");
    });

    try {
      const brandCanvas = await quirksExportCreateGifBrandTileCanvas(QUIRKS_GIF_CONFIG.size);
      quirksExportGifAddFrame(gif, brandCanvas, 1000);
      for (let i = 0; i < capped.length; i++) {
        const c = await quirksExportCreateGifFrameCanvas(capped[i], QUIRKS_GIF_CONFIG.size);
        quirksExportGifAddFrame(gif, c, delayMs);
        if ((i & 3) === 3) await new Promise((r) => setTimeout(r, 0));
      }
      const L = quirksExportGifBranding();
      const finalIdata = L.createFinalFrameImageData(
        QUIRKS_GIF_CONFIG.size,
        QUIRKS_GIF_CONFIG.size
      );
      const finalDelay =
        typeof L.finalFrameDelayMs === "function"
          ? L.finalFrameDelayMs(delayMs)
          : quirksGifFinalFrameMsEstimate(delayMs);
      gif.addFrame(finalIdata, { delay: finalDelay, copy: true });
    } catch (e) {
      quirksSetGifModalOpen(false);
      quirksExportSetProgress("GIF export failed.");
      throw e;
    }

    try {
      gif.render();
    } catch (e) {
      quirksSetGifModalOpen(false);
      quirksExportSetProgress("GIF export failed.");
      throw e;
    }
  }

  if (gifSpeed) {
    gifSpeed.addEventListener("input", () => {
      quirksGifLastSpeedPos = parseInt(String(gifSpeed.value), 10) || 50;
      const dur = document.getElementById("quirks-gif-options-duration");
      const ordered = quirksExportBuildOrderedUrls();
      const maxPick = parseInt(String(gifMaxInput?.value || QUIRKS_GIF_CONFIG.maxFrames), 10) || QUIRKS_GIF_CONFIG.maxFrames;
      const eff = quirksGifEffectiveNftFrameCount(ordered.length, maxPick);
      const delayMs = quirksGifSpeedPosToNftDelayMs(quirksGifLastSpeedPos);
      const finalMs = quirksGifFinalFrameMsEstimate(delayMs);
      const total = 1000 + eff * delayMs + finalMs;
      if (dur) dur.textContent = "Estimated length: " + quirksFormatGifSeconds(total);
    });
  }

  const collectionLogoBtn = document.getElementById("quirks-add-collection-logo-btn");
  if (collectionLogoBtn) {
    collectionLogoBtn.addEventListener("click", async () => {
      if (!quirksLastSortedGridItems || !quirksCollectionLogoToggleShows()) return;
      const next = collectionLogoBtn.getAttribute("aria-pressed") !== "true";
      collectionLogoBtn.setAttribute("aria-pressed", next ? "true" : "false");
      quirksSyncCollectionLogoButton();
      quirksRebuildSlotsFromSorted(quirksLastSortedGridItems);
      quirksSetDownloadButtonReady(false);
      quirksSetGifButtonReady(false);
      const domPool = quirksHarvestPreviewDomPool();
      renderQuirksPreviewGrid(domPool);
      const gridEl = document.getElementById("quirks-preview-grid");
      try {
        await quirksAwaitQuirksGridPreflights(gridEl);
        await quirksAwaitPreviewGridLoads(gridEl);
        await quirksWaitForPreviewGridImages();
        await quirksRefreshPreviewFromSlots();
        quirksSetDownloadButtonReady(true);
        quirksSetGifButtonReady(true);
      } catch {
        quirksSetDownloadButtonReady(false);
        quirksSetGifButtonReady(false);
      }
    });
  }

  if (gifBtn) gifBtn.addEventListener("click", (ev) => { ev.preventDefault(); openGifOptions(); });
  if (gifBackdrop) gifBackdrop.addEventListener("click", closeGifOptions);
  if (gifClose) gifClose.addEventListener("click", closeGifOptions);
  if (gifCancel) gifCancel.addEventListener("click", closeGifOptions);
  if (gifConfirm) {
    gifConfirm.addEventListener("click", () => {
      const maxFrames = parseInt(String(gifMaxInput?.value || QUIRKS_GIF_CONFIG.maxFrames), 10) || QUIRKS_GIF_CONFIG.maxFrames;
      const speedPos = parseInt(String(gifSpeed?.value || quirksGifLastSpeedPos), 10) || quirksGifLastSpeedPos;
      quirksGifLastSpeedPos = speedPos;
      void runGifExport(maxFrames, speedPos);
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const welcome = document.getElementById("welcome-modal");
    if (welcome && welcome.classList.contains("is-open")) return;
    const gifOpts = document.getElementById("quirks-gif-options-modal");
    if (gifOpts && !gifOpts.classList.contains("hidden")) {
      closeGifOptions();
      return;
    }
    if (modal?.classList.contains("is-open")) closeModal();
  });
}

function quirksWalletPayloadFromTokenLookup(apiData) {
  const tid = apiData.tokenId;
  const q = apiData.quirkie;
  const ql = apiData.quirking;
  const ix = apiData.inx;
  const quirkies = [];
  if (q && (q.image || q.kidImage)) {
    quirkies.push({
      tokenId: tid,
      image: q.image || null,
      kidImage: q.kidImage || null,
      traits: [],
    });
  }
  const quirklings = [];
  if (ql && ql.image) {
    quirklings.push({
      tokenId: tid,
      image: ql.image,
      traits: [],
    });
  }
  const inxList = [];
  if (ix && ix.image) {
    inxList.push({
      tokenId: tid,
      image: ix.image,
      traits: [],
    });
  }
  return {
    wallet: QUIRKS_TOKEN_SEARCH_WALLET_ADDR,
    pairMaxTokenId: apiData.pairMaxTokenId,
    contracts: apiData.contracts || {},
    quirkies,
    quirklings,
    inx: inxList,
    matched: [],
    missingQuirkie: [],
    loneQuirkies: [],
    quirklingsHigh: [],
    inxOnly: [],
  };
}

function quirksTokenLookupHasGridImages(apiData) {
  if (!apiData) return false;
  const q = apiData.quirkie;
  const ql = apiData.quirking;
  const ix = apiData.inx;
  return !!(
    (q && q.image) ||
    (q && q.kidImage) ||
    (ql && ql.image) ||
    (ix && ix.image)
  );
}

export function quirksOpenFlecksFromTokenSearch(apiData) {
  if (!quirksTokenLookupHasGridImages(apiData)) {
    const errEl = document.getElementById("quirks-error");
    if (errEl) {
      errEl.textContent =
        "No images available for this token to build a grid.";
      errEl.classList.add("is-visible");
    }
    setQuirksModalOpen(true);
    return;
  }
  const payload = quirksWalletPayloadFromTokenLookup(apiData);
  quirksWalletData = payload;
  try {
    window.__quirksWalletPayload = payload;
    window.__quirksWalletPayloadAddress = QUIRKS_TOKEN_SEARCH_WALLET_ADDR;
    window.__quirksWalletContracts = payload.contracts || {};
  } catch {
    /* ignore */
  }
  resetQuirksModalOutput();
  populateQuirksTraitSelect();
  const cq = document.getElementById("quirks-opt-quirkies");
  const cqk = document.getElementById("quirks-opt-quirkkids");
  const cql = document.getElementById("quirks-opt-quirklings");
  const cix = document.getElementById("quirks-opt-inx");
  const q = apiData.quirkie;
  const ql = apiData.quirking;
  const ix = apiData.inx;
  if (cq) cq.checked = !!(q && q.image);
  if (cqk) cqk.checked = !!(q && q.kidImage);
  if (cql) cql.checked = !!(ql && ql.image);
  if (cix) cix.checked = !!(ix && ix.image);
  const layoutGrouped = document.getElementById("quirks-layout-grouped");
  if (layoutGrouped) layoutGrouped.checked = true;
  quirksSyncGenerateButtonState();
  const errEl = document.getElementById("quirks-error");
  if (errEl) {
    errEl.classList.remove("is-visible");
    errEl.textContent = "";
  }
  setQuirksModalOpen(true);
  void runQuirksGenerate();
}

window.__quirksInjectGridButton = injectQuirksOpenButton;
window.__quirksOpenFlecksFromTokenSearch = quirksOpenFlecksFromTokenSearch;
setupQuirksBuilderUi();
