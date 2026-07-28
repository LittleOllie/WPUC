import type {
  NormalizedNFT,
  NormalizedNFTTransfer,
  SupportedChain,
  WalletCollectionSummary,
  WalletCollectionVisualSummary,
  WalletDNAVisuals,
  WalletNFTHighlight,
} from "@/lib/wallet-dna/types";
import {
  enrichNftsWithHoldPeriods,
  oldestHighlightTimestamp,
  newestHighlightTimestamp,
  holdDaysFromTimestamp,
  type EnrichedNFT,
} from "@/lib/wallet-dna/utils/holdings";
import { hasDisplayableImage } from "@/lib/wallet-dna/utils/images";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";
import {
  createTokenKey,
  stableHash,
  formatStatDate,
  formatRelativeAcquisition,
} from "@/lib/wallet-dna/utils/helpers";

function totalIncludedCount(nfts: EnrichedNFT[]): number {
  return nfts.reduce((s, n) => s + n.balance, 0);
}

export function getLongestHeldNFT(
  currentNFTs: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
  walletAddress: string,
): WalletNFTHighlight | null {
  const held = currentNFTs.filter((n) => !n.isSpam);
  const enriched = enrichNftsWithHoldPeriods(walletAddress, held, transfers);

  let bestNft: NormalizedNFT | null = null;
  let bestStarted: string | null = null;

  for (const n of held) {
    const started = oldestHighlightTimestamp(walletAddress, n, transfers);
    if (!started) continue;
    if (!bestStarted || new Date(started).getTime() < new Date(bestStarted).getTime()) {
      bestStarted = started;
      bestNft = n;
    }
  }

  if (!bestNft || !bestStarted) return null;

  const holdDays = holdDaysFromTimestamp(bestStarted);
  const displayNft =
    enriched.find(
      (n) =>
        createTokenKey(n.chain, n.contractAddress, n.tokenId) ===
        createTokenKey(bestNft!.chain, bestNft!.contractAddress, bestNft!.tokenId),
    ) ?? bestNft;

  const dateLabel = formatStatDate(bestStarted);

  if (dateLabel === "Not enough history available") {
    return {
      id: "longest-held",
      type: "longest-held",
      title: "Oldest Friend",
      subtitle: "Longest-held NFT currently in this wallet",
      nft: displayNft,
      supportingText: `Held for ${holdDays.toLocaleString()} days · Based on the available transfer history`,
      confidence: "limited",
    };
  }

  return {
    id: "longest-held",
    type: "longest-held",
    title: "Oldest Friend",
    subtitle: "Longest-held NFT currently in this wallet",
    nft: displayNft,
    supportingText: `Held for ${holdDays.toLocaleString()} days · Received ${dateLabel}`,
    confidence: "high",
  };
}

export function getNewestPickup(
  currentNFTs: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
  walletAddress: string,
): WalletNFTHighlight | null {
  const held = currentNFTs.filter((n) => !n.isSpam);
  const enriched = enrichNftsWithHoldPeriods(walletAddress, held, transfers);

  let bestNft: NormalizedNFT | null = null;
  let bestStarted: string | null = null;

  for (const n of held) {
    const started = newestHighlightTimestamp(walletAddress, n, transfers);
    if (!started) continue;
    if (!bestStarted || new Date(started).getTime() > new Date(bestStarted).getTime()) {
      bestStarted = started;
      bestNft = n;
    }
  }

  if (!bestNft || !bestStarted) {
    return null;
  }

  const displayNft =
    enriched.find(
      (n) =>
        createTokenKey(n.chain, n.contractAddress, n.tokenId) ===
        createTokenKey(bestNft!.chain, bestNft!.contractAddress, bestNft!.tokenId),
    ) ?? bestNft;

  return {
    id: "newest-pickup",
    type: "newest-pickup",
    title: "Newest Pickup",
    subtitle: "The most recently received NFT still held in this wallet",
    nft: displayNft,
    supportingText: formatRelativeAcquisition(bestStarted),
    confidence: "high",
  };
}

export function getMostHeldCollectionHighlight(
  collections: WalletCollectionSummary[],
  totalCount: number,
): WalletNFTHighlight | null {
  const top = collections.find((c) => c.currentQuantity > 0);
  if (!top) return null;
  const pct = totalCount > 0 ? ((top.currentQuantity / totalCount) * 100).toFixed(1) : "0";
  return {
    id: "most-held-collection",
    type: "most-held-collection",
    title: "Most-Held Collection",
    subtitle: "The collection with the largest current quantity in this wallet",
    collection: top,
    chain: top.chain,
    supportingText: `${top.currentQuantity} held · ${pct}% of included NFTs · ${top.chain}`,
    confidence: "high",
  };
}

export function getMostActiveChainHighlight(
  ethereumCount: number,
  baseCount: number,
): WalletNFTHighlight | null {
  const total = ethereumCount + baseCount;
  if (total === 0) return null;
  const dominant: SupportedChain = ethereumCount >= baseCount ? "ethereum" : "base";
  const domCount = dominant === "ethereum" ? ethereumCount : baseCount;
  const pct = ((domCount / total) * 100).toFixed(0);
  return {
    id: "most-active-chain",
    type: "most-active-chain",
    title: "Most Active Chain",
    subtitle: "Where most of this wallet's included NFTs live",
    chain: dominant,
    supportingText: `${dominant === "ethereum" ? "Ethereum" : "Base"} · ${domCount} NFTs · ${pct}%`,
    confidence: "high",
  };
}

