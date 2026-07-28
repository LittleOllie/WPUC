import { getProxiedImageSrc } from "@/lib/wallet-dna/utils/image-proxy-url";
import { normaliseNftImageUrl } from "@/lib/wallet-dna/utils/images";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";
import { createTokenKey } from "@/lib/wallet-dna/utils/helpers";
import type { NormalizedNFT } from "@/lib/wallet-dna/types";

const IPFS_GATEWAYS = [
  "https://nftstorage.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
];

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    if (!raw) continue;
    const proxied = getProxiedImageSrc(raw);
    if (proxied && !out.includes(proxied)) out.push(proxied);
    if (!out.includes(raw)) out.push(raw);
  }
  return out;
}

/** Build ordered image URL candidates — proxy first, then direct, then alternate IPFS gateways. */
export function expandImageCandidates(raw: string | null | undefined): string[] {
  const normalized = normaliseNftImageUrl(raw) ?? raw ?? null;
  if (!normalized) return [];

  const candidates = uniqueUrls([normalized]);

  const cid =
    normalized.match(/ipfs\/([a-zA-Z0-9]+(?:[^/?#]*))/)?.[1] ??
    normalized.match(/ipfs:\/\/(?:ipfs\/)?([a-zA-Z0-9]+(?:[^/?#]*))/)?.[1];

  if (cid) {
    for (const gateway of IPFS_GATEWAYS) {
      candidates.push(...uniqueUrls([`${gateway}${cid}`]));
    }
  }

  return [...new Set(candidates)];
}

export function collectNftImageCandidates(
  nft: Pick<NormalizedNFT, "imageUrl" | "thumbnailUrl">,
  fallbackNfts: Array<Pick<NormalizedNFT, "imageUrl" | "thumbnailUrl">> = [],
): string[] {
  const urls: string[] = [];

  for (const src of [nft.thumbnailUrl, nft.imageUrl]) {
    urls.push(...expandImageCandidates(src));
  }

  for (const mate of fallbackNfts) {
    for (const src of [mate.thumbnailUrl, mate.imageUrl]) {
      urls.push(...expandImageCandidates(src));
    }
  }

  return [...new Set(urls)];
}

export function findCollectionImageMate(
  nft: Pick<NormalizedNFT, "chain" | "contractAddress" | "tokenId">,
  pool: NormalizedNFT[],
): NormalizedNFT | null {
  const key = collectionKey(nft.chain, nft.contractAddress);
  const self = createTokenKey(nft.chain, nft.contractAddress, nft.tokenId);

  for (const candidate of pool) {
    if (candidate.isSpam) continue;
    if (collectionKey(candidate.chain, candidate.contractAddress) !== key) continue;
    if (createTokenKey(candidate.chain, candidate.contractAddress, candidate.tokenId) === self) {
      continue;
    }
    if (candidate.thumbnailUrl ?? candidate.imageUrl) return candidate;
  }

  return null;
}

export function ensureDisplayableImage(nft: NormalizedNFT, pool: NormalizedNFT[]): NormalizedNFT {
  if (nft.thumbnailUrl ?? nft.imageUrl) return nft;
  const mate = findCollectionImageMate(nft, pool);
  if (!mate) return nft;
  return {
    ...nft,
    thumbnailUrl: mate.thumbnailUrl ?? mate.imageUrl ?? null,
    imageUrl: mate.imageUrl ?? mate.thumbnailUrl ?? null,
  };
}
