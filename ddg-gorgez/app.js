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
  CUSTOM_SLOGAN_BOX_NATIVE,
  CUSTOM_SLOGAN_LETTER_GAP,
  CUSTOM_SLOGAN_SPACE_RATIO,
  CUSTOM_SLOGAN_WRAP_MAX_CHARS,
  BLANK_SLOGAN_TEMPLATE,
  ddgLetterUrlsFromStem,
} from "./assets.js";

/** Shared JPEG quality for download + right-click / long-press mirror (MIME `image/jpeg`). */
const EXPORT_JPEG_QUALITY = 0.92;
const EXPORT_FILENAME_COMPOSITE = "ddg-gorgez.jpg";
const EXPORT_FILENAME_IDLE = "ddg-gorgez-template.jpg";
const TEMPLATE_INDEX_LS_KEY = "ddg-gorgez-template-index";
const CUSTOM_SLOGAN_LS_KEY = "ddg-gorgez-custom-slogan";

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
const sloganInput = document.getElementById("sloganInput");
const customSloganWrap = document.getElementById("customSloganWrap");
const customSloganBtn = document.getElementById("customSloganBtn");
const customSloganPanel = document.getElementById("customSloganPanel");
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
// Initial size matches primary template native aspect until template loads & refits.
canvas.width = CANVAS_OUTPUT_WIDTH;
canvas.height = Math.round((CANVAS_OUTPUT_WIDTH * 2385) / 2048);
canvasWrap.style.aspectRatio = `${canvas.width} / ${canvas.height}`;

let lastBlobUrl = null;
/** Last uploaded file — used to re-render when switching templates after a composite exists. */
let lastUserFile = null;
let latestRenderedDataUrl = null;
let detectedFrame = null;
let templateImgCached = null;
/** Index into `TEMPLATE_CHOICES` (0 = DDGTemplate1.png / thumb DDG1.png). */
let activeTemplateIndex = 0;
/** `blanktemplate.png` is used whenever `customSloganText` has letters/digits to preview (see `syncActiveTemplateToAssets`). */

function migrateLegacyBlankTemplateSelection() {
  try {
    const raw = localStorage.getItem(TEMPLATE_INDEX_LS_KEY);
    if (raw !== "12" || TEMPLATE_CHOICES.length !== 12) return;
    localStorage.setItem(TEMPLATE_INDEX_LS_KEY, "0");
  } catch (_) {
    /* ignore */
  }
}

function syncActiveTemplateToAssets() {
  if (String(customSloganText || "").length > 0) {
    ASSETS.template = BLANK_SLOGAN_TEMPLATE;
  } else {
    const choice = TEMPLATE_CHOICES[activeTemplateIndex] || TEMPLATE_CHOICES[0];
    ASSETS.template = choice.template;
  }
}

const letterImageCache = new Map();

let customSloganText = "";
let sloganRedrawTimer = null;

function readStoredSlogan() {
  try {
    const t = localStorage.getItem(CUSTOM_SLOGAN_LS_KEY);
    if (t != null) return String(t);
  } catch (_) {
    /* ignore */
  }
  return "";
}

function persistSlogan(text) {
  try {
    localStorage.setItem(CUSTOM_SLOGAN_LS_KEY, String(text ?? ""));
  } catch (_) {
    /* ignore */
  }
}

function scaleSloganBoxToCanvas(box, templateImg) {
  const cw = canvas.width;
  const ch = canvas.height;
  const refW = box.templateWidth || 2048;
  const refH = box.templateHeight || 2385;
  return {
    x: (box.x / refW) * cw,
    y: (box.y / refH) * ch,
    w: (box.w / refW) * cw,
    h: (box.h / refH) * ch,
  };
}

const SLOGAN_CHAR_ALIASES = new Map([
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\u02BC", "'"],
  ["\u201c", '"'],
  ["\u201d", '"'],
  ["\u00a0", " "],
  ["\u2013", "-"],
  ["\u2014", "-"],
  ["\u2212", "-"],
]);

function normalizeSloganChar(ch) {
  return SLOGAN_CHAR_ALIASES.get(ch) ?? ch;
}

/**
 * Keyboard / typed character → candidate PNG stems (see `ddgLetterUrlsFromStem` in assets.js for folders).
 * Prefer literal filenames first where safe (e.g. `!.png`); add names your exports use.
 */
