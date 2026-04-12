/**
 * Quirks Builder — isolated clone of Flex grid UX for Quirkies / Quirklings / INX.
 * Pairing rules live in ./quirksPairing.js. Add ?quirksFlat=1 to skip pairing (API smoke test).
 */
import {
  pairQuirksWalletData,
  shuffleQuirksPairing,
  sortPairingByQuirkieTrait,
  buildQuirksGridSequence,
  collectQuirksItemsFlat,
} from "./quirksPairing.js";

const WORKER_ORIGIN = "";

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

/** QuirkKid S3 has no CORS; same-origin /api/img keeps canvas export working on production. */
function quirksProxyKidCdnForCanvas(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
  const s = rawUrl.trim();
  if (s.indexOf("/api/img") === 0) return s;
  try {
    const h = new URL(s).hostname.toLowerCase();
    if (h === "quirkids-images.s3.ap-southeast-2.amazonaws.com") {
      return apiUrl("/api/img?url=" + encodeURIComponent(s));
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

let quirksWalletData = null;
let quirksEditorState = null;
let quirksLastExportDataUrl = null;
let quirksDnDFromIndex = null;

function quirksUseFlatMode() {
  try {
    return new URLSearchParams(window.location.search).get("quirksFlat") === "1";
  } catch {
    return false;
  }
}

function normalizeMediaUrl(u) {
  if (!u || typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  if (s.indexOf("/api/img") === 0) return s;
  if (s.indexOf("ipfs://") === 0) {
    const path = s.slice(7).replace(/^ipfs\//, "").replace(/^\/+/, "");
    return "https://nftstorage.link/ipfs/" + path;
  }
  if (s.indexOf("ar://") === 0) {
    return "https://arweave.net/" + s.slice(5);
  }
  return s;
}

function buildImageCandidates(raw) {
  const primary = normalizeMediaUrl(raw);
  if (!primary) return { primary: null, fallbacks: [] };
  if (primary.indexOf("/api/img") === 0) {
    return { primary, fallbacks: [] };
  }
  const list = [primary];
  const pos = primary.indexOf("/ipfs/");
  if (pos !== -1) {
    const after = primary.slice(pos + 6);
    list.push("https://w3s.link/ipfs/" + after);
    list.push("https://nftstorage.link/ipfs/" + after);
    list.push("https://cloudflare-ipfs.com/ipfs/" + after);
    list.push("https://dweb.link/ipfs/" + after);
    list.push("https://ipfs.io/ipfs/" + after);
  }
  const seen = {};
  const uniq = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] && !seen[list[i]]) {
      seen[list[i]] = 1;
      uniq.push(list[i]);
    }
  }
  return { primary: uniq[0], fallbacks: uniq.slice(1) };
}

function getQuirksGridBrandImageUrl() {
  try {
    return new URL("quirkieslogo.png", window.location.href).href;
  } catch {
    return "quirkieslogo.png";
  }
}

function getQuirksPbloImageUrl() {
  try {
    return new URL("pblo.png", window.location.href).href;
  } catch {
    return "pblo.png";
  }
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

function collectTraitTypesFromItems(items) {
  const seen = {};
  const list = [];
  for (let i = 0; i < items.length; i++) {
    const traits = items[i].traits || [];
    for (let j = 0; j < traits.length; j++) {
      const tt = traits[j].trait_type || traits[j].traitType;
      if (tt && !seen[tt]) {
        seen[tt] = true;
        list.push(String(tt));
      }
    }
  }
  list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return list;
}

function quirksFormatTraitLabel(raw) {
  if (raw == null || typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function quirksTraitValue(traits, traitType) {
  if (!traits || !traitType) return "";
  for (let j = 0; j < traits.length; j++) {
    const tt = traits[j].trait_type || traits[j].traitType;
    if (tt === traitType) {
      const v = traits[j].value;
      return v != null ? String(v) : "";
    }
  }
  return "";
}

function quirksTraitValueForSort(item, traitKey, walletData) {
  let v = quirksTraitValue(item.traits, traitKey);
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
        return quirksTraitValue(ogs[ti].traits, traitKey);
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

function quirksRebuildSlotsFromSorted(sortedItems) {
  const brand = getQuirksGridBrandImageUrl();
  const urls = [brand].concat(
    sortedItems.map((x) => quirksProxyKidCdnForCanvas(x.image))
  );
  const g = quirksComputeGrid(urls.length);
  const cells = g.cols * g.rows;
  const slots = [];
  for (let i = 0; i < cells; i++) {
    slots.push(i < urls.length ? urls[i] : null);
  }
  quirksEditorState = { slots, cols: g.cols, rows: g.rows };
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
  if (grid) grid.innerHTML = "";
  quirksEditorState = null;
  quirksLastExportDataUrl = null;
  quirksDnDFromIndex = null;
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

function quirksLoadImageWithFallbacks(rawUrl) {
  return new Promise((resolve) => {
    if (!rawUrl) {
      resolve(null);
      return;
    }
    const c = buildImageCandidates(String(rawUrl));
    const tryList = [];
    if (c.primary) tryList.push(c.primary);
    for (let fi = 0; fi < c.fallbacks.length; fi++) {
      tryList.push(c.fallbacks[fi]);
    }
    let idx = 0;
    function tryNext() {
      if (idx >= tryList.length) {
        resolve(null);
        return;
      }
      const u = tryList[idx++];
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => tryNext();
      img.src = u;
    }
    tryNext();
  });
}

function quirksExportCellRect(x, y, w, h) {
  const bleed = 0.01;
  const ox = w * (bleed / 2);
  const oy = h * (bleed / 2);
  return { x: x - ox, y: y - oy, w: w * (1 + bleed), h: h * (1 + bleed) };
}

function quirksDrawCover(ctx, img, x, y, w, h, cellBackdrop) {
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
    const scale = Math.max(w / iw, h / ih);
    const tw = iw * scale;
    const th = ih * scale;
    ctx.drawImage(img, x + (w - tw) / 2, y + (h - th) / 2, tw, th);
  }
  ctx.restore();
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
    const px = cellX + (cw - drawW) / 2;
    ctx.drawImage(pbloImg, px, cellY, drawW, drawH);
  }
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

function quirksExportCanvasSizeCandidates(slotsLen) {
  const n = typeof slotsLen === "number" ? slotsLen : 0;
  if (quirksIsMemoryConstrainedDevice()) {
    if (n > 49) return [1024, 896, 768];
    if (n > 36) return [1280, 1024, 896];
    if (n > 24) return [1536, 1280, 1024];
    return [QUIRKS_MOBILE_EXPORT_MAX, 1536, 1024];
  }
  return [QUIRKS_CANVAS_SIZE, QUIRKS_CANVAS_SIZE_FALLBACK, 2048];
}

async function quirksExportGridDrawCellsSequential(ctx, slots, cols, rows, cw, ch) {
  const cells = cols * rows;
  for (let i = 0; i < cells; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cw;
    const y = row * ch;
    const cellR = quirksExportCellRect(x, y, cw, ch);
    const slotUrl = slots[i];
    if (i === 0) {
      const pbloM = await quirksLoadImageWithFallbacks(getQuirksPbloImageUrl());
      let bIm = null;
      if (slotUrl) bIm = await quirksLoadImageWithFallbacks(slotUrl);
      quirksDrawBrandCellExport(ctx, bIm, pbloM, cellR.x, cellR.y, cellR.w, cellR.h);
      quirksReleaseImageElement(pbloM);
      quirksReleaseImageElement(bIm);
    } else {
      const bg = "#ffffff";
      let img = null;
      if (slotUrl) img = await quirksLoadImageWithFallbacks(slotUrl);
      quirksDrawCover(ctx, img, cellR.x, cellR.y, cellR.w, cellR.h, bg);
      quirksReleaseImageElement(img);
    }
    if ((i & 3) === 3) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

async function quirksBuildGridCanvasFromSlots(slots, cols, rows) {
  const cells = cols * rows;
  const sizeTry = quirksExportCanvasSizeCandidates(slots.length);
  let canvas = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  for (let ti = 0; ti < sizeTry.length; ti++) {
    W = sizeTry[ti];
    H = sizeTry[ti];
    canvas = quirksCreateExportCanvas(W, H);
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
  const cw = W / cols;
  const ch = H / rows;
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
    await quirksExportGridDrawCellsSequential(ctx, slots, cols, rows, cw, ch);
  } else {
    const unique = [];
    const seen = {};
    for (let i = 0; i < slots.length; i++) {
      const u = slots[i];
      if (u && !seen[u]) {
        seen[u] = true;
        unique.push(u);
      }
    }
    const loadedMap = {};
    await Promise.all(
      unique.map((url) =>
        quirksLoadImageWithFallbacks(url).then((im) => {
          loadedMap[url] = im;
        })
      )
    );
    const loadedSlots = [];
    for (let i = 0; i < slots.length; i++) {
      const su = slots[i];
      loadedSlots.push(su ? loadedMap[su] || null : null);
    }
    const pbloD = await quirksLoadImageWithFallbacks(getQuirksPbloImageUrl());
    for (let i = 0; i < cells; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cw;
      const y = row * ch;
      const cellR2 = quirksExportCellRect(x, y, cw, ch);
      if (i === 0) {
        quirksDrawBrandCellExport(
          ctx,
          loadedSlots[0] || null,
          pbloD,
          cellR2.x,
          cellR2.y,
          cellR2.w,
          cellR2.h
        );
      } else {
        const bg = "#ffffff";
        quirksDrawCover(
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
    quirksReleaseImageElement(pbloD);
  }
  return canvas;
}

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
      if (im.complete && im.src) oneDone();
      else {
        im.addEventListener("load", oneDone, { once: true });
        im.addEventListener("error", oneDone, { once: true });
      }
    }
  });
}

function quirksRefreshPreviewFromSlots() {
  if (!quirksEditorState) return Promise.resolve();
  return quirksBuildGridCanvasFromSlots(
    quirksEditorState.slots,
    quirksEditorState.cols,
    quirksEditorState.rows
  )
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
  if (!grid || !quirksEditorState?.slots) return pool;
  const slots = quirksEditorState.slots;
  const cells = grid.querySelectorAll(".quirks-tile");
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const idx = parseInt(cell.dataset.index, 10);
    if (isNaN(idx)) continue;
    const url = slots[idx];
    if (!url) continue;
    if (idx === 0) {
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
    } else {
      const img = cell.querySelector(".quirks-tile__img");
      if (img?.parentNode) {
        img.parentNode.removeChild(img);
        pool.byUrl[url] = img;
      }
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

function quirksCapturePreviewTileRectsByUrl() {
  const grid = document.getElementById("quirks-preview-grid");
  const map = {};
  if (!grid || !quirksEditorState?.slots) return map;
  const cells = grid.querySelectorAll(".quirks-tile");
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const idx = parseInt(cell.dataset.index, 10);
    if (isNaN(idx)) continue;
    const url = quirksEditorState.slots[idx];
    if (!url) continue;
    map[url] = cell.getBoundingClientRect();
  }
  return map;
}

function quirksAnimatePreviewGridFlip(oldRectsByUrl) {
  const grid = document.getElementById("quirks-preview-grid");
  if (!grid || !quirksEditorState?.slots) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  if (!oldRectsByUrl || typeof oldRectsByUrl !== "object") return;
  const cells = grid.querySelectorAll(".quirks-tile");
  const flipItems = [];
  const fadeIn = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const idx = parseInt(cell.dataset.index, 10);
    if (isNaN(idx)) continue;
    const url = quirksEditorState.slots[idx];
    if (!url) continue;
    const oldR = oldRectsByUrl[url];
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
  if (!grid || !quirksEditorState) return;
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
  for (let i = 0; i < st.slots.length; i++) {
    const cell = document.createElement("div");
    cell.className = "quirks-tile";
    cell.dataset.index = String(i);
    const url = st.slots[i];
    if (i === 0) {
      cell.classList.add("quirks-tile--brand");
      if (url) {
        const stack = document.createElement("div");
        stack.className = "quirks-tile__brand-stack";
        let pbloImg = quirksTakePooledPblo(pool);
        if (!pbloImg) {
          pbloImg = document.createElement("img");
          pbloImg.src = getQuirksPbloImageUrl();
        }
        pbloImg.className = "quirks-tile__brand-pblo";
        pbloImg.alt = "";
        pbloImg.setAttribute("aria-hidden", "true");
        pbloImg.draggable = false;
        let brandImg = quirksTakePooledImg(pool, url);
        if (!brandImg) {
          brandImg = document.createElement("img");
          brandImg.className = "quirks-tile__img";
          brandImg.alt = "";
          brandImg.draggable = false;
          if (quirksIsMemoryConstrainedDevice()) {
            brandImg.setAttribute("data-quirks-src", url);
          } else {
            brandImg.src = url;
          }
        } else {
          brandImg.className = "quirks-tile__img";
          brandImg.alt = "";
          brandImg.draggable = false;
        }
        stack.appendChild(pbloImg);
        cell.appendChild(brandImg);
        cell.appendChild(stack);
      } else {
        cell.classList.add("quirks-tile--empty");
      }
    } else if (url) {
      let img = quirksTakePooledImg(pool, url);
      if (!img) {
        img = document.createElement("img");
        img.className = "quirks-tile__img";
        img.alt = "";
        if (quirksIsMemoryConstrainedDevice()) {
          img.setAttribute("data-quirks-src", url);
        } else {
          img.src = url;
        }
      } else {
        img.className = "quirks-tile__img";
        img.alt = "";
      }
      img.draggable = true;
      cell.appendChild(img);
    } else {
      cell.classList.add("quirks-tile--empty");
    }
    quirksSetTileEmptyClass(cell, !!cell.querySelector(".quirks-tile__img"));
    el.appendChild(cell);
  }
  quirksDrainUnusedDomPool(pool);
}

function populateQuirksTraitSelect() {
  const sel = document.getElementById("quirks-trait-sort");
  if (!sel || !quirksWalletData) return;
  const q = normalizeWalletNftList(quirksWalletData.quirkies);
  const ql = normalizeWalletNftList(quirksWalletData.quirklings);
  const ix = normalizeWalletNftList(quirksWalletData.inx);
  const types = collectTraitTypesFromItems(q.concat(ql).concat(ix));
  const keep = sel.value;
  sel.innerHTML = "";
  const randOpt = document.createElement("option");
  randOpt.value = "random";
  randOpt.textContent = "Random order";
  sel.appendChild(randOpt);
  for (let t = 0; t < types.length; t++) {
    const o = document.createElement("option");
    o.value = "trait:" + types[t];
    o.textContent = quirksFormatTraitLabel(types[t]);
    sel.appendChild(o);
  }
  let ok = false;
  for (let t = 0; t < sel.options.length; t++) {
    if (sel.options[t].value === keep) {
      ok = true;
      break;
    }
  }
  sel.value = ok ? keep : "random";
}

async function openQuirksModal() {
  const results = document.getElementById("wallet-results");
  const w =
    results?.getAttribute("data-last-wallet")?.trim() || "";
  if (!w || !/^0x[a-fA-F0-9]{40}$/.test(w)) {
    return;
  }
  resetQuirksModalOutput();
  setGlobalLoadingQuirks(true);
  try {
    const res = await fetch(
      apiUrl("/api/wallet?address=" + encodeURIComponent(w))
    );
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
  quirksRebuildSlotsFromSorted(items);
  const previewWrap = document.getElementById("quirks-preview-wrap");
  if (previewWrap) previewWrap.classList.remove("hidden");
  quirksSetDownloadButtonReady(false);
  renderQuirksPreviewGrid();
  setGlobalLoadingQuirks(true);
  try {
    await quirksAwaitPreviewGridLoads(
      document.getElementById("quirks-preview-grid")
    );
    await quirksRefreshPreviewFromSlots();
    await quirksWaitForPreviewGridImages();
    quirksSetDownloadButtonReady(true);
  } catch {
    quirksSetDownloadButtonReady(false);
  } finally {
    setGlobalLoadingQuirks(false);
  }
}

function injectQuirksOpenButton() {
  const fa = document.getElementById("quirks-grid-actions");
  if (!fa || document.getElementById("quirks-open-btn")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.id = "quirks-open-btn";
  b.className = "btn-secondary quirks-open-btn";
  b.textContent = "Grid builder";
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
  [
    "quirks-opt-quirkies",
    "quirks-opt-quirkkids",
    "quirks-opt-quirklings",
    "quirks-opt-inx",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", quirksSyncGenerateButtonState);
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
      const oldRects = quirksCapturePreviewTileRectsByUrl();
      const domPool = quirksHarvestPreviewDomPool();
      quirksRebuildSlotsFromSorted(items);
      quirksSetDownloadButtonReady(false);
      renderQuirksPreviewGrid(domPool);
      quirksAnimatePreviewGridFlip(oldRects);
      const gridEl = document.getElementById("quirks-preview-grid");
      quirksAwaitPreviewGridLoads(gridEl)
        .then(() => quirksRefreshPreviewFromSlots())
        .then(() => quirksWaitForPreviewGridImages())
        .then(() => quirksSetDownloadButtonReady(true))
        .catch(() => quirksSetDownloadButtonReady(false));
    });
  }
  const previewGrid = document.getElementById("quirks-preview-grid");
  if (previewGrid) {
    previewGrid.addEventListener("dragstart", (e) => {
      const cell = e.target.closest(".quirks-tile");
      if (!cell || !previewGrid.contains(cell)) return;
      const i = parseInt(cell.dataset.index, 10);
      if (i === 0 || !quirksEditorState?.slots[i]) {
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
    });
    previewGrid.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    previewGrid.addEventListener("drop", (e) => {
      e.preventDefault();
      const cell = e.target.closest(".quirks-tile");
      if (!cell || !previewGrid.contains(cell) || !quirksEditorState) return;
      const j = parseInt(cell.dataset.index, 10);
      const i = quirksDnDFromIndex;
      if (i == null || j === 0 || i === 0) return;
      if (i === j) return;
      const tmp = quirksEditorState.slots[i];
      quirksEditorState.slots[i] = quirksEditorState.slots[j];
      quirksEditorState.slots[j] = tmp;
      quirksDnDFromIndex = null;
      quirksSwapPreviewTileContents(i, j);
      quirksLastExportDataUrl = null;
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
      quirksRefreshPreviewFromSlots()
        .then(triggerDownload)
        .finally(() => setGlobalLoadingQuirks(false));
    });
  }
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const welcome = document.getElementById("welcome-modal");
    if (welcome && welcome.classList.contains("is-open")) return;
    if (modal?.classList.contains("is-open")) closeModal();
  });
}

window.__quirksInjectGridButton = injectQuirksOpenButton;
setupQuirksBuilderUi();
