import type { NormalizedNFT, WalletDNAResult } from "@/lib/wallet-dna/types";
import { MAX_NFTS_PAGE_LIMIT, NFT_PICKER_PAGE_SIZE } from "@/lib/wallet-dna/constants";

interface CacheEntry {
  result: WalletDNAResult;
  includedNfts: NormalizedNFT[];
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function getCachedEntry(key: string): CacheEntry | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function getCachedResult(key: string): WalletDNAResult | null {
  return getCachedEntry(key)?.result ?? null;
}

export function getCachedIncludedNfts(key: string): NormalizedNFT[] | null {
  return getCachedEntry(key)?.includedNfts ?? null;
}

export function setCachedResult(
  key: string,
  result: WalletDNAResult,
  includedNfts: NormalizedNFT[],
  ttlSeconds: number,
): void {
  store.set(key, {
    result,
    includedNfts,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function resetCache(): void {
  store.clear();
}

export { MAX_NFTS_PAGE_LIMIT, NFT_PICKER_PAGE_SIZE };
