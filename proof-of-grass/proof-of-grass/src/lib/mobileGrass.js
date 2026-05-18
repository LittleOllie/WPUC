/** Mobile lawn tuning — desktop ignores these values */

export const MOBILE_MAX_WIDTH_PX = 767;

export const MOBILE_MEDIA = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/** Fraction of zone height — invisible touch band above visible blades */
export const MOBILE_HIT_PAD_RATIO = 0.34;

/** Target share of viewport for the grass band (25–35%) */
export const MOBILE_GRASS_DVH = 32;

/** Upper duplicate stack lift as fraction of band height */
export const MOBILE_STACK_LIFT_RATIO = 0.48;

/** Softer finger drag → wobble (0–1) */
export const MOBILE_DRAG_SENSITIVITY = 0.62;

/** Parallax scale on the lifted duplicate stack */
export const MOBILE_MIRROR_PARALLAX = 0.78;

export function isMobileViewport() {
  return window.matchMedia(MOBILE_MEDIA).matches;
}
