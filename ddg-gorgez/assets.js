/**
 * Resolve `assets/<filename>` relative to this module (not the HTML URL).
 * GitHub Pages is case-sensitive and serves from the repo as deployed — this avoids
 * broken relative resolution if the app is ever opened from an unexpected path.
 */
export function assetUrl(filename) {
  const name = String(filename || "").replace(/^\.?\//, "");
  const path = name
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return new URL(`./assets/${path}`, import.meta.url).href;
}

/** Lowercase `a`–`z` and digits `0`–`9` (primary folder name; see `DDG_LETTER_FOLDER_LOWER_FALLBACK`). */
export const DDG_LETTER_FOLDER_LOWER_PRIMARY = "DDG letters";
/** Same set if the repo still uses capital `L` in `Letters` (GitHub Pages is case-sensitive). */
export const DDG_LETTER_FOLDER_LOWER_FALLBACK = "DDG Letters";
/** Uppercase `A`–`Z` and punctuation art (`! ? , . : ; "` etc.). */
export const DDG_LETTER_FOLDER_UPPER = "DDG Letters Uppercase";

function letterFoldersForStem(stem) {
  const raw = String(stem ?? "").trim();
  if (!raw) return [DDG_LETTER_FOLDER_LOWER_PRIMARY, DDG_LETTER_FOLDER_LOWER_FALLBACK];
  if (raw.length === 1) {
    const c = raw[0];
    if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) {
      return [DDG_LETTER_FOLDER_LOWER_PRIMARY, DDG_LETTER_FOLDER_LOWER_FALLBACK];
    }
    if (c >= "A" && c <= "Z") return [DDG_LETTER_FOLDER_UPPER];
    return [DDG_LETTER_FOLDER_UPPER];
  }
  return [DDG_LETTER_FOLDER_UPPER];
}

function letterFileStemForUrl(raw) {
  if (!raw) return "a";
  if (raw.length === 1) {
    if (/^[0-9a-zA-Z._-]$/.test(raw)) return raw;
    if (raw !== "/" && raw !== "\\" && !/\s/.test(raw)) return raw;
    return "a";
  }
  return raw.replace(/[^\w.-]/g, "") || "a";
}

/**
 * Absolute URLs to try for one filename stem (e.g. `a`, `A`, `!`, `exclamation`).
 * Order matches folder rules: lowercase/digits → `DDG letters` then `DDG Letters`; uppercase/punct → `DDG Letters Uppercase`.
 */
export function ddgLetterUrlsFromStem(stem) {
  const raw = String(stem ?? "").trim();
  const file = `${letterFileStemForUrl(raw)}.png`;
  const folders = letterFoldersForStem(stem);
  const urls = folders.map((folder) => assetUrl(`${folder}/${file}`));
  return [...new Set(urls)];
}

/** @deprecated Use `ddgLetterUrlsFromStem` + try each URL. */
export function ddgLetterUrlFromStem(stem) {
  const urls = ddgLetterUrlsFromStem(stem);
  return urls[0] || assetUrl(`${DDG_LETTER_FOLDER_LOWER_PRIMARY}/a.png`);
}

/** @deprecated Prefer `ddgLetterUrlsFromStem`. */
export function ddgLetterUrl(char) {
  const c = String(char ?? "");
  if (c.length !== 1) return ddgLetterUrlFromStem("a");
  return ddgLetterUrlFromStem(c);
}

/** Full template PNG + picker thumbs — add `DDGTemplateN.png` + `DDGN.png` to `assets/` and commit for GitHub Pages. */
/** Layout 1: first full template in `assets/` is `DDGTemplate1.png` (there is no separate `DDGTemplate.png` in the repo). */
export const TEMPLATE_CHOICES = [
  { id: 1, template: assetUrl("DDGTemplate1.png"), thumb: assetUrl("DDG1.png") },
  { id: 2, template: assetUrl("DDGTemplate2.png"), thumb: assetUrl("DDG2.png") },
  { id: 3, template: assetUrl("DDGTemplate3.png"), thumb: assetUrl("DDG3.png") },
  { id: 4, template: assetUrl("DDGTemplate4.png"), thumb: assetUrl("DDG4.png") },
  { id: 5, template: assetUrl("DDGTemplate5.png"), thumb: assetUrl("DDG5.png") },
  { id: 6, template: assetUrl("DDGTemplate6.png"), thumb: assetUrl("DDG6.png") },
  { id: 7, template: assetUrl("DDGTemplate7.png"), thumb: assetUrl("DDG7.png") },
  { id: 8, template: assetUrl("DDGTemplate8.png"), thumb: assetUrl("DDG8.png") },
  { id: 9, template: assetUrl("DDGTemplate9.png"), thumb: assetUrl("DDG9.png") },
  { id: 10, template: assetUrl("DDGTemplate10.png"), thumb: assetUrl("DDG10.png") },
  { id: 11, template: assetUrl("DDGTemplate11.png"), thumb: assetUrl("DDG11.png") },
  { id: 12, template: assetUrl("DDGTemplate12.png"), thumb: assetUrl("DDG12.png") },
];

