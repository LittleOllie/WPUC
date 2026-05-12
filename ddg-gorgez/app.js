import {
  ASSETS,
  TEMPLATE_CHOICES,
  CANVAS_OUTPUT_WIDTH,
  AUTO_DETECT_FRAME,
  CALIBRATED_TEMPLATE_FRAME,
  USE_CALIBRATED_FRAME,
  CALIBRATED_FRAME_COVER_MULTIPLIER,
  FRAME_INSET_PX,
  FRAME_OVERLAP_PX,
  UPLOAD_IMAGE_SCALE,
  USE_SQUARE_FRAME,
} from "./assets.js";

/** Shared JPEG quality for download + right-click / long-press mirror (MIME `image/jpeg`). */
const EXPORT_JPEG_QUALITY = 0.92;
const EXPORT_FILENAME_COMPOSITE = "ddg-gorgez.jpg";
const EXPORT_FILENAME_IDLE = "ddg-gorgez-template.jpg";
const TEMPLATE_INDEX_LS_KEY = "ddg-gorgez-template-index";

/** Strip `index.html` from the path so the bar shows `/ddg-gorgez/` instead. */
try {
  const { pathname, search, hash } = window.location;
  const next = pathname.replace(/\/?index\.html$/i, "/");
  if (next !== pathname) {
    window.history.replaceState(null, "", `${next}${search}${hash}`);
  }
} catch (_) {
  /* ignore */
}

const fileInput = document.getElementById("fileInput");
const stage = document.getElementById("stage");
const canvasWrap = document.getElementById("canvasWrap");
const canvas = document.getElementById("canvas");
const canvasExportMirror = document.getElementById("canvasExportMirror");
const canvasExportMirrorLink = document.getElementById("canvasExportMirrorLink");
const downloadBtn = document.getElementById("downloadBtn");
const tryAnotherBtn = document.getElementById("tryAnotherBtn");
const changeTemplateBtn = document.getElementById("changeTemplateBtn");
const templatePickerOverlay = document.getElementById("templatePickerOverlay");
const templatePickerGrid = document.getElementById("templatePickerGrid");
const templatePickerClose = document.getElementById("templatePickerClose");
const frameHint = document.getElementById("frameHint");

const loLogoHeader = document.getElementById("loLogoHeader");
const ddgLogoHeader = document.getElementById("ddgLogoHeader");
const loLogoFallback = document.getElementById("loLogoFallback");
const ddgLogoFallback = document.getElementById("ddgLogoFallback");
const ddgLogoInFrame = document.getElementById("ddgLogoInFrame");
const ddgLogoInFrameFallback = document.getElementById("ddgLogoInFrameFallback");
const brandRow = document.getElementById("brandRow");

const processingOverlay = document.getElementById("processingOverlay");
const scanText = document.getElementById("scanText");
const shutter = document.getElementById("shutter");
const flash = document.getElementById("flash");
const bootLoadingEl = document.getElementById("bootLoading");

const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
// Initial size matches DDGTemplate.png native aspect until template loads & refits.
canvas.width = CANVAS_OUTPUT_WIDTH;
canvas.height = Math.round((CANVAS_OUTPUT_WIDTH * 2385) / 2048);
canvasWrap.style.aspectRatio = `${canvas.width} / ${canvas.height}`;

let lastBlobUrl = null;
/** Last uploaded file — used to re-render when switching templates after a composite exists. */
let lastUserFile = null;
let latestRenderedDataUrl = null;
let detectedFrame = null;
let templateImgCached = null;
/** Index into `TEMPLATE_CHOICES` (0 = DDGTemplate1 / thumb DDG1.png). */
let activeTemplateIndex = 0;

function readStoredTemplateIndex() {
  try {
    const raw = localStorage.getItem(TEMPLATE_INDEX_LS_KEY);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n < TEMPLATE_CHOICES.length) return n;
  } catch (_) {
    /* ignore */
  }
  return 0;
}

function syncActiveTemplateToAssets() {
  const choice = TEMPLATE_CHOICES[activeTemplateIndex] || TEMPLATE_CHOICES[0];
  ASSETS.template = choice.template;
}

