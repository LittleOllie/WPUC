/** Vite base URL (ends with `/` in production when using a subpath). */
export const SITE_BASE_URL = import.meta.env.BASE_URL;

/** Public asset path under `public/` → served at `${BASE_URL}assets/...`. */
export function assetUrl(relativePath: string): string {
  const p = relativePath.replace(/^\//, "");
  return `${SITE_BASE_URL}${p}`;
}

/** Submitted with each leaderboard row (swap when character/scene selection exists). */
export const LB_CHARACTER = "Oceanus";
export const LB_SCENE = "Primordial Water";
