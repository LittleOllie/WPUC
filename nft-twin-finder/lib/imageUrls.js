const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
];

/** @param {string} url */
export function extractIpfsPath(url) {
  const match = String(url).match(/\/ipfs\/(.+)$/i);
  return match ? match[1] : null;
}

/** @param {string} url */
export function imageUrlCandidates(url) {
  if (!url || typeof url !== "string") return [];
  const trimmed = url.trim();
  if (!trimmed) return [];

  const ipfsPath = extractIpfsPath(trimmed);
  if (!ipfsPath) return [trimmed];

  const seen = new Set();
  const candidates = [];
  for (const gateway of IPFS_GATEWAYS) {
    const next = `${gateway}${ipfsPath}`;
    if (!seen.has(next)) {
      seen.add(next);
      candidates.push(next);
    }
  }
  if (!seen.has(trimmed)) candidates.push(trimmed);
  return candidates;
}

/** @param {string} url */
export function preferredImageUrl(url) {
  return imageUrlCandidates(url)[0] || url || "";
}
