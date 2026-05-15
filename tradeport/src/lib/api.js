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

/** Random NFTs from a collection contract (no wallet). Refetch for new random set. */
export async function fetchCollectionSamples(contract, count = 3) {
  const params = new URLSearchParams({
    contract,
    count: String(count),
  });
  const res = await fetch(apiUrl(`/api/collection-samples?${params.toString()}`));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to load collection samples (${res.status})`);
  }
  return data;
}

/** Metadata + image for one NFT (mock listings, detail pages). */
export async function fetchNftMetadata(contract, tokenId) {
  const params = new URLSearchParams({
    contract,
    tokenId: String(tokenId),
  });
  const res = await fetch(apiUrl(`/api/nft-metadata?${params.toString()}`));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to load NFT metadata (${res.status})`);
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

const DIRECT_IMAGE_HOSTS = [
  "alchemy.com",
  "ipfs.io",
  "cloudflare-ipfs.com",
  "nftstorage.link",
  "w3s.link",
  "dweb.link",
  "pinata.cloud",
  "arweave.net",
  "amazonaws.com",
  "quirkies-images.s3.ap-southeast-2.amazonaws.com",
  "googleusercontent.com",
];

/** Prefer direct CDN URLs in <img> — faster than proxying every request. */
export function displayImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let u = rawUrl.trim();
  if (u.startsWith("ipfs://")) {
    u = `https://ipfs.io/ipfs/${u.slice(7)}`;
  }
  if (!u.startsWith("http")) return null;
  try {
    const host = new URL(u).hostname;
    if (DIRECT_IMAGE_HOSTS.some((h) => host.includes(h))) return u;
  } catch {
    /* use proxy */
  }
  return proxiedImageUrl(u);
}