const SLOGAN_CHAR_STEMS = new Map([
  ["!", ["exclamationpoint", "exclamation", "exclamationmark", "exclamation-mark", "bang", "!"]],
  ["?", ["questionmark", "question", "question-mark", "?"]],
  [".", ["period", "dot", "fullstop", "full-stop", "."]],
  [",", ["comma", ","]],
  [":", ["colon", ":"]],
  [";", ["semicolon", ";"]],
  ["'", ["apostrophe", "quotesingle", "quote-single", "'"]],
  ['"', ["quotation", "quotedbl", "quote", "doublequote", "double-quote"]],
  ["-", ["-", "hyphen", "hyphenminus", "minus", "dash", "Hyphen"]],
  ["_", ["_", "underscore", "Underscore"]],
  ["(", ["(", "parenleft", "leftparen", "parenthesisleft", "open-paren"]],
  [")", [")", "parenright", "rightparen", "parenthesisright", "close-paren"]],
  ["&", ["&", "ampersand", "and", "Ampersand"]],
  ["@", ["@", "at", "at-sign", "At"]],
  ["#", ["#", "hash", "numbersign", "pound", "number-sign", "Hash"]],
  ["$", ["$", "dollar", "Dollar"]],
  ["%", ["%", "percent", "Percent"]],
  ["+", ["+", "plus", "Plus"]],
  ["=", ["=", "equals", "Equal"]],
  ["/", ["/", "slash", "solidus", "Slash"]],
  ["*", ["*", "asterisk", "star", "Asterisk"]],
  ["[", ["[", "bracketleft", "leftbracket", "Bracketleft"]],
  ["]", ["]", "bracketright", "rightbracket", "Bracketright"]],
  ["{", ["{", "braceleft", "Braceleft"]],
  ["}", ["}", "braceright", "Braceright"]],
  ["<", ["<", "less", "lessthan", "Less"]],
  [">", [">", "greater", "greaterthan", "Greater"]],
  ["|", ["bar", "pipe", "verticalbar", "Bar"]],
  ["~", ["~", "tilde", "Tilde"]],
  ["`", ["`", "grave", "backtick", "Grave"]],
  ["^", ["^", "caret", "asciicircum", "Caret"]],
]);

/** Single chars that may be used as literal `X.png` when not in the stem map (path-safe). */
function literalSafeForPngStem(ch) {
  if (!ch || ch.length !== 1) return false;
  if (/\s/.test(ch)) return false;
  if (ch === "/" || ch === "\\") return false;
  return true;
}

function variantStemsForPunctStem(stem) {
  const s = String(stem);
  if (s.length <= 1) return [s];
  const lo = s.toLowerCase();
  const tit = lo.charAt(0).toUpperCase() + lo.slice(1);
  const up = lo.toUpperCase();
  return [...new Set([s, lo, tit, up])];
}

/** Load order for one map entry: literal first when listed, then names with case variants. */
function tryStemsForOneMapStem(nk, stem) {
  if (stem.length === 1 && /[0-9A-Za-z]/.test(stem)) {
    return [stem];
  }
  return variantStemsForPunctStem(stem);
}

function stemsForChar(nk) {
  if (nk >= "0" && nk <= "9") return [nk];
  if (nk >= "a" && nk <= "z") return [nk, nk.toUpperCase()];
  if (nk >= "A" && nk <= "Z") return [nk];
  const mapped = SLOGAN_CHAR_STEMS.get(nk);
  if (mapped) {
    const base = Array.isArray(mapped) ? mapped : [mapped];
    const out = [];
    for (const stem of base) {
      for (const v of tryStemsForOneMapStem(nk, stem)) {
        if (!out.includes(v)) out.push(v);
      }
    }
    return out;
  }
  if (literalSafeForPngStem(nk)) return [nk];
  return [];
}

/** Cache key for a drawable slogan glyph (letters, digits, mapped or literal punctuation). */
function drawableGlyphKey(ch) {
  const nk = normalizeSloganChar(ch);
  if (nk >= "0" && nk <= "9") return nk;
  if (nk >= "a" && nk <= "z") return nk;
  if (nk >= "A" && nk <= "Z") return nk;
  if (SLOGAN_CHAR_STEMS.has(nk)) return nk;
  if (literalSafeForPngStem(nk)) return nk;
  return null;
}

function isSloganLetterChar(ch) {
  return drawableGlyphKey(ch) != null;
}

