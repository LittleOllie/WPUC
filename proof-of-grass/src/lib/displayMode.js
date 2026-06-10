export const DISPLAY_MODE_KEY = "pog-display-mode";

/** Default — centered portrait pocket game */
export const DISPLAY_PORTRAIT = "portrait";

/** Optional fullscreen widescreen */
export const DISPLAY_IMMERSIVE = "immersive";

export function loadDisplayMode() {
  try {
    const v = localStorage.getItem(DISPLAY_MODE_KEY);
    if (v === DISPLAY_IMMERSIVE) return DISPLAY_IMMERSIVE;
  } catch {
    /* private mode */
  }
  return DISPLAY_PORTRAIT;
}

export function saveDisplayMode(mode) {
  try {
    localStorage.setItem(DISPLAY_MODE_KEY, mode);
  } catch {
    /* quota */
  }
}
