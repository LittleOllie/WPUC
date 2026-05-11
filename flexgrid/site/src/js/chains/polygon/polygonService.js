/**
 * Polygon chain helpers — validation only. NFT HTTP traffic stays on Worker via `api.js`.
 */

export function isValidPolygonEvmAddress(addr) {
  const a = String(addr || "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(a);
}

export function normalizePolygonContract(addr) {
  const a = String(addr || "").trim().toLowerCase();
  return isValidPolygonEvmAddress(a) ? a : "";
}
