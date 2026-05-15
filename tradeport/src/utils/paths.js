/** Public asset path (logos, images) — respects Vite base e.g. /tradeport/ */
export function assetUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = path.replace(/^\//, "");
  return `${base}${normalized}`;
}