export function selectWalletGalleryNFTs(
  walletAddress: string,
  nfts: NormalizedNFT[],
  options?: { limit?: number; hiddenCollectionKeys?: string[] },
): NormalizedNFT[] {
  const limit = options?.limit ?? 24;
  const hidden = new Set(options?.hiddenCollectionKeys ?? []);
  const eligible = nfts.filter(
    (n) => !n.isSpam && !hidden.has(collectionKey(n.chain, n.contractAddress)),
  );

  const withImage = eligible.filter(hasDisplayableImage);
  const pool = withImage.length >= Math.min(6, limit) ? withImage : eligible;

  const sorted = [...pool].sort((a, b) => {
    const ha = stableHash(`${walletAddress}:${createTokenKey(a.chain, a.contractAddress, a.tokenId)}`);
    const hb = stableHash(`${walletAddress}:${createTokenKey(b.chain, b.contractAddress, b.tokenId)}`);
    return ha - hb;
  });

  const picked: NormalizedNFT[] = [];
  const perCollection = new Map<string, number>();
  const maxPerCollection = 2;
  const collectionCount = new Set(eligible.map((n) => collectionKey(n.chain, n.contractAddress))).size;

  for (const nft of sorted) {
    if (picked.length >= limit) break;
    const ck = collectionKey(nft.chain, nft.contractAddress);
    const count = perCollection.get(ck) ?? 0;
    if (collectionCount >= 6 && count >= maxPerCollection) continue;
    picked.push(nft);
    perCollection.set(ck, count + 1);
  }

  if (picked.length < limit) {
    for (const nft of sorted) {
      if (picked.length >= limit) break;
      const pk = createTokenKey(nft.chain, nft.contractAddress, nft.tokenId);
      if (picked.some((p) => createTokenKey(p.chain, p.contractAddress, p.tokenId) === pk)) continue;
      picked.push(nft);
    }
  }

  return picked;
}

function representativeNftsForCollection(
  walletAddress: string,
  collection: WalletCollectionSummary,
  nfts: NormalizedNFT[],
  max = 4,
): NormalizedNFT[] {
  const ck = collectionKey(collection.chain, collection.contractAddress);
  const inCollection = nfts.filter(
    (n) => !n.isSpam && collectionKey(n.chain, n.contractAddress) === ck,
  );
  return selectWalletGalleryNFTs(walletAddress, inCollection, { limit: max });
}

export function buildCollectionShowcase(
  walletAddress: string,
  collections: WalletCollectionSummary[],
  nfts: NormalizedNFT[],
  totalCount: number,
): WalletCollectionVisualSummary[] {
  return collections
    .filter((c) => c.currentQuantity > 0)
    .sort((a, b) => {
      if (b.currentQuantity !== a.currentQuantity) return b.currentQuantity - a.currentQuantity;
      return (b.currentOldestHoldDays ?? 0) - (a.currentOldestHoldDays ?? 0);
    })
    .map((c) => ({
      ...c,
      representativeNFTs: representativeNftsForCollection(walletAddress, c, nfts),
      percentageOfCurrentHoldings:
        totalCount > 0 ? Math.round((c.currentQuantity / totalCount) * 1000) / 10 : 0,
    }));
}

export function buildWalletVisuals(
  walletAddress: string,
  nfts: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
  collections: WalletCollectionSummary[],
  ethereumCount: number,
  baseCount: number,
): WalletDNAVisuals {
  const included = nfts.filter((n) => !n.isSpam);
  const enriched = enrichNftsWithHoldPeriods(walletAddress, included, transfers);
  const totalCount = totalIncludedCount(enriched);

  const highlights: WalletNFTHighlight[] = [];
  const longest = getLongestHeldNFT(included, transfers, walletAddress);
  const newest = getNewestPickup(included, transfers, walletAddress);
  const mostHeld = getMostHeldCollectionHighlight(collections, totalCount);
  const chainHighlight = getMostActiveChainHighlight(ethereumCount, baseCount);

  if (longest) highlights.push(longest);
  if (newest) highlights.push(newest);
  if (mostHeld) highlights.push(mostHeld);
  if (chainHighlight) highlights.push(chainHighlight);

  return {
    highlights,
    galleryNFTs: selectWalletGalleryNFTs(walletAddress, included, { limit: 24 }),
    collectionShowcase: buildCollectionShowcase(walletAddress, collections, included, totalCount),
  };
}

export function selectShareCollageNFTs(
  walletAddress: string,
  galleryNFTs: NormalizedNFT[],
  hiddenCollectionKeys: string[] = [],
  limit = 4,
): NormalizedNFT[] {
  const hidden = new Set(hiddenCollectionKeys);
  const pool = galleryNFTs.filter(
    (n) => !hidden.has(collectionKey(n.chain, n.contractAddress)) && hasDisplayableImage(n),
  );
  return selectWalletGalleryNFTs(walletAddress, pool, { limit, hiddenCollectionKeys });
}
