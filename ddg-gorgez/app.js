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
import { getPosterLayout } from "./posterLayouts.js";
import { mountEntry } from "./entryFlow.js";

/**
 * DO NOT recreate separate export positioning logic.
 * With a poster grid, download uses a high-res offscreen canvas: upscale the live `#canvas` (template + slogan),
 * then paint each `.frameMultiCell` from the same wallet/upload drawables with `objectFitCover` math; slot
 * bounds come from `getBoundingClientRect` vs `#canvas` so layout matches the preview. html2canvas is only
 * a fallback (it resamples DOM / backgrounds and looks soft on iPhone). The on-screen grid stays DOM-only.
 */
const EXPORT_MIME = "image/png";
/** PNG is lossless — best for sharp NFT edges. JPEG recompression would make downloads look worse, especially after html2canvas. */
const EXPORT_FILENAME_COMPOSITE = "ddg-gorgez.png";
const EXPORT_FILENAME_IDLE = "ddg-gorgez-template.png";
const TEMPLATE_INDEX_LS_KEY = "ddg-gorgez-template-index";
const CUSTOM_SLOGAN_LS_KEY = "ddg-gorgez-custom-slogan";

/** 1×1 transparent GIF — wallet grid cell before CORS-safe art is ready for the overlay mirror. */
const OVERLAY_PLACEHOLDER_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Extra % of canvas height on `#frameMultiOverlay` when a poster grid is shown — hides a thin black seam at the bottom of the hole. */
const MULTI_GRID_OVERLAY_HEIGHT_BUMP_PCT = 0.38;
/** Nudge overlay down a hair so the grid covers any subpixel gap above template black at the bottom. */
const MULTI_GRID_OVERLAY_TOP_NUDGE_PCT = 0.08;

/** Max width (px) for lossless poster export; scales from `canvas.width` for sharp NFTs on retina phones. */
const EXPORT_POSTER_MAX_PX = 3200;
const EXPORT_POSTER_MIN_MULT = 2.25;

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
const walletPickerStrip = document.getElementById("walletPickerStrip");
const frameMultiOverlay = document.getElementById("frameMultiOverlay");
const frameAddMoreWrap = document.getElementById("frameAddMoreWrap");
const hubBackBtn = document.getElementById("hubBackBtn");
const hubBackBtnText = document.getElementById("hubBackBtnText");

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

/** @type {{ tokenId: string; thumb: string; full: string; name: string }[]} */
let walletPoolNfts = [];
/** Selected wallet NFTs in tap order (max 9). */
let lastWalletNfts = [];
const walletImageByTokenId = new Map();
/** Upload queue (append up to 9). */
let lastUploadFiles = [];
const uploadImageByIndex = new Map();
/** Multi-grid: index of NFT being moved to swap with another cell (no in-cell pan). */
let gridSwapFrom = null;
let latestRenderedDataUrl = null;
/** Object URLs for decode fallbacks (upload path). */
const uploadBlobUrls = [];
/** Object URLs only for multi-cell overlay previews (upload path). */
const overlayPreviewUrls = [];
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
  if (ch == null || ch === "") return false;
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
        if (typeof img.decode === "function") {
          try {
            await img.decode();
          } catch (_) {
            /* decode optional; naturalWidth may populate after onload */
          }
        }
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
      const dw = img?.naturalWidth && img?.naturalHeight
        ? dh * (img.naturalWidth / img.naturalHeight)
        : glyphWidthForCh(g.ch, dh);
      if (img?.naturalWidth && img?.naturalHeight) {
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, drawY, dw, dh);
      }
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
  await assignExportMirrorFromCanvas(EXPORT_FILENAME_IDLE, { linkForDownload: false });
  syncFrameMultiOverlay();
}

