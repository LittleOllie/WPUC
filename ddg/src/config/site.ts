/** Vite base URL (ends with `/` in production when using a subpath). */
export const SITE_BASE_URL = import.meta.env.BASE_URL;

/** Public asset path under `public/` → served at `${BASE_URL}assets/...`. */
export function assetUrl(relativePath: string): string {
  const p = relativePath.replace(/^\//, "");
  return `${SITE_BASE_URL}${p}`;
}
