"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NormalizedNFT, SelectedShareNFT } from "@/lib/wallet-dna/types";
import { fetchWalletNfts } from "@/lib/wallet-dna/client";
import {
  getSuggestedShareNFTKeys,
  keysToSelected,
  pruneStaleShareKeys,
  resolveShareNFTsByKeys,
  buildNftLookup,
  selectedToKeys,
} from "@/lib/wallet-dna/share-selection";

type Options = {
  walletAddress: string;
  galleryPool: NormalizedNFT[];
  hiddenCollectionKeys: string[];
  savedKeys: string[];
  onKeysChange: (keys: string[]) => void;
  generatedAt: string;
  ready: boolean;
};

export function useShareNFTSelection({
  walletAddress,
  galleryPool,
  hiddenCollectionKeys,
  savedKeys,
  onKeysChange,
  generatedAt,
  ready,
}: Options) {
  const [resolvedNfts, setResolvedNfts] = useState<NormalizedNFT[]>([]);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initRef = useRef(false);

  const suggestedKeys = useMemo(
    () => getSuggestedShareNFTKeys(walletAddress, galleryPool, hiddenCollectionKeys),
    [walletAddress, galleryPool, hiddenCollectionKeys],
  );

  const syncKeys = useCallback(
    async (keys: string[]) => {
      setLoading(true);
      try {
        if (keys.length === 0) {
          setResolvedNfts([]);
          return;
        }
        const data = await fetchWalletNfts({ wallet: walletAddress, keys });
        const lookup = buildNftLookup(data.nfts);
        const { keys: validKeys, removedCount } = pruneStaleShareKeys(keys, lookup);
        if (removedCount > 0) {
          setStaleNotice(
            removedCount === 1
              ? "One previously selected NFT is no longer held and was removed from your share card."
              : `${removedCount} previously selected NFTs are no longer held and were removed from your share card.`,
          );
          onKeysChange(validKeys);
          keys = validKeys;
        }
        setResolvedNfts(resolveShareNFTsByKeys(keys, lookup));
      } catch {
        const lookup = buildNftLookup(galleryPool);
        const { keys: validKeys } = pruneStaleShareKeys(keys, lookup);
        setResolvedNfts(resolveShareNFTsByKeys(validKeys, lookup));
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, galleryPool, onKeysChange],
  );

  useEffect(() => {
    if (!ready) return;
    initRef.current = false;
    setStaleNotice(null);
  }, [walletAddress, generatedAt, ready]);

  useEffect(() => {
    if (!ready) return;
    if (!savedKeys.length && suggestedKeys.length && !initRef.current) {
      initRef.current = true;
      onKeysChange(suggestedKeys);
      syncKeys(suggestedKeys);
      return;
    }
    initRef.current = true;
    syncKeys(savedKeys.length ? savedKeys : suggestedKeys);
  }, [ready, savedKeys, suggestedKeys, onKeysChange, syncKeys]);

  const selected: SelectedShareNFT[] = useMemo(() => {
    const keys = savedKeys.length ? savedKeys : suggestedKeys;
    return keysToSelected(keys);
  }, [savedKeys, suggestedKeys]);

  return {
    selected,
    selectedNfts: resolvedNfts,
    suggestedKeys,
    staleNotice,
    loading,
    applyKeys: (keys: string[]) => {
      setStaleNotice(null);
      onKeysChange(keys);
      syncKeys(keys);
    },
    useSuggested: () => {
      setStaleNotice(null);
      onKeysChange(suggestedKeys);
      syncKeys(suggestedKeys);
    },
  };
}

export { selectedToKeys };