async function redrawSloganOnly() {
  try {
    if (lastWalletNfts.length) {
      await ensureWalletImagesLoaded();
      await renderComposite(null);
      return;
    }
    if (lastUploadFiles.length) {
      await rebuildUploadImageCache();
      await renderComposite(null);
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

/** DOWNLOAD is always visible — exports the current canvas (idle template or composite). */
function ensureDownloadButtonVisible() {
  if (!downloadBtn) return;
  downloadBtn.classList.remove("hidden");
  downloadBtn.removeAttribute("aria-hidden");
  downloadBtn.disabled = false;
}

function syncHubBackUi() {
  const hub = hubBackBtn;
  const textEl = hubBackBtnText;
  const card = document.getElementById("card");
  if (!hub || !textEl) return;
  const onGrid = !!(card && !card.classList.contains("hidden"));
  if (onGrid) {
    textEl.textContent = "Back";
    hub.setAttribute("aria-label", "Back to start");
  } else {
    textEl.textContent = "Back to links";
    hub.setAttribute("aria-label", "Back to links");
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Same behavior as CSS `object-fit: cover` + centered crop (single-image frame path only). */
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

function clearWalletCompositeState() {
  walletPoolNfts = [];
  lastWalletNfts = [];
  disposeWalletImageMap();
  if (walletPickerStrip) {
    walletPickerStrip.innerHTML = "";
    walletPickerStrip.classList.add("hidden");
  }
}

function clearUploadCompositeState() {
  lastUploadFiles = [];
  uploadImageByIndex.clear();
  for (const u of uploadBlobUrls) {
    try {
      URL.revokeObjectURL(u);
    } catch (_) {
      /* ignore */
    }
  }
  uploadBlobUrls.length = 0;
}

function clearAllUserMediaState() {
  clearWalletCompositeState();
  clearUploadCompositeState();
}

async function loadImage(src, opts = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (opts.crossOrigin) img.crossOrigin = opts.crossOrigin;
    if (opts.highPriority && "fetchPriority" in img) {
      img.fetchPriority = "high";
    }
    img.decoding = opts.awaitDecode ? "sync" : opts.syncDecode ? "sync" : "async";
    img.onload = () => {
      const finish = () => resolve(img);
      if (opts.awaitDecode && img.decode) {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

function disposeDrawable(d) {
  try {
    if (d && typeof d.close === "function") d.close();
  } catch (_) {
    /* ignore */
  }
  try {
    const blobUrl = d && d.__ddgBlobUrl;
    if (typeof blobUrl === "string" && blobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrl);
      d.__ddgBlobUrl = "";
    }
  } catch (_) {
    /* ignore */
  }
}

function disposeWalletImageMap() {
  for (const d of walletImageByTokenId.values()) disposeDrawable(d);
  walletImageByTokenId.clear();
}

/** Width/height for canvas draw (supports `ImageBitmap` + `HTMLImageElement`). */
function drawablePixels(source) {
  try {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      return { w: source.width, h: source.height };
    }
  } catch (_) {
    /* ignore */
  }
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  return { w, h };
}

/** True `object-fit: cover` draw into export canvas (uses full-res `Image` / `ImageBitmap`, not DOM resampling). */
function drawDrawableCoverInRectForExport(octx, drawable, rect) {
  const { w: srcW, h: srcH } = drawablePixels(drawable);
  if (!srcW || !srcH || rect.width < 1 || rect.height < 1) return;
  const { dx, dy, dw, dh } = objectFitCover(srcW, srcH, rect.width, rect.height);
  octx.save();
  octx.beginPath();
  octx.rect(rect.x, rect.y, rect.width, rect.height);
  octx.clip();
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  try {
    octx.drawImage(drawable, 0, 0, srcW, srcH, rect.x + dx, rect.y + dy, dw, dh);
  } catch (_) {
    /* ignore */
  }
  octx.restore();
}

/**
 * Lossless-style PNG for poster layouts: scale `#canvas` up, paint tiles from bitmap sources + DOM slot rects.
 * Fixes soft NFT exports from html2canvas on iOS.
 */
async function buildHighResPosterDataUrl() {
  if (!canvas?.width || !canvas.height) return null;
  if (!frameMultiOverlay || frameMultiOverlay.classList.contains("hidden")) return null;

  const dpr = Math.max(1, Number(window.devicePixelRatio) || 2);
  const mult = Math.min(4, Math.max(EXPORT_POSTER_MIN_MULT, dpr * 1.35));
  const outW = Math.min(EXPORT_POSTER_MAX_PX, Math.round(canvas.width * mult));
  const outH = Math.max(1, Math.round((outW * canvas.height) / canvas.width));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d", { alpha: true });
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";

  octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, outW, outH);

  const canvasR = canvas.getBoundingClientRect();
  if (canvasR.width < 2 || canvasR.height < 2) return null;

  const [logoImg, revealImg] = await Promise.all([
    safeLoadOptional(ASSETS.ddgGridLogo),
    safeLoadOptional(ASSETS.ddgReveal),
  ]);

  const cells = frameMultiOverlay.querySelectorAll(".frameMultiCell");
  for (const cell of cells) {
    const r = cell.getBoundingClientRect();
    const rx = ((r.left - canvasR.left) / canvasR.width) * outW;
    const ry = ((r.top - canvasR.top) / canvasR.height) * outH;
    const rw = (r.width / canvasR.width) * outW;
    const rh = (r.height / canvasR.height) * outH;
    const rect = {
      x: Math.round(rx),
      y: Math.round(ry),
      width: Math.max(1, Math.round(rw)),
      height: Math.max(1, Math.round(rh)),
    };

    if (cell.dataset.slotRole === "logo") {
      if (logoImg) drawDrawableCoverInRectForExport(octx, logoImg, rect);
    } else if (cell.dataset.slotRole === "reveal") {
      if (revealImg) drawDrawableCoverInRectForExport(octx, revealImg, rect);
    } else if (cell.dataset.slotNftIndex != null && cell.dataset.slotNftIndex !== "") {
      const idx = Number(cell.dataset.slotNftIndex);
      if (!Number.isFinite(idx)) continue;
      let drawable = null;
      if (lastWalletNfts.length) {
        const nft = lastWalletNfts[idx];
        if (nft) drawable = walletImageByTokenId.get(String(nft.tokenId));
      } else if (lastUploadFiles.length) {
        drawable = uploadImageByIndex.get(String(idx));
      }
      if (drawable) drawDrawableCoverInRectForExport(octx, drawable, rect);
    }
  }

  return out.toDataURL(EXPORT_MIME);
}

/**
 * Load a remote NFT image for canvas export. iOS Safari is picky: prefer fetch→blob→blob URL→Image
 * (same-origin pixels, no taint) and await decode. Falls back to crossOrigin Image, then plain Image.
 */
async function loadRemoteImageForCanvas(url) {
  const u = String(url || "").trim();
  if (!u) throw new Error("empty url");

  try {
    const res = await fetch(u, { mode: "cors", credentials: "omit", cache: "default" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await loadImage(objUrl, { highPriority: true, awaitDecode: true });
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        URL.revokeObjectURL(objUrl);
        throw new Error("zero dimensions");
      }
      img.__ddgBlobUrl = objUrl;
      return img;
    } catch (e) {
      try {
        URL.revokeObjectURL(objUrl);
      } catch (_) {
        /* ignore */
      }
      throw e;
    }
  } catch (_) {
    /* try fallbacks */
  }

  try {
    return await loadImage(u, { highPriority: true, crossOrigin: "anonymous", awaitDecode: true });
  } catch (_) {
    /* ignore */
  }

  throw new Error("Remote NFT art could not be loaded in a CORS-safe way for export.");
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
    preloadDecoded(ASSETS.ddgGridLogo),
    preloadDecoded(ASSETS.ddgReveal),
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
 * Encodes the canvas as PNG `data:` URL on the mirror `<img>`, and the same URL + `download`
 * on the wrapping `<a>` so Safari/macOS “Download Linked File” / “Save Link As” use a real .png name.
 * @param {string} filename e.g. ddg-gorgez.png
 * @param {{ linkForDownload?: boolean }} opts if true, also sets latestRenderedDataUrl for the Download button
 */
function assignExportMirrorFromCanvas(filename, opts = {}) {
  const linkForDownload = !!opts.linkForDownload;
  const el = canvasExportMirror;
  const link = canvasExportMirrorLink;
  if (!el || !canvas.width || !canvas.height) return Promise.resolve();

  return new Promise((resolve) => {
    const dataUrl = canvas.toDataURL(EXPORT_MIME);
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

/** Wait for webfonts so html2canvas matches the live caption typography. */
async function awaitDocumentFontsReady() {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch (_) {
    /* ignore */
  }
}

/** `background-image: url("…")` for `.frameMultiFill` (quote-safe; same URL as `data-bg-src`). */
function cssBackgroundUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "none";
  return `url("${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

/**
 * Wait for every `<img>` and `.frameMultiFill` background under the template before DOM export.
 * @param {ParentNode | null | undefined} root
 */
async function awaitSubtreeImagesLoaded(root) {
  if (!root) return;
  const imgs = root.querySelectorAll("img");
  const oneImg = (img) => {
    if (!img || !img.src) return Promise.resolve();
    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === "function") return img.decode().catch(() => {});
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  };
  await Promise.all([...imgs].map(oneImg));

  const fills = root.querySelectorAll(".frameMultiFill[data-bg-src]");
  await Promise.all(
    [...fills].map((el) => {
      const u = String(el.getAttribute("data-bg-src") || "").trim();
      if (!u) return Promise.resolve();
      return new Promise((resolve) => {
        const im = new Image();
        im.onload = () => resolve();
        im.onerror = () => resolve();
        im.src = u;
      });
    })
  );
}

/** Visible template shell — must match `index.html` (.canvasWrap.ddg-template). */
function getDdgTemplateExportEl() {
  return document.querySelector(".ddg-template") || canvasWrap;
}

/** html2canvas clones the document; backdrop-filter on ancestors caused all-white PNGs — neutralize in clone only. */
function prepareHtml2CanvasClone(doc) {
  try {
    for (const el of doc.querySelectorAll("*")) {
      el.style.setProperty("backdrop-filter", "none");
      el.style.setProperty("-webkit-backdrop-filter", "none");
    }
  } catch (_) {
    /* ignore */
  }
  try {
    doc.getElementById("canvasExportMirrorLink")?.style.setProperty("display", "none", "important");
  } catch (_) {
    /* ignore */
  }
}

/** html2canvas `scale` caps — iPhone CSS width is small vs 1024px artboard, so NFTs need a higher scale or they look soft after capture. */
const EXPORT_H2C_MIN_SCALE = 2;
const EXPORT_H2C_MAX_SCALE = 4;
const EXPORT_H2C_MIN_SCALE_IOS = 2.75;
const EXPORT_H2C_MAX_SCALE_IOS = 5.75;

function isAppleMobileDevice() {
  try {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPod/i.test(ua)) return true;
    if (/iPad/i.test(ua)) return true;
    if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1) return true;
    return false;
  } catch (_) {
    return false;
  }
}

function computeExportScreenshotScale() {
  const el = getDdgTemplateExportEl();
  const rect = el?.getBoundingClientRect?.();
  const cssW = Math.max(1, rect?.width || 1);
  const dpr = Math.max(1, Number(window.devicePixelRatio) || 2);
  const bitmapW = canvas?.width || CANVAS_OUTPUT_WIDTH;
  const matchBitmap = bitmapW / cssW;
  const ios = isAppleMobileDevice();
  const minS = ios ? EXPORT_H2C_MIN_SCALE_IOS : EXPORT_H2C_MIN_SCALE;
  const maxS = ios ? EXPORT_H2C_MAX_SCALE_IOS : EXPORT_H2C_MAX_SCALE;
  const dprBoost = dpr * (ios ? 1.45 : 1.25);
  const oversample = matchBitmap * (ios ? 1.18 : 1.08);
  return Math.min(maxS, Math.max(minS, oversample, dprBoost));
}

/**
 * Screenshot of `.ddg-template` (same DOM as preview). Fallback: canvas readback if html2canvas missing/fails.
 */
async function getExportDataUrl() {
  await yieldForBitmapExport();
  await awaitDocumentFontsReady();
  const exportEl = getDdgTemplateExportEl();
  await awaitSubtreeImagesLoaded(exportEl);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    void exportEl?.offsetWidth;
  } catch (_) {
    /* ignore */
  }

  try {
    const posterUrl = await buildHighResPosterDataUrl();
    if (posterUrl) return posterUrl;
  } catch (e) {
    console.warn("[ddg-gorgez] high-res poster export failed, falling back:", e);
  }

  const h2c = globalThis.html2canvas;
  if (typeof h2c === "function" && exportEl) {
    try {
      const scale = computeExportScreenshotScale();
      const shot = await h2c(exportEl, {
        backgroundColor: null,
        scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        foreignObjectRendering: false,
        imageTimeout: 20000,
        onclone(doc) {
          prepareHtml2CanvasClone(doc);
        },
      });
      return shot.toDataURL(EXPORT_MIME);
    } catch (e) {
      console.warn("[ddg-gorgez] html2canvas export failed, using canvas fallback:", e);
    }
  }
  return canvas.toDataURL(EXPORT_MIME);
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

/** Let decoded wallet images settle before canvas readback (helps Safari / iOS). */
async function yieldForBitmapExport() {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 24));
}

async function renderComposite(userImg) {
  const template = await loadImage(ASSETS.template, { highPriority: true });

  templateImgCached = template;
  fitCanvasToTemplate(template);
  clearCanvas();

  const frameBase = resolveFrameBase(template);
  const frame = insetFrame(expandFrame(frameBase, FRAME_OVERLAP_PX), FRAME_INSET_PX);
  applyFrameHint(frame);

  if (lastWalletNfts.length) {
    await ensureWalletImagesLoaded();
    await yieldForBitmapExport();
  }

  // Template bitmap only. Wallet/upload NFT grid + logo/reveal cells live on `#frameMultiOverlay` (DOM);
  // do not redraw them here — export is html2canvas(`.ddg-template`) and must match that DOM exactly.
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  const domGrid = lastWalletNfts.length > 0 || lastUploadFiles.length > 0;
  if (!domGrid && userImg) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(frame.x, frame.y, frame.width, frame.height);
    ctx.clip();
    drawImageToFrame(userImg, frame);
    ctx.restore();
  }

  if (String(customSloganText || "").trim()) {
    await drawCustomSloganOnCanvas(template);
  }

  await assignExportMirrorFromCanvas(EXPORT_FILENAME_COMPOSITE, { linkForDownload: true });
  syncFrameMultiOverlay();
}

async function ensureWalletImagesLoaded() {
  async function loadOne(n) {
    const id = String(n.tokenId);
    const full = String(n.full || "").trim();
    const thumb = String(n.thumb || "").trim();
    const tryUrls = [...new Set([full, thumb].filter(Boolean))];
    if (!tryUrls.length) return;
    for (const src of tryUrls) {
      try {
        const drawable = await loadRemoteImageForCanvas(src);
        disposeDrawable(walletImageByTokenId.get(id));
        walletImageByTokenId.set(id, drawable);
        return;
      } catch (_) {
        /* try next URL */
      }
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    const need = lastWalletNfts.filter((n) => !walletImageByTokenId.has(String(n.tokenId)));
    if (!need.length) return;
    await Promise.all(need.map((n) => loadOne(n)));
    if (pass < 2) await new Promise((r) => setTimeout(r, 90));
  }
}

async function rebuildUploadImageCache() {
  uploadImageByIndex.clear();
  for (const u of uploadBlobUrls) {
    try {
      URL.revokeObjectURL(u);
    } catch (_) {
      /* ignore */
    }
  }
  uploadBlobUrls.length = 0;
  for (let i = 0; i < lastUploadFiles.length; i++) {
    const f = lastUploadFiles[i];
    if ("createImageBitmap" in window) {
      try {
        const bmp = await createImageBitmap(f);
        uploadImageByIndex.set(String(i), bmp);
        continue;
      } catch (_) {
        /* fall through */
      }
    }
    const url = URL.createObjectURL(f);
    uploadBlobUrls.push(url);
    const img = await loadImage(url);
    uploadImageByIndex.set(String(i), img);
  }
}

async function performGridSlotSwap(from, to) {
  if (lastWalletNfts.length) {
    const arr = lastWalletNfts;
    if (from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
    const t = arr[from];
    arr[from] = arr[to];
    arr[to] = t;
    refreshWalletPickerStripUi();
    await renderComposite(null);
    return;
  }
  if (lastUploadFiles.length) {
    const arr = lastUploadFiles;
    if (from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
    const tmp = arr[from];
    arr[from] = arr[to];
    arr[to] = tmp;
    await rebuildUploadImageCache();
    await renderComposite(null);
  }
}

function attachGridSlotInteraction(cell, slot) {
  if ((slot.kind === "logo" || slot.kind === "reveal") || !frameMultiOverlay) return;

  cell.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const from = Number(cell.dataset.slotNftIndex);
    gridSwapFrom = Number.isFinite(from) ? from : null;
    if (gridSwapFrom != null) cell.classList.add("frameMultiCell--dragSource");
    try {
      cell.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });
  cell.addEventListener("pointerup", (e) => {
    cell.classList.remove("frameMultiCell--dragSource");
    try {
      if (cell.hasPointerCapture(e.pointerId)) cell.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    const from = gridSwapFrom;
    gridSwapFrom = null;
    if (!Number.isFinite(from)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest?.(".frameMultiCell");
    if (!target || !frameMultiOverlay.contains(target)) return;
    if (target.dataset.slotRole === "logo" || target.dataset.slotRole === "reveal") return;
    const toRaw = target.dataset.slotNftIndex;
    const to = toRaw != null && toRaw !== "" ? Number(toRaw) : NaN;
    if (!Number.isFinite(to) || to === from) return;
    void performGridSlotSwap(from, to);
  });
  cell.addEventListener("pointercancel", () => {
    gridSwapFrom = null;
    cell.classList.remove("frameMultiCell--dragSource");
  });
}

function revokeOverlayPreviewUrls() {
  for (const u of overlayPreviewUrls) {
    try {
      URL.revokeObjectURL(u);
    } catch (_) {
      /* ignore */
    }
  }
  overlayPreviewUrls.length = 0;
}

function syncFrameMultiOverlay() {
  if (!frameMultiOverlay || !canvasWrap) return;
  const n = lastWalletNfts.length || lastUploadFiles.length;
  if (n < 1) {
    revokeOverlayPreviewUrls();
    frameMultiOverlay.innerHTML = "";
    frameMultiOverlay.classList.add("hidden");
    frameMultiOverlay.setAttribute("aria-hidden", "true");
    canvasWrap?.classList.remove("hasMultiOverlay");
    delete frameMultiOverlay.dataset.posterN;
    return;
  }
  revokeOverlayPreviewUrls();
  const layout = getPosterLayout(n);
  frameMultiOverlay.classList.remove("hidden");
  frameMultiOverlay.setAttribute("aria-hidden", "false");
  canvasWrap?.classList.add("hasMultiOverlay");
  frameMultiOverlay.dataset.posterN = String(n);
  frameMultiOverlay.style.gridTemplateColumns = layout.columns;
  frameMultiOverlay.style.gridTemplateRows = layout.rows;
  frameMultiOverlay.style.gridTemplateAreas = layout.templateAreas.replace(/\//g, "");
  frameMultiOverlay.innerHTML = "";

  let nftIdx = 0;
  let upIdx = 0;
  for (const slot of layout.slots) {
    const cell = document.createElement("div");
    cell.className = "frameMultiCell";
    cell.style.gridArea = slot.area;
    cell.dataset.area = slot.area;
    const pan = document.createElement("div");
    pan.className = "frameMultiPan";
    if (slot.kind === "logo") {
      cell.dataset.slotRole = "logo";
      const img = document.createElement("img");
      img.className = "frameMultiImg";
      img.draggable = false;
      img.decoding = "async";
      img.loading = "eager";
      img.alt = "DDG";
      img.src = ASSETS.ddgGridLogo;
      pan.appendChild(img);
    } else if (slot.kind === "reveal") {
      cell.dataset.slotRole = "reveal";
      const img = document.createElement("img");
      img.className = "frameMultiImg";
      img.draggable = false;
      img.decoding = "async";
      img.loading = "eager";
      img.alt = "";
      img.src = ASSETS.ddgReveal;
      pan.appendChild(img);
    } else if (lastWalletNfts.length) {
      const si = nftIdx;
      nftIdx += 1;
      cell.dataset.slotNftIndex = String(si);
      const nft = lastWalletNfts[si];
      const fill = document.createElement("div");
      fill.className = "frameMultiFill";
      fill.setAttribute("role", "img");
      fill.setAttribute("aria-label", nft?.name || "NFT");
      const tid = nft ? String(nft.tokenId) : "";
      const loaded = tid ? walletImageByTokenId.get(tid) : null;
      const src = loaded?.src || OVERLAY_PLACEHOLDER_DATA_URL;
      fill.setAttribute("data-bg-src", src);
      fill.style.backgroundImage = cssBackgroundUrl(src);
      pan.appendChild(fill);
    } else {
      const si = upIdx;
      upIdx += 1;
      cell.dataset.slotNftIndex = String(si);
      const f = lastUploadFiles[si];
      const fill = document.createElement("div");
      fill.className = "frameMultiFill";
      fill.setAttribute("role", "img");
      fill.setAttribute("aria-label", f?.name || "Upload");
      if (f) {
        const u = URL.createObjectURL(f);
        overlayPreviewUrls.push(u);
        fill.setAttribute("data-bg-src", u);
        fill.style.backgroundImage = cssBackgroundUrl(u);
      } else {
        fill.setAttribute("data-bg-src", OVERLAY_PLACEHOLDER_DATA_URL);
        fill.style.backgroundImage = cssBackgroundUrl(OVERLAY_PLACEHOLDER_DATA_URL);
      }
      pan.appendChild(fill);
    }
    cell.appendChild(pan);
    frameMultiOverlay.appendChild(cell);
    attachGridSlotInteraction(cell, slot);
  }
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
  let fy = (framePx.y / ch) * 100;
  const fw = (framePx.width / cw) * 100;
  let fh = (framePx.height / ch) * 100;
  if (lastWalletNfts.length > 0 || lastUploadFiles.length > 0) {
    fy += MULTI_GRID_OVERLAY_TOP_NUDGE_PCT;
    fh += MULTI_GRID_OVERLAY_HEIGHT_BUMP_PCT;
  }
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
  updateFrameAddMoreVisibility();
}

/** Show frame hint (spinning DDG + upload) until user has uploads or at least one wallet NFT picked. */
function shouldShowFrameUploadHint() {
  if (lastUploadFiles.length) return false;
  if (lastWalletNfts.length) return false;
  return true;
}

function updateFrameAddMoreVisibility() {
  if (!frameAddMoreWrap) return;
  const show = lastUploadFiles.length > 0 && lastUploadFiles.length < 9;
  frameAddMoreWrap.classList.toggle("hidden", !show);
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

async function handleFileInputAppend() {
  const incoming = fileInput?.files ? [...fileInput.files] : [];
  if (!incoming.length) return;

  const prevLen = lastUploadFiles.length;
  clearWalletCompositeState();

  const ok = (f) =>
    /^image\/(png|jpeg|webp)$/i.test(f.type || "") || /\.(png|jpe?g|webp)$/i.test(f.name || "");

  for (const f of incoming) {
    if (lastUploadFiles.length >= 9) break;
    if (!ok(f)) continue;
    lastUploadFiles.push(f);
  }
  if (fileInput) fileInput.value = "";

  if (!lastUploadFiles.length) return;

  setHidden(tryAnotherBtn, true);
  await rebuildUploadImageCache();
  await renderComposite(null);
  if (prevLen === 0) await playUploadAnimation();
  frameHint?.classList.add("hidden");
  setHidden(tryAnotherBtn, false);
  ensureDownloadButtonVisible();
  updateFrameAddMoreVisibility();
}

async function resetApp() {
  latestRenderedDataUrl = null;
  detectedFrame = null;
  clearAllUserMediaState();
  clearCanvas();
  if (fileInput) fileInput.value = "";
  setHidden(stage, false);
  setHidden(tryAnotherBtn, true);
  setHidden(processingOverlay, true);
  setHidden(shutter, true);
  setHidden(flash, true);

  await renderIdleTemplate();
  ensureDownloadButtonVisible();
}

/** Same reset as idle, but open the file picker immediately (must stay sync for iOS). */
function tryAnotherAndPickFile() {
  latestRenderedDataUrl = null;
  detectedFrame = null;
  clearAllUserMediaState();
  if (fileInput) fileInput.value = "";
  setHidden(tryAnotherBtn, true);
  setHidden(processingOverlay, true);
  setHidden(shutter, true);
  setHidden(flash, true);
  canvasWrap.classList.remove("shake", "reveal");
  fileInput.click();
  void renderIdleTemplate();
  ensureDownloadButtonVisible();
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
    if (lastWalletNfts.length) {
      await ensureWalletImagesLoaded();
      await renderComposite(null);
      setHidden(tryAnotherBtn, false);
      frameHint?.classList.add("hidden");
    } else if (lastUploadFiles.length) {
      await rebuildUploadImageCache();
      await renderComposite(null);
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
  } finally {
    ensureDownloadButtonVisible();
    syncHubBackUi();
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

downloadBtn?.addEventListener("click", async () => {
  if (!downloadBtn) return;
  downloadBtn.disabled = true;
  try {
    if (lastUploadFiles.length) await rebuildUploadImageCache();
    await renderComposite(null);
    const url = await getExportDataUrl();
    latestRenderedDataUrl = url;
    const a = document.createElement("a");
    a.href = url;
    a.download = EXPORT_FILENAME_COMPOSITE;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error(e);
    try {
      window.alert(
        "Could not export the image (often a browser security limit on remote art). Try again in a few seconds, or use Upload DDGs with local files."
      );
    } catch (_) {
      /* ignore */
    }
  } finally {
    downloadBtn.disabled = false;
  }
});

hubBackBtn?.addEventListener("click", () => {
  const card = document.getElementById("card");
  const onGrid = !!(card && !card.classList.contains("hidden"));
  if (onGrid) {
    document.dispatchEvent(
      new CustomEvent("ddg-gorgez-back-to-entry", {
        detail: { expandWalletPanel: walletPoolNfts.length > 0 },
      })
    );
    return;
  }
  try {
    window.location.href = new URL("../links/", window.location.href).href;
  } catch (_) {
    window.location.assign("../links/");
  }
});

document.addEventListener("ddg-gorgez-nav-changed", () => {
  syncHubBackUi();
});

tryAnotherBtn.addEventListener("click", tryAnotherAndPickFile);

fileInput.addEventListener("change", () => {
  void handleFileInputAppend();
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
    ensureDownloadButtonVisible();
    syncHubBackUi();
  }
}

canvasExportMirrorLink?.addEventListener("click", (e) => {
  e.preventDefault();
});

function buildWalletPickerStrip() {
  if (!walletPickerStrip) return;
  walletPickerStrip.innerHTML = "";
  if (!walletPoolNfts.length) {
    walletPickerStrip.classList.add("hidden");
    return;
  }
  walletPickerStrip.classList.remove("hidden");
  const row = document.createElement("div");
  row.className = "walletPickerStripRow";
  for (const nft of walletPoolNfts) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "walletPickerChip";
    b.dataset.tokenId = String(nft.tokenId);
    b.setAttribute("aria-pressed", "false");
    const im = document.createElement("img");
    im.className = "walletPickerChipImg";
    im.src = nft.thumb || nft.full || "";
    im.alt = "";
    im.loading = "eager";
    im.decoding = "async";
    const cap = document.createElement("span");
    cap.className = "walletPickerChipCap";
    cap.textContent = `#${nft.tokenId}`;
    b.appendChild(im);
    b.appendChild(cap);
    b.addEventListener("click", () => void toggleWalletSelection(String(nft.tokenId)));
    row.appendChild(b);
  }
  walletPickerStrip.appendChild(row);
  refreshWalletPickerStripUi();
}

function refreshWalletPickerStripUi() {
  if (!walletPickerStrip) return;
  const sel = new Set(lastWalletNfts.map((n) => String(n.tokenId)));
  for (const b of walletPickerStrip.querySelectorAll(".walletPickerChip")) {
    const on = sel.has(String(b.dataset.tokenId));
    b.classList.toggle("walletPickerChip--on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

async function toggleWalletSelection(tokenId) {
  const id = String(tokenId);
  const prevCount = lastWalletNfts.length;
  gridSwapFrom = null;
  const idx = lastWalletNfts.findIndex((n) => String(n.tokenId) === id);
  if (idx >= 0) {
    lastWalletNfts.splice(idx, 1);
  } else {
    if (lastWalletNfts.length >= 9) lastWalletNfts.shift();
    const nft = walletPoolNfts.find((n) => String(n.tokenId) === id);
    if (nft) lastWalletNfts.push(nft);
  }
  refreshWalletPickerStripUi();
  clearUploadCompositeState();
  if (!lastWalletNfts.length) {
    await renderIdleTemplate();
    setHidden(tryAnotherBtn, true);
    ensureDownloadButtonVisible();
  } else {
    try {
      await ensureWalletImagesLoaded();
      await renderComposite(null);
      if (prevCount === 0 && lastWalletNfts.length) await playUploadAnimation();
    } catch (_) {
      try {
        await ensureWalletImagesLoaded();
        await renderComposite(null);
      } catch (__) {
        /* ignore */
      }
    } finally {
      ensureDownloadButtonVisible();
      setHidden(tryAnotherBtn, false);
      frameHint?.classList.add("hidden");
    }
  }
  updateFrameAddMoreVisibility();
}

/**
 * @param {{ tokenId: string; thumb: string; full: string; name: string }[]} nfts
 */
async function onWalletPoolLoaded(nfts) {
  clearUploadCompositeState();
  lastWalletNfts = [];
  disposeWalletImageMap();
  walletPoolNfts = Array.isArray(nfts) ? nfts : [];
  if (fileInput) fileInput.value = "";
  buildWalletPickerStrip();
  setHidden(tryAnotherBtn, true);
  await renderIdleTemplate();
  updateFrameAddMoreVisibility();
  ensureDownloadButtonVisible();
  syncHubBackUi();
}

mountEntry({ startClassic: initApp, onWalletPoolLoaded });

