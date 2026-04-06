/** Vite base path, e.g. `/` or `/repo-name/` for GitHub Pages */
export const SITE_BASE_URL: string = import.meta.env.BASE_URL;

export function getBaseUrl(): string {
  return SITE_BASE_URL;
}

/**
 * Absolute URL for static files in `public/` (e.g. `assets/foo.png` → `/repo/assets/foo.png`).
 */
export function assetUrl(path: string): string {
  const base = getBaseUrl();
  const p = path.replace(/^\/+/, "");
  return `${base}${p}`;
}

/** Same-origin href for site-relative pages (e.g. games.html). */
export function pageHref(path: string): string {
  return assetUrl(path.replace(/^\/+/, ""));
}

/** Submitted with leaderboard rows until character/scene are chosen in-game */
export const LB_CHARACTER = "Oceanus";
export const LB_SCENE = "Primordial Water";
