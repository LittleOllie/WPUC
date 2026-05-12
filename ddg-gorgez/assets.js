/**
 * Resolve `assets/<filename>` relative to this module (not the HTML URL).
 * GitHub Pages is case-sensitive and serves from the repo as deployed — this avoids
 * broken relative resolution if the app is ever opened from an unexpected path.
 */
export function assetUrl(filename) {
  const name = String(filename || "").replace(/^\.?\//, "");
  return new URL(`./assets/${name}`, import.meta.url).href;
}

/** Full template PNG + picker thumbs — files must be committed for GitHub Pages (`DDG1.png`…`DDG7.png`). */
export const TEMPLATE_CHOICES = [
  { id: 1, template: assetUrl("DDGTemplate1.png"), thumb: assetUrl("DDG1.png") },
  { id: 2, template: assetUrl("DDGTemplate2.png"), thumb: assetUrl("DDG2.png") },
  { id: 3, template: assetUrl("DDGTemplate3.png"), thumb: assetUrl("DDG3.png") },
  { id: 4, template: assetUrl("DDGTemplate4.png"), thumb: assetUrl("DDG4.png") },
  { id: 5, template: assetUrl("DDGTemplate5.png"), thumb: assetUrl("DDG5.png") },
  { id: 6, template: assetUrl("DDGTemplate6.png"), thumb: assetUrl("DDG6.png") },
  { id: 7, template: assetUrl("DDGTemplate7.png"), thumb: assetUrl("DDG7.png") },
];

export const ASSETS = {
  /** Current template URL — updated when the user picks another template. */
  template: TEMPLATE_CHOICES[0].template,
  ddgLogo: assetUrl("DDGLogo.png"),
  loLogo: assetUrl("LOLogo.png"),

  // Optional future additions:
  shutterSound: null,
};

/** Export width in px; height follows template aspect ratio (no stretch). */
export const CANVAS_OUTPUT_WIDTH = 1024;

// Auto-detect (row/column dark counts). Fails on thin black strokes — use calibrated frame below.
export const AUTO_DETECT_FRAME = true;

/**
 * Exact square hole for assets/DDGTemplate.png at 2048×2385 (native pixels).
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

