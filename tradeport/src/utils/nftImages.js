import { displayImageUrl } from "../lib/api";

export const QUIRKIES_S3_BASE = "https://quirkies-images.s3.ap-southeast-2.amazonaws.com";
export const QUIRKLINGS_IPFS_CID = "bafybeib6rkqikdf7czbrtzjphk5k6cdi44smd5ewwc3ysihwr3g2onpwl4";

const IPFS_GATEWAYS = [
  "https://nftstorage.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
];

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** @param {string} url */
export function extractIpfsPath(url) {
  if (!url || typeof url !== "string") return null;
  const s = url.trim();
  if (s.startsWith("ipfs://")) {
    return s.slice(7).replace(/^ipfs\//, "").replace(/^\/+/, "");
  }
  const m = s.match(/\/ipfs\/([^?#]+)/i);
  return m ? m[1] : null;
}

function resolveRawUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let u = raw.trim();
  if (!u) return null;
  if (u.startsWith("ipfs://")) {
    u = `https://nftstorage.link/ipfs/${u.slice(7).replace(/^ipfs\//, "")}`;
  } else if (u.startsWith("ar://")) {
    u = `https://arweave.net/${u.slice(5)}`;
  }
  return u;
}

/**
 * Ordered image URLs for <img> — Quirkies S3 + Quirklings IPFS gateways when chain metadata is slow or broken.
 */
export function buildNftImageCandidates({ collectionId, tokenId, imageUrl }) {
  const raw = [];
  const tid = tokenId != null ? String(tokenId).trim() : "";

  const primary = resolveRawUrl(imageUrl);
  if (primary) raw.push(primary);

  if (collectionId === "quirkies" && tid) {
    raw.push(`${QUIRKIES_S3_BASE}/${tid}.png`);
  }

  if (collectionId === "quirklings" && tid) {
    for (const gw of IPFS_GATEWAYS) {
      raw.push(`${gw}${QUIRKLINGS_IPFS_CID}/${tid}.png`);
    }
  }

  const ipfsPath = extractIpfsPath(primary) || extractIpfsPath(imageUrl);
  if (ipfsPath && collectionId !== "quirklings") {
    for (const gw of IPFS_GATEWAYS) {
      raw.push(`${gw}${ipfsPath}`);
    }
  }

  return dedupe(raw.map((u) => displayImageUrl(u)).filter(Boolean));
}

/** Prefer reliable hosts when picking random collection previews. */
export function scoreNftImageUrl(imageUrl) {
  const u = (imageUrl || "").toLowerCase();
  if (u.includes("quirkies-images.s3")) return 4;
  if (u.includes("nft-cdn.alchemy.com")) return 3;
  if (u.includes("nftstorage.link") || u.includes("cloudflare-ipfs.com")) return 2;
  if (u.includes("ipfs.io") || u.includes("ipfs://")) return 0;
  return 1;
}
