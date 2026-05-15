const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export async function checkApiHealth() {
  const res = await fetch(apiUrl("/api/health"));
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/**
 * @param {string} owner - 0x wallet
 * @param {string} [contract] - optional contract address filter
 */
export async function fetchWalletNfts(owner, contract) {
  const params = new URLSearchParams({ owner });
  if (contract) params.set("contract", contract);
  const res = await fetch(apiUrl(`/api/nfts?${params.toString()}`));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to load NFTs (${res.status})`);
  }
  return data;
}

/** Proxy URL for NFT images (avoids CORS in UI). */
export function proxiedImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const u = rawUrl.trim();
  if (!u.startsWith("http")) return u;
  return apiUrl(`/api/img?url=${encodeURIComponent(u)}`);
}
