"use client";

import { useCallback, useEffect, useState } from "react";
import type { WalletDNASharePreferences } from "@/lib/wallet-dna/types";
import { normaliseAddress } from "@/lib/wallet-dna/utils/helpers";

const STORAGE_PREFIX = "wallet-dna:share-preferences:";

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}${normaliseAddress(wallet)}`;
}

function readPrefs(wallet: string): WalletDNASharePreferences {
  if (typeof window === "undefined") {
    return {
      walletAddress: wallet,
      selectedNFTKeys: [],
      includeNFTArtwork: true,
      updatedAt: new Date(0).toISOString(),
    };
  }
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    if (!raw) {
      return {
        walletAddress: wallet,
        selectedNFTKeys: [],
        includeNFTArtwork: true,
        updatedAt: new Date(0).toISOString(),
      };
    }
    const parsed = JSON.parse(raw) as WalletDNASharePreferences;
    return {
      walletAddress: wallet,
      selectedNFTKeys: Array.isArray(parsed.selectedNFTKeys) ? parsed.selectedNFTKeys : [],
      includeNFTArtwork: parsed.includeNFTArtwork !== false,
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return {
      walletAddress: wallet,
      selectedNFTKeys: [],
      includeNFTArtwork: true,
      updatedAt: new Date(0).toISOString(),
    };
  }
}

export function useSharePreferences(walletAddress: string) {
  const [selectedNFTKeys, setSelectedNFTKeys] = useState<string[]>([]);
  const [includeNFTArtwork, setIncludeNFTArtworkState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prefs = readPrefs(walletAddress);
    setSelectedNFTKeys(prefs.selectedNFTKeys);
    setIncludeNFTArtworkState(prefs.includeNFTArtwork);
    setReady(true);
  }, [walletAddress]);

  const persist = useCallback(
    (keys: string[], includeArt: boolean) => {
      setSelectedNFTKeys(keys);
      setIncludeNFTArtworkState(includeArt);
      const payload: WalletDNASharePreferences = {
        walletAddress,
        selectedNFTKeys: keys,
        includeNFTArtwork: includeArt,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey(walletAddress), JSON.stringify(payload));
    },
    [walletAddress],
  );

  const setSelectedKeys = useCallback(
    (keys: string[]) => persist(keys, includeNFTArtwork),
    [persist, includeNFTArtwork],
  );

  const setIncludeNFTArtwork = useCallback(
    (v: boolean) => persist(selectedNFTKeys, v),
    [persist, selectedNFTKeys],
  );

  return {
    ready,
    selectedNFTKeys,
    includeNFTArtwork,
    setSelectedKeys,
    setIncludeNFTArtwork,
  };
}
