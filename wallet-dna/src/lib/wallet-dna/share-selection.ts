import type { NormalizedNFT, SelectedShareNFT } from "@/lib/wallet-dna/types";
import { MAX_SHARE_CARD_NFTS } from "@/lib/wallet-dna/constants";
import { selectShareCollageNFTs } from "@/lib/wallet-dna/analysis/visuals";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";
import { createTokenKey } from "@/lib/wallet-dna/utils/helpers";

export function keysToSelected(keys: string[]): SelectedShareNFT[] {
  return keys.slice(0, MAX_SHARE_CARD_NFTS).map((nftKey, i) => ({
    nftKey,
    position: i + 1,
  }));
}

export function selectedToKeys(selected: SelectedShareNFT[]): string[] {
  return [...selected]
    .sort((a, b) => a.position - b.position)
    .map((s) => s.nftKey);
}

export function getSuggestedShareNFTKeys(
  walletAddress: string,
  pool: NormalizedNFT[],
  hiddenCollectionKeys: string[] = [],
): string[] {
  const suggested = selectShareCollageNFTs(
    walletAddress,
    pool,
    hiddenCollectionKeys,
    MAX_SHARE_CARD_NFTS,
  );
  return suggested.map((n) => createTokenKey(n.chain, n.contractAddress, n.tokenId));
}

export function resolveShareNFTsByKeys(
  keys: string[],
  lookup: Map<string, NormalizedNFT>,
): NormalizedNFT[] {
  const resolved: NormalizedNFT[] = [];
  for (const key of keys.slice(0, MAX_SHARE_CARD_NFTS)) {
    const nft = lookup.get(key);
    if (nft) resolved.push(nft);
  }
  return resolved;
}

export function buildNftLookup(nfts: NormalizedNFT[]): Map<string, NormalizedNFT> {
  const map = new Map<string, NormalizedNFT>();
  for (const n of nfts) {
    map.set(createTokenKey(n.chain, n.contractAddress, n.tokenId), n);
  }
  return map;
}

export function pruneStaleShareKeys(
  keys: string[],
  lookup: Map<string, NormalizedNFT>,
): { keys: string[]; removedCount: number } {
  const kept = keys.filter((k) => lookup.has(k));
  return { keys: kept, removedCount: keys.length - kept.length };
}

export function addShareSelection(
  selected: SelectedShareNFT[],
  nftKey: string,
): { next: SelectedShareNFT[]; error?: "max" } {
  if (selected.some((s) => s.nftKey === nftKey)) {
    return { next: selected };
  }
  if (selected.length >= MAX_SHARE_CARD_NFTS) {
    return { next: selected, error: "max" };
  }
  return {
    next: [
      ...selected,
      { nftKey, position: selected.length + 1 },
    ],
  };
}

export function removeShareSelection(
  selected: SelectedShareNFT[],
  nftKey: string,
): SelectedShareNFT[] {
  return selected
    .filter((s) => s.nftKey !== nftKey)
    .map((s, i) => ({ ...s, position: i + 1 }));
}

export function replaceShareSelection(
  selected: SelectedShareNFT[],
  replacePosition: number,
  nftKey: string,
): SelectedShareNFT[] {
  return selected.map((s) =>
    s.position === replacePosition ? { nftKey, position: replacePosition } : s,
  );
}

export function moveShareSelection(
  selected: SelectedShareNFT[],
  nftKey: string,
  direction: "left" | "right" | "first" | "last",
): SelectedShareNFT[] {
  const keys = selectedToKeys(selected);
  const idx = keys.indexOf(nftKey);
  if (idx < 0) return selected;

  const next = [...keys];
  if (direction === "left" && idx > 0) {
    [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
  } else if (direction === "right" && idx < next.length - 1) {
    [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
  } else if (direction === "first" && idx > 0) {
    const [item] = next.splice(idx, 1);
    next.unshift(item!);
  } else if (direction === "last" && idx < next.length - 1) {
    const [item] = next.splice(idx, 1);
    next.push(item!);
  }

  return keysToSelected(next);
}

export function isHiddenCollectionKey(
  nftKey: string,
  lookup: Map<string, NormalizedNFT>,
  hiddenCollectionKeys: string[],
): boolean {
  const nft = lookup.get(nftKey);
  if (!nft) return false;
  const ck = collectionKey(nft.chain, nft.contractAddress);
  return hiddenCollectionKeys.includes(ck);
}

export { MAX_SHARE_CARD_NFTS };
