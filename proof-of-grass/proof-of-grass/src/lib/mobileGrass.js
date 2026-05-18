/** Mobile lawn tuning — desktop ignores these values */

export const MOBILE_MAX_WIDTH_PX = 767;

export const MOBILE_MEDIA = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/** Lawn = bottom ~1/5–1/6 of viewport (fixed across phone sizes) */
export const MOBILE_LAWN_DVH = 18;

export const MOBILE_LAWN_FRAC = MOBILE_LAWN_DVH / 100;

/** Fence sits under grass; top just below lawn top */
export const MOBILE_FENCE_DVH = 22;

/** Llama sits above fence, anchored to top of lawn band */
export const MOBILE_LLAMA_DVH = 46;

/** Fraction of lawn height — invisible touch band above blades */
export const MOBILE_HIT_PAD_RATIO = 0.5;

/** Softer finger drag → wobble (0–1) */
export const MOBILE_DRAG_SENSITIVITY = 0.62;

export function isMobileViewport() {
  return window.matchMedia(MOBILE_MEDIA).matches;
}
