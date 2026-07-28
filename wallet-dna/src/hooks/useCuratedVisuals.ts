"use client";

import { useMemo } from "react";
import type { NormalizedNFT, WalletDNAResult, WalletDNAVisuals } from "@/lib/wallet-dna/types";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";
import {
  getMostHeldCollectionHighlight,
  selectShareCollageNFTs,
  selectWalletGalleryNFTs,
} from "@/lib/wallet-dna/analysis/visuals";

export type CuratedVisuals = WalletDNAVisuals & {
  shareCollage: NormalizedNFT[];
  visibleMostHeld: ReturnType<typeof getMostHeldCollectionHighlight>;
};

export function buildCuratedVisuals(
  result: WalletDNAResult,
  hiddenCollectionKeys: string[],
): CuratedVisuals {
  const visuals = result.visuals ?? {
    highlights: [],
    galleryNFTs: [],
    collectionShowcase: [],
  };
  const hidden = new Set(hiddenCollectionKeys);
  const isHiddenCollection = (chain: NormalizedNFT["chain"], contract: string) =>
    hidden.has(collectionKey(chain, contract));
  const filterNft = (n: NormalizedNFT) => !isHiddenCollection(n.chain, n.contractAddress);

  const collectionShowcase = visuals.collectionShowcase.filter(
    (c) => !isHiddenCollection(c.chain, c.contractAddress),
  );

  const highlights = visuals.highlights.filter((h) => {
    if (h.type === "most-held-collection" && h.collection) {
      return !isHiddenCollection(h.collection.chain, h.collection.contractAddress);
    }
    if (h.nft) return filterNft(h.nft);
    return true;
  });

  const galleryNFTs = selectWalletGalleryNFTs(
    result.walletAddress,
    visuals.galleryNFTs.filter(filterNft),
    { limit: 24, hiddenCollectionKeys },
  );

  const totalVisible = collectionShowcase.reduce((s, c) => s + c.currentQuantity, 0);
  let visibleMostHeld = getMostHeldCollectionHighlight(collectionShowcase, totalVisible);

  let curatedHighlights = [...highlights];
  if (visibleMostHeld && !curatedHighlights.some((h) => h.type === "most-held-collection")) {
    curatedHighlights = curatedHighlights.filter((h) => h.type !== "most-held-collection");
    curatedHighlights.unshift(visibleMostHeld);
  } else if (!visibleMostHeld) {
    curatedHighlights = curatedHighlights.filter((h) => h.type !== "most-held-collection");
    visibleMostHeld = null;
  }

  return {
    highlights: curatedHighlights,
    galleryNFTs,
    collectionShowcase,
    shareCollage: selectShareCollageNFTs(
      result.walletAddress,
      galleryNFTs,
      hiddenCollectionKeys,
      4,
    ),
    visibleMostHeld,
  };
}

export function useCuratedVisuals(result: WalletDNAResult, hiddenCollectionKeys: string[]) {
  return useMemo(
    () => buildCuratedVisuals(result, hiddenCollectionKeys),
    [result, hiddenCollectionKeys],
  );
}
