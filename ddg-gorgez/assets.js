/** Full template PNG + small picker thumb (`assets/1.png` … `assets/7.png`). */
export const TEMPLATE_CHOICES = [
  { id: 1, template: "assets/DDGTemplate1.png", thumb: "assets/1.png" },
  { id: 2, template: "assets/DDGTemplate2.png", thumb: "assets/2.png" },
  { id: 3, template: "assets/DDGTemplate3.png", thumb: "assets/3.png" },
  { id: 4, template: "assets/DDGTemplate4.png", thumb: "assets/4.png" },
  { id: 5, template: "assets/DDGTemplate5.png", thumb: "assets/5.png" },
  { id: 6, template: "assets/DDGTemplate6.png", thumb: "assets/6.png" },
  { id: 7, template: "assets/DDGTemplate7.png", thumb: "assets/7.png" },
];

export const ASSETS = {
  /** Current template URL — updated when the user picks another template. */
  template: TEMPLATE_CHOICES[0].template,
  ddgLogo: "assets/DDGLogo.png",
  loLogo: "assets/LOLogo.png",

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