async function ensureLetterImage(ch) {
  const nk = normalizeSloganChar(ch);
  const key = drawableGlyphKey(nk);
  if (!key) return null;
  if (letterImageCache.has(key)) return letterImageCache.get(key);
  const stems = stemsForChar(nk);
  for (const stem of stems) {
    const urls = ddgLetterUrlsFromStem(stem);
    for (const url of urls) {
      try {
        const img = await loadLetterAsset(url, { highPriority: false });
        letterImageCache.set(key, img);
        return img;
      } catch (_) {
        /* try next URL / stem */
      }
    }
  }
  return null;
}

function glyphWidthForCh(ch, dh) {
  const key = drawableGlyphKey(ch);
  if (!key) return 0;
  const img = letterImageCache.get(key);
  if (!img || !img.naturalWidth) return dh * 0.55;
  return dh * (img.naturalWidth / img.naturalHeight);
}

async function ensureLettersForLineGlyphs(lineGlyphs) {
  const need = new Set();
  for (const lg of lineGlyphs) {
    for (const g of lg) {
      if (g.ch) need.add(g.ch);
    }
  }
  await Promise.all([...need].map((c) => ensureLetterImage(c)));
}

/** Pack `para` into lines of at most `maxLen` characters (spaces count); breaks at spaces when possible, else hard-breaks long tokens. */
function wrapParagraphToMaxChars(para, maxLen) {
  if (!para) return [];
  const n = Math.max(8, Math.min(200, maxLen | 0)) || 25;
  const lines = [];
  let cur = "";
  const tokens = para.split(/(\s+)/).filter((t) => t.length > 0);
  for (const tok of tokens) {
    if (cur.length + tok.length <= n) {
      cur += tok;
      continue;
    }
    if (cur.length) {
      lines.push(cur);
      cur = "";
    }
    if (tok.length <= n) {
      cur = tok;
      continue;
    }
    let rest = tok;
    while (rest.length > n) {
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    cur = rest;
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/** Respect user newlines; each paragraph is wrapped to `maxLen` chars per canvas line. */
function wrapSloganFullText(text, maxLen) {
  const paragraphs = String(text || "").split(/\r?\n/);
  const lines = [];
  for (const para of paragraphs) {
    if (para === "") {
      lines.push("");
      continue;
    }
    lines.push(...wrapParagraphToMaxChars(para, maxLen));
  }
  return lines;
}

/** Each entry is `{ space: true }` or `{ ch }` for drawable glyphs (see `drawableGlyphKey`). */
function parseSloganLine(line) {
  const out = [];
  for (const ch of line) {
    if (ch === " ") {
      out.push({ space: true });
      continue;
    }
    const nk = normalizeSloganChar(ch);
    if (drawableGlyphKey(nk)) out.push({ ch: nk });
  }
  return out;
}

function measureLineWidth(glyphs, dh, gapFrac) {
  let w = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    if (g.space) {
      w += dh * CUSTOM_SLOGAN_SPACE_RATIO;
      continue;
    }
    const dw = glyphWidthForCh(g.ch, dh);
    if (!dw) continue;
    w += dw;
    const hasMore = i < glyphs.length - 1;
    if (hasMore) w += dw * gapFrac;
  }
  return w;
}

/**
 * Vertical span for layout iterations — each line uses one uniform row height `dhUse` (full image),
 * matching Procreate canvas alignment (no per-glyph ink shifting).
 */
function measureSloganVerticalSpanLetters(lineGlyphs, dhUse, box, lineGapRel) {
  const gap = dhUse * lineGapRel;
  let lineTopY = box.y + 3;
  let maxBottom = lineTopY;
  for (let li = 0; li < lineGlyphs.length; li++) {
    const lineBottom = lineTopY + dhUse;
    lineTopY = lineBottom + gap;
    maxBottom = lineBottom;
  }
  return maxBottom - box.y;
}

async function drawCustomSloganOnCanvas(templateImg) {
  const text = String(customSloganText || "").trim();
  if (!text) return;

  const wrapMax = Math.max(8, Math.min(200, Number(CUSTOM_SLOGAN_WRAP_MAX_CHARS) || 25));
  const wrappedLineStrings = wrapSloganFullText(text, wrapMax);
  const lineGlyphsRaw = wrappedLineStrings.map((ln) => parseSloganLine(ln));
  const lineGlyphs = lineGlyphsRaw.map((lg) => lg.filter((g) => g.space || isSloganLetterChar(g.ch)));
  const anyDrawable = lineGlyphs.some((lg) => lg.some((g) => !g.space));
  if (!anyDrawable) return;

  await ensureLettersForLineGlyphs(lineGlyphs);

  const box = scaleSloganBoxToCanvas(CUSTOM_SLOGAN_BOX_NATIVE, templateImg);
  const gapFrac = Number.isFinite(Number(CUSTOM_SLOGAN_LETTER_GAP))
    ? Number(CUSTOM_SLOGAN_LETTER_GAP)
    : 0;

  const lineCount = Math.max(1, lineGlyphs.length);
  let dh = (box.h / lineCount) * 0.88;

  let maxNeeded = 0;
  for (const glyphs of lineGlyphs) {
    maxNeeded = Math.max(maxNeeded, measureLineWidth(glyphs, dh, gapFrac));
  }
  if (maxNeeded > box.w && maxNeeded > 0) {
    dh *= box.w / maxNeeded;
  }

  const lineGapRel = 0.14;
  const vMax = box.h - 10;

  for (let iter = 0; iter < 18; iter++) {
    let mw = 0;
    for (const glyphs of lineGlyphs) {
      mw = Math.max(mw, measureLineWidth(glyphs, dh, gapFrac));
    }
    if (mw > box.w && mw > 0) dh *= box.w / mw;

    mw = 0;
    for (const glyphs of lineGlyphs) {
      mw = Math.max(mw, measureLineWidth(glyphs, dh, gapFrac));
    }
    const vSpan = measureSloganVerticalSpanLetters(lineGlyphs, dh, box, lineGapRel);
    if (vSpan <= vMax && mw <= box.w + 0.5) break;
    if (dh <= 4) break;
    if (vSpan > vMax) dh *= 0.988;
    else if (mw > box.w) dh *= 0.988;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = "high";

  let lineTopY = box.y + 3;
  for (let li = 0; li < lineGlyphs.length; li++) {
    const glyphs = lineGlyphs[li];
    const lineW = measureLineWidth(glyphs, dh, gapFrac);
    let x = Math.floor(box.x + (box.w - lineW) / 2);
    const drawY = Math.round(lineTopY);
    for (let gi = 0; gi < glyphs.length; gi++) {
      const g = glyphs[gi];
      if (g.space) {
        x += dh * CUSTOM_SLOGAN_SPACE_RATIO;
        continue;
      }
      const key = drawableGlyphKey(g.ch);
      if (!key) continue;
      const img = letterImageCache.get(key);
      if (!img) continue;
      const dw = dh * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, drawY, dw, dh);
      x += dw;
      if (gi < glyphs.length - 1) x += dw * gapFrac;
    }
    lineTopY = drawY + dh + dh * lineGapRel;
  }
  ctx.restore();
}

function scheduleSloganRedraw() {
  if (sloganRedrawTimer) clearTimeout(sloganRedrawTimer);
  sloganRedrawTimer = setTimeout(() => {
    sloganRedrawTimer = null;
    void redrawSloganOnly();
  }, 120);
}

function isBlankSloganTemplateActive() {
  return ASSETS.template === BLANK_SLOGAN_TEMPLATE;
}

function sameTemplateUrl(imgSrc, templateHref) {
  try {
    return new URL(imgSrc, window.location.href).href === new URL(templateHref, window.location.href).href;
  } catch (_) {
    return String(imgSrc || "") === String(templateHref || "");
  }
}

async function paintIdleTemplateCanvas(template) {
  fitCanvasToTemplate(template);
  const frameBase = resolveFrameBase(template);
  const frame = insetFrame(expandFrame(frameBase, FRAME_OVERLAP_PX), FRAME_INSET_PX);
  applyFrameHint(frame);
  clearCanvas();
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
  if (String(customSloganText || "").trim()) {
    await drawCustomSloganOnCanvas(template);
  }
  await assignJpegFromCanvas(EXPORT_FILENAME_IDLE, { linkForDownload: false });
}

async function redrawSloganOnly() {
  try {
    if (lastUserFile) {
      const userImg = await decodeUserImage(lastUserFile);
      await renderComposite(userImg);
      return;
    }
    let template = templateImgCached;
    if (!template?.naturalWidth || !sameTemplateUrl(template.src, ASSETS.template)) {
      template = await loadImage(ASSETS.template, { highPriority: true });
      templateImgCached = template;
    }
    await paintIdleTemplateCanvas(template);
  } catch (_) {
    /* ignore */
  }
}

function isCustomSloganPanelOpen() {
  return !!(customSloganPanel && !customSloganPanel.classList.contains("hidden"));
}

function setCustomSloganPanelOpen(open) {
  if (!customSloganPanel || !customSloganBtn) return;
  setHidden(customSloganPanel, !open);
  customSloganBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    window.requestAnimationFrame(() => sloganInput?.focus());
  } else {
    customSloganBtn.focus();
  }
}

function toggleCustomSloganPanel() {
  setCustomSloganPanelOpen(!isCustomSloganPanelOpen());
}

function setHidden(el, hidden) {
  if (!el?.classList) return;
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

/** Letter PNGs: some static hosts prefer encoded vs raw `%20` paths — try both. */
async function loadLetterAsset(url, opts = {}) {
  try {
    return await loadImage(url, opts);
  } catch (e) {
    try {
      const dec = decodeURI(url);
      if (dec !== url) return await loadImage(dec, opts);
    } catch (_) {
      /* ignore */
    }
    throw e;
  }
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
    preloadDecoded(BLANK_SLOGAN_TEMPLATE),
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

/** Hard-coded hole for the primary 2048×2385 template when native size matches calibration. */
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

  if (String(customSloganText || "").trim()) {
    await drawCustomSloganOnCanvas(template);
  }

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
    await paintIdleTemplateCanvas(template);
    applyLogos({ ddgLogo, loLogo });
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

    if (isBlankSloganTemplateActive()) {
      ddgLogoInFrame.classList.add("hidden");
      ddgLogoInFrame.classList.remove("spin");
      ddgLogoInFrameFallback.classList.add("hidden");
    } else {
      ddgLogoInFrame.src = ddgLogo.src;
      ddgLogoInFrame.classList.remove("hidden");
      ddgLogoInFrame.classList.add("spin");
      ddgLogoInFrameFallback.classList.add("hidden");
    }
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
  if (shouldShowFrameUploadHint()) {
    frameHint?.classList.remove("hidden");
    frameHint?.setAttribute("aria-hidden", "false");
  } else {
    frameHint?.classList.add("hidden");
    frameHint?.setAttribute("aria-hidden", "true");
  }
}

/** UPLOAD DDG until the user has chosen an image (always available before first upload). */
function shouldShowFrameUploadHint() {
  return !lastUserFile;
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
  fileInput.click();
  void renderIdleTemplate();
}

/** GitHub Pages (Linux) is case-sensitive; macOS dev trees often are not — try .png then .PNG. */
function setThumbSrcWithCaseFallback(img, primaryUrl) {
  const primary = String(primaryUrl || "").trim();
  const urls = [primary];
  if (/\.png$/i.test(primary)) {
    const alt = primary.replace(/\.png$/i, (ext) => (ext === ".png" ? ".PNG" : ".png"));
    if (alt !== primary) urls.push(alt);
  }
  let i = 0;
  img.onerror = () => {
    i += 1;
    if (i < urls.length) {
      img.src = urls[i];
    } else {
      img.onerror = null;
    }
  };
  img.src = urls[0];
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
    setThumbSrcWithCaseFallback(img, choice.thumb);
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
  customSloganText = "";
  persistSlogan("");
  if (sloganInput) sloganInput.value = "";
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
  if (isCustomSloganPanelOpen()) {
    e.preventDefault();
    setCustomSloganPanelOpen(false);
    return;
  }
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

if (sloganInput) {
  sloganInput.addEventListener("input", () => {
    const prevLen = String(customSloganText || "").length;
    customSloganText = String(sloganInput.value || "").slice(0, 200);
    persistSlogan(customSloganText);
    const nextLen = customSloganText.length;
    if ((prevLen === 0) !== (nextLen === 0)) {
      syncActiveTemplateToAssets();
      void reconcileAfterTemplateChange();
    } else {
      scheduleSloganRedraw();
    }
  });
}

customSloganBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleCustomSloganPanel();
});

document.addEventListener("pointerdown", (e) => {
  if (!isCustomSloganPanelOpen()) return;
  if (customSloganWrap?.contains(e.target)) return;
  setCustomSloganPanelOpen(false);
});

async function initApp() {
  migrateLegacyBlankTemplateSelection();
  letterImageCache.clear();
  try {
    const raw = localStorage.getItem(TEMPLATE_INDEX_LS_KEY);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n < TEMPLATE_CHOICES.length) activeTemplateIndex = n;
    else activeTemplateIndex = 0;
  } catch (_) {
    activeTemplateIndex = 0;
  }
  customSloganText = readStoredSlogan();
  if (sloganInput) sloganInput.value = customSloganText;
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