/** Clean Polaroid art for custom slogans; letter PNGs live in `DDG letters` / `DDG Letters Uppercase`. */
export const BLANK_SLOGAN_TEMPLATE = assetUrl("blanktemplate.png");

export const ASSETS = {
  /** Current template URL — updated when the user picks another template. */
  template: TEMPLATE_CHOICES[0].template,
  ddgLogo: assetUrl("DDGLogo.png"),
  /** Used only for multi-poster “logo” grid cells (not the header / frame spinner). */
  ddgGridLogo: assetUrl("DDGGridLogo.png"),
  /** 7-up poster: decorative cell opposite the grid logo. */
  ddgReveal: assetUrl("DDGReveal.png"),
  loLogo: assetUrl("LOLogo.png"),

  // Optional future additions:
  shutterSound: null,
};

/**
 * Where to draw the custom slogan on the template (native template pixels, same ref as calibrated frame).
 * Tune once `blanktemplate.png` layout is final.
 */
export const CUSTOM_SLOGAN_BOX_NATIVE = {
  templateWidth: 2048,
  templateHeight: 2385,
  /** Bottom white “Polaroid” caption band on blanktemplate.png */
  x: 140,
  y: 1995,
  w: 1768,
  h: 390,
};

/** Letter tracking: added after each glyph as a fraction of that glyph width (negative = tighter). */
export const CUSTOM_SLOGAN_LETTER_GAP = -0.22;

/** Space width as a fraction of line height (gaps between words). */
export const CUSTOM_SLOGAN_SPACE_RATIO = 0.28;

/** Auto-wrap each paragraph to this many characters (including spaces) before a new canvas line; same `dh` for every line. */
export const CUSTOM_SLOGAN_WRAP_MAX_CHARS = 25;

/** Export width in px; height follows template aspect ratio (no stretch). */
export const CANVAS_OUTPUT_WIDTH = 1024;

// Auto-detect (row/column dark counts). Fails on thin black strokes — use calibrated frame below.
export const AUTO_DETECT_FRAME = true;

/**
 * Exact square hole for the primary template (e.g. assets/DDGTemplate1.png) at 2048×2385 (native pixels).
 * Measured from the template: inscribed square from center vs near-black stroke (r,g,b < 55).
 */
export const CALIBRATED_TEMPLATE_FRAME = {
  templateWidth: 2048,
  templateHeight: 2385,
  x: 138,
  y: 130,
  size: 1772,
};

/** When template pixel size matches, use CALIBRATED_TEMPLATE_FRAME (recommended). */
export const USE_CALIBRATED_FRAME = true;

/** Grow calibrated clip (~1–2%) so NFT covers thin black strokes. */
export const CALIBRATED_FRAME_COVER_MULTIPLIER = 1.024;

// Expand the frame slightly so the uploaded image overlaps the black border.
// This makes the border visually disappear (image covers it).
export const FRAME_OVERLAP_PX = 5;

// If you want to inset *inside* the detected rectangle, set this > 0.
// For your goal (hide the black border), keep this at 0 and use FRAME_OVERLAP_PX.
export const FRAME_INSET_PX = 0;

// Slightly >1 nudges cover zoom to hide any leftover stroke (keep near 1).
export const UPLOAD_IMAGE_SCALE = 1.012;

/** Shrink detected outer rect to a centered square (matches square photo hole). */
export const USE_SQUARE_FRAME = true;