function setHidden(el, hidden) {
  el.classList.toggle("hidden", !!hidden);
  el.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function objectFitCover(srcW, srcH, dstW, dstH) {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  let drawW = dstW;
  let drawH = dstH;
  if (srcRatio > dstRatio) {
    // source wider, match height, crop sides
    drawH = dstH;
    drawW = dstH * srcRatio;
  } else {
    // source taller, match width, crop top/bottom
    drawW = dstW;
    drawH = dstW / srcRatio;
  }
  const dx = (dstW - drawW) / 2;
  const dy = (dstH - drawH) / 2;
  return { dx, dy, dw: drawW, dh: drawH };
}

async function loadImage(src, opts = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (opts.highPriority && "fetchPriority" in img) {
      img.fetchPriority = "high";
    }
    img.decoding = opts.syncDecode ? "sync" : "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Prime HTTP cache + decode so first paint is snappy on slow networks. */
function preloadDecoded(src) {
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    if ("fetchPriority" in img) img.fetchPriority = "high";
    img.onload = () => {
      const done = () => resolve();
      if (img.decode) {
        img.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

async function warmupCriticalImages() {
  await Promise.all([
    preloadDecoded(ASSETS.template),
    preloadDecoded(ASSETS.ddgLogo),
    preloadDecoded(ASSETS.loLogo),
  ]);
}

function hideBootLoading() {
  if (!bootLoadingEl?.isConnected) return;
  bootLoadingEl.setAttribute("aria-busy", "false");
  bootLoadingEl.classList.add("bootLoading--done");
  window.setTimeout(() => bootLoadingEl.remove(), 420);
}

async function decodeUserImage(file) {
  if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  lastBlobUrl = URL.createObjectURL(file);
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch (_) {
      // fallback below
    }
  }
  return await loadImage(lastBlobUrl);
}

async function safeLoadOptional(path) {
  if (!path) return null;
  try {
    return await loadImage(path, { highPriority: true });
  } catch (_) {
    return null;
  }
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Encodes the canvas as JPEG `data:` URL on the mirror `<img>`, and the same URL + `download`
 * on the wrapping `<a>` so Safari/macOS “Download Linked File” / “Save Link As” use a real .jpg name.
 * @param {string} filename e.g. ddg-gorgez.jpg
 * @param {{ linkForDownload?: boolean }} opts if true, also sets latestRenderedDataUrl for the Download button
 */
function assignJpegFromCanvas(filename, opts = {}) {
  const linkForDownload = !!opts.linkForDownload;
  const el = canvasExportMirror;
  const link = canvasExportMirrorLink;
  if (!el || !canvas.width || !canvas.height) return Promise.resolve();

  return new Promise((resolve) => {
    const dataUrl = canvas.toDataURL("image/jpeg", EXPORT_JPEG_QUALITY);
    el.dataset.saveFilename = filename;
    el.src = dataUrl;
    if (link) {
      link.href = dataUrl;
      link.setAttribute("download", filename);
    }
    if (linkForDownload) {
      latestRenderedDataUrl = dataUrl;
    }
    resolve();
  });
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function fitCanvasToTemplate(templateImg) {
  const nw = templateImg.naturalWidth || templateImg.width;
  const nh = templateImg.naturalHeight || templateImg.height;
  if (!nw || !nh) return;
  canvas.width = CANVAS_OUTPUT_WIDTH;
  canvas.height = Math.max(1, Math.round((CANVAS_OUTPUT_WIDTH * nh) / nw));
  canvasWrap.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
}

/**
 * Hole is visually square but dark-pixel detection often returns w≠h (border asymmetry).
 * Using min(w,h) made a tiny centered square → template gradient still visible around the NFT.
 * We take max(w,h) and center so the clip spans the full opening; position is clamped to canvas.
 */
function toCenteredSquareFrame(bbox) {
  const bw = bbox.width;
  const bh = bbox.height;
  const s = Math.min(Math.max(bw, bh), Math.min(canvas.width, canvas.height) * 0.98);
  const cx = bbox.x + bw * 0.5;
  const cy = bbox.y + bh * 0.5;
  let x = Math.round(cx - s * 0.5);
  let y = Math.round(cy - s * 0.5);
  const cw = canvas.width;
  const ch = canvas.height;
  const si = Math.round(s);
  x = clamp(x, 0, Math.max(0, cw - si));
  y = clamp(y, 0, Math.max(0, ch - si));
  return { x, y, width: si, height: si };
}

function defaultSquareFrame(cw, ch) {
  const side = Math.round(Math.min(cw, ch) * 0.58);
  const cx = cw * 0.5;
  const cy = ch * 0.36;
  return {
    x: Math.round(cx - side / 2),
    y: Math.round(cy - side / 2),
    width: side,
    height: side,
  };
}

/** Cover + center-crop inside a virtual rect that is `zoom` times the frame (centered). Clipping must be active to the frame rect. */
function drawImageToFrame(img, frame) {
  const srcW = img.width;
  const srcH = img.height;
  if (!srcW || !srcH) return;

  let zoom = Number(UPLOAD_IMAGE_SCALE);
  if (!Number.isFinite(zoom) || zoom <= 0) zoom = 1;
  if (zoom < 1) zoom = 1;

  const vw = frame.width * zoom;
  const vh = frame.height * zoom;
  const { dx, dy, dw, dh } = objectFitCover(srcW, srcH, vw, vh);
  const vx = frame.x + (frame.width - vw) / 2;
  const vy = frame.y + (frame.height - vh) / 2;

  ctx.drawImage(img, vx + dx, vy + dy, dw, dh);
}

function insetFrame(frame, inset) {
  const i = Math.max(0, inset | 0);
  return {
    x: frame.x + i,
    y: frame.y + i,
    width: Math.max(1, frame.width - i * 2),
    height: Math.max(1, frame.height - i * 2),
  };
}

function expandFrame(frame, px) {
  const p = Math.max(0, px | 0);
  return {
    x: frame.x - p,
    y: frame.y - p,
    width: frame.width + p * 2,
    height: frame.height + p * 2,
  };
}

function isDark(r, g, b, a) {
  return a > 220 && r < 40 && g < 40 && b < 40;
}

function detectFrameFromTemplate(templateImg) {
  // Finds the big black border rectangle by scanning row/col "dark pixel counts"
  // within a central band, so text and decorations don't dominate.
  const w = canvas.width;
  const h = canvas.height;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const c = off.getContext("2d", { willReadFrequently: true });
  c.drawImage(templateImg, 0, 0, w, h);
  const img = c.getImageData(0, 0, w, h);
  const data = img.data;

  const x0 = (w * 0.08) | 0;
  const x1 = (w * 0.92) | 0;
  const y0 = (h * 0.05) | 0;
  const y1 = (h * 0.8) | 0;

  const rowCounts = new Uint32Array(h);
  const colCounts = new Uint32Array(w);

  for (let y = y0; y < y1; y++) {
    let row = 0;
    const base = y * w * 4;
    for (let x = x0; x < x1; x++) {
      const i = base + x * 4;
      if (isDark(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        row++;
        colCounts[x]++;
      }
    }
    rowCounts[y] = row;
  }

  // Thresholds: border is thick and spans most of the frame width/height.
  const rowThresh = ((x1 - x0) * 0.35) | 0;
  const colThresh = ((y1 - y0) * 0.35) | 0;

  let top = -1,
    bottom = -1,
    left = -1,
    right = -1;

  for (let y = y0; y < y1; y++) {
    if (rowCounts[y] > rowThresh) {
      top = y;
      break;
    }
  }
  for (let y = y1 - 1; y >= y0; y--) {
    if (rowCounts[y] > rowThresh) {
      bottom = y;
      break;
    }
  }
  for (let x = x0; x < x1; x++) {
    if (colCounts[x] > colThresh) {
      left = x;
      break;
    }
  }
  for (let x = x1 - 1; x >= x0; x--) {
    if (colCounts[x] > colThresh) {
      right = x;
      break;
    }
  }

  if (top < 0 || bottom < 0 || left < 0 || right < 0) return null;

  const width = Math.round(right - left);
  const height = Math.round(bottom - top);
  // Thin-stroke templates often degenerate here (tiny width): treat as failure.
  const minW = (w * 0.08) | 0;
  const minH = (h * 0.08) | 0;
  if (width < minW || height < minH) return null;

  // Coordinates above are ALREADY in canvas space after drawImage(template, 0, 0, w, h).
  return {
    x: Math.round(left),
    y: Math.round(top),
    width,
    height,
  };
}

function growSquareFrameCoverage(frame, mult) {
  if (!(mult > 1 + 1e-6)) return frame;
  const cx = frame.x + frame.width * 0.5;
  const cy = frame.y + frame.height * 0.5;
  let side = frame.width * mult;
  const cap = Math.min(canvas.width, canvas.height) * 0.998;
  if (side > cap) side = cap;
  side = Math.round(side);
  let x = Math.round(cx - side * 0.5);
  let y = Math.round(cy - side * 0.5);
  x = clamp(x, 0, Math.max(0, canvas.width - side));
  y = clamp(y, 0, Math.max(0, canvas.height - side));
  return { x, y, width: side, height: side };
}

/** Hard-coded hole for DDGTemplate.png when native size matches calibration. */
function frameFromCalibrated(templateImg) {
  if (!USE_CALIBRATED_FRAME) return null;
  const m = CALIBRATED_TEMPLATE_FRAME;
  const tw = templateImg.naturalWidth || templateImg.width;
  const th = templateImg.naturalHeight || templateImg.height;
  if (tw !== m.templateWidth || th !== m.templateHeight) return null;

  const sx = canvas.width / tw;
  const sy = canvas.height / th;
  const side = Math.round(m.size * sx);
  const base = {
    x: Math.round(m.x * sx),
    y: Math.round(m.y * sy),
    width: side,
    height: side,
  };
  let zoom = Number(CALIBRATED_FRAME_COVER_MULTIPLIER);
  if (!Number.isFinite(zoom) || zoom <= 1) zoom = 1;
  return growSquareFrameCoverage(base, zoom);
}

function resolveFrameBase(template) {
  const cw = canvas.width;
  const ch = canvas.height;

  const calibrated = frameFromCalibrated(template);
  if (calibrated) {
    detectedFrame = calibrated;
    return calibrated;
  }

  let raw = null;
  if (AUTO_DETECT_FRAME) {
    raw = detectFrameFromTemplate(template);
  }
  detectedFrame = raw;
  const base = raw || defaultSquareFrame(cw, ch);
  if (!USE_SQUARE_FRAME) return { ...base };
  return toCenteredSquareFrame(base);
}

async function renderComposite(userImg) {
  const template = await loadImage(ASSETS.template, { highPriority: true });

  templateImgCached = template;
  fitCanvasToTemplate(template);
  clearCanvas();

  const frameBase = resolveFrameBase(template);
  const frame = insetFrame(expandFrame(frameBase, FRAME_OVERLAP_PX), FRAME_INSET_PX);
  applyFrameHint(frame);

  // Render order:
  // Template background
  // User image into frame
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x, frame.y, frame.width, frame.height);
  ctx.clip();
  drawImageToFrame(userImg, frame);
  ctx.restore();

  await assignJpegFromCanvas(EXPORT_FILENAME_COMPOSITE, { linkForDownload: true });
}

async function renderIdleTemplate() {
  try {
    const [template, ddgLogo, loLogo] = await Promise.all([
      loadImage(ASSETS.template, { highPriority: true }),
      safeLoadOptional(ASSETS.ddgLogo),
      safeLoadOptional(ASSETS.loLogo),
    ]);

    templateImgCached = template;
    fitCanvasToTemplate(template);
    const frameBase = resolveFrameBase(template);
    const frame = insetFrame(expandFrame(frameBase, FRAME_OVERLAP_PX), FRAME_INSET_PX);
    applyFrameHint(frame);
    applyLogos({ ddgLogo, loLogo });

    clearCanvas();
    ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
    await assignJpegFromCanvas(EXPORT_FILENAME_IDLE, { linkForDownload: false });
  } catch (_) {
    // template might not exist yet
  }
}

function applyLogos({ ddgLogo, loLogo }) {
  if (loLogo) {
    loLogoHeader.src = loLogo.src;
    loLogoHeader.classList.remove("hidden");
    loLogoFallback.classList.add("hidden");
  } else {
    loLogoHeader.classList.add("hidden");
    loLogoFallback.classList.remove("hidden");
  }

  if (ddgLogo) {
    ddgLogoHeader.src = ddgLogo.src;
    ddgLogoHeader.classList.remove("hidden");
    ddgLogoFallback.classList.add("hidden");

    ddgLogoInFrame.src = ddgLogo.src;
    ddgLogoInFrame.classList.remove("hidden");
    ddgLogoInFrame.classList.add("spin");
    ddgLogoInFrameFallback.classList.add("hidden");
  } else {
    ddgLogoHeader.classList.add("hidden");
    ddgLogoFallback.classList.remove("hidden");
    ddgLogoInFrame.classList.add("hidden");
    ddgLogoInFrame.classList.remove("spin");
    ddgLogoInFrameFallback.classList.remove("hidden");
  }
}

function applyFrameHint(framePx) {
  const cw = canvas.width || 1;
  const ch = canvas.height || 1;
  const fx = (framePx.x / cw) * 100;
  const fy = (framePx.y / ch) * 100;
  const fw = (framePx.width / cw) * 100;
  const fh = (framePx.height / ch) * 100;
  canvasWrap.style.setProperty("--fx", `${fx}%`);
  canvasWrap.style.setProperty("--fy", `${fy}%`);
  canvasWrap.style.setProperty("--fw", `${fw}%`);
  canvasWrap.style.setProperty("--fh", `${fh}%`);
  frameHint?.classList.remove("hidden");
}

function randomScanLine() {
  const lines = [
    "Scanning…",
    "Analysing drip…",
    "Gorgez level loading…",
    "This might be elite…",
    "Checking your Gorgez level…",
  ];
  return lines[(Math.random() * lines.length) | 0];
}

async function playUploadAnimation() {
  scanText.textContent = randomScanLine();
  setHidden(processingOverlay, false);
  processingOverlay.classList.remove("show");
  void processingOverlay.offsetWidth;
  processingOverlay.classList.add("show");

  // Let overlay settle.
  await wait(520);

  // Shutter + flash + shake.
  setHidden(shutter, false);
  shutter.classList.remove("play");
  void shutter.offsetWidth;
  shutter.classList.add("play");

  await wait(160);
  setHidden(flash, false);
  flash.classList.remove("play");
  void flash.offsetWidth;
  flash.classList.add("play");

  canvasWrap.classList.remove("shake");
  void canvasWrap.offsetWidth;
  canvasWrap.classList.add("shake");

  await wait(420);
  setHidden(flash, true);
  setHidden(shutter, true);

  // Reveal
  canvasWrap.classList.remove("reveal");
  void canvasWrap.offsetWidth;
  canvasWrap.classList.add("reveal");

  await wait(260);
  setHidden(processingOverlay, true);
}

async function handleFile(file) {
  if (!file) return;

  // UI transition
  setHidden(downloadBtn, true);
  setHidden(tryAnotherBtn, true);

  lastUserFile = file;
  const userImg = await decodeUserImage(file);
  await renderComposite(userImg);
  await playUploadAnimation();

  frameHint?.classList.add("hidden");
  setHidden(downloadBtn, false);
  setHidden(tryAnotherBtn, false);
}

async function resetApp() {
  latestRenderedDataUrl = null;
  detectedFrame = null;
  lastUserFile = null;
  clearCanvas();
  fileInput.value = "";
  setHidden(stage, false);
  setHidden(downloadBtn, true);
  setHidden(tryAnotherBtn, true);
  setHidden(processingOverlay, true);
  setHidden(shutter, true);
  setHidden(flash, true);

  await renderIdleTemplate();
}

/** Same reset as idle, but open the file picker immediately (must stay sync for iOS). */
function tryAnotherAndPickFile() {
  latestRenderedDataUrl = null;
  detectedFrame = null;
  lastUserFile = null;
  fileInput.value = "";
  setHidden(downloadBtn, true);
  setHidden(tryAnotherBtn, true);
  setHidden(processingOverlay, true);
  setHidden(shutter, true);
  setHidden(flash, true);
  canvasWrap.classList.remove("shake", "reveal");
  frameHint?.classList.remove("hidden");
  fileInput.click();
  void renderIdleTemplate();
}

function buildTemplatePickerGrid() {
  if (!templatePickerGrid) return;
  templatePickerGrid.innerHTML = "";
  TEMPLATE_CHOICES.forEach((choice, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "templatePickerOption";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", index === activeTemplateIndex ? "true" : "false");
    if (index === activeTemplateIndex) btn.classList.add("isSelected");
    btn.dataset.templateIndex = String(index);
    const img = document.createElement("img");
    img.src = choice.thumb;
    img.alt = `Template ${choice.id} preview`;
    img.loading = "lazy";
    img.decoding = "async";
    const frame = document.createElement("div");
    frame.className = "templatePickerOptionFrame";
    frame.appendChild(img);
    const badge = document.createElement("span");
    badge.className = "templatePickerOptionBadge";
    badge.textContent = String(choice.id);
    btn.appendChild(frame);
    btn.appendChild(badge);
    btn.addEventListener("click", () => {
      void applyTemplateChoice(index);
    });
    templatePickerGrid.appendChild(btn);
  });
}

function openTemplatePicker() {
  if (!templatePickerOverlay) return;
  buildTemplatePickerGrid();
  setHidden(templatePickerOverlay, false);
  templatePickerOverlay.setAttribute("aria-hidden", "false");
  templatePickerClose?.focus();
}

function closeTemplatePicker() {
  if (!templatePickerOverlay) return;
  setHidden(templatePickerOverlay, true);
  templatePickerOverlay.setAttribute("aria-hidden", "true");
  changeTemplateBtn?.focus();
}

async function applyTemplateChoice(index) {
  const n = Math.max(0, Math.min(TEMPLATE_CHOICES.length - 1, Number(index) || 0));
  if (n === activeTemplateIndex) {
    closeTemplatePicker();
    return;
  }
  activeTemplateIndex = n;
  try {
    localStorage.setItem(TEMPLATE_INDEX_LS_KEY, String(activeTemplateIndex));
  } catch (_) {
    /* ignore */
  }
  syncActiveTemplateToAssets();
  closeTemplatePicker();
  await reconcileAfterTemplateChange();
}

async function reconcileAfterTemplateChange() {
  try {
    if (lastUserFile) {
      const userImg = await decodeUserImage(lastUserFile);
      await renderComposite(userImg);
      setHidden(downloadBtn, false);
      setHidden(tryAnotherBtn, false);
      frameHint?.classList.add("hidden");
    } else {
      await renderIdleTemplate();
    }
  } catch (_) {
    try {
      await renderIdleTemplate();
    } catch (__) {
      /* ignore */
    }
  }
}

changeTemplateBtn?.addEventListener("click", () => openTemplatePicker());
templatePickerClose?.addEventListener("click", () => closeTemplatePicker());
templatePickerOverlay?.addEventListener("click", (e) => {
  if (e.target === templatePickerOverlay) closeTemplatePicker();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (templatePickerOverlay && !templatePickerOverlay.classList.contains("hidden")) {
    e.preventDefault();
    closeTemplatePicker();
  }
});

downloadBtn.addEventListener("click", () => {
  const url =
    latestRenderedDataUrl ||
    canvas.toDataURL("image/jpeg", EXPORT_JPEG_QUALITY);
  const a = document.createElement("a");
  a.href = url;
  a.download = EXPORT_FILENAME_COMPOSITE;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

tryAnotherBtn.addEventListener("click", tryAnotherAndPickFile);

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  handleFile(file);
});

async function initApp() {
  activeTemplateIndex = readStoredTemplateIndex();
  syncActiveTemplateToAssets();
  try {
    await warmupCriticalImages();
    await resetApp();
  } catch (_) {
    try {
      await resetApp();
    } catch (__) {
      /* template missing etc. */
    }
  } finally {
    hideBootLoading();
  }
}

canvasExportMirrorLink?.addEventListener("click", (e) => {
  e.preventDefault();
});

void initApp();

