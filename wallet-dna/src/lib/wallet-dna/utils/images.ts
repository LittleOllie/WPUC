const IPFS_GATEWAY = "https://nftstorage.link/ipfs/";

/** Normalise NFT media URLs for safe `<img src>` usage. Rejects SVG/data URLs. */
export function normaliseNftImageUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("data:") || lower.endsWith(".svg") || lower.includes(".svg?")) return null;
  if (lower.startsWith("<")) return null;
  if (/\.(mp4|webm|mov|avi|mkv|m4v|mp3|wav|glb|gltf)(\?|$)/i.test(lower)) return null;

  if (trimmed.startsWith("ipfs://")) {
    const path = trimmed.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `${IPFS_GATEWAY}${path}`;
  }

  if (trimmed.startsWith("ar://")) {
    return `https://arweave.net/${trimmed.slice("ar://".length)}`;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function pickNftImageUrl(
  primary: string | null | undefined,
  thumbnail?: string | null,
): { imageUrl: string | null; thumbnailUrl: string | null } {
  const thumb = normaliseNftImageUrl(thumbnail);
  const full = normaliseNftImageUrl(primary);
  return {
    thumbnailUrl: thumb ?? full,
    imageUrl: full ?? thumb,
  };
}

export function hasDisplayableImage(nft: { imageUrl: string | null; thumbnailUrl?: string | null }): boolean {
  return Boolean(nft.thumbnailUrl ?? nft.imageUrl);
}
