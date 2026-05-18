/** Portrait / pocket mode lawn tuning — immersive mode uses desktop CSS */

export const MOBILE_MAX_WIDTH_PX = 767;

export const MOBILE_MEDIA = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/** Lawn band = ~30% of portrait frame height (25–35% target) */
export const PORTRAIT_LAWN_CQH = 30;

export const PORTRAIT_LAWN_FRAC = PORTRAIT_LAWN_CQH / 100;

/** Immersive fullscreen lawn */
export const IMMERSIVE_LAWN_DVH = 36;

export const PORTRAIT_LAWN_TO_IMMERSIVE = PORTRAIT_LAWN_CQH / IMMERSIVE_LAWN_DVH;

export const MOBILE_FENCE_DVH = 22;

export const MOBILE_HIT_PAD_RATIO = 0.5;

export const MOBILE_DRAG_SENSITIVITY = 0.62;

export function isMobileViewport() {
  return window.matchMedia(MOBILE_MEDIA).matches;
}
