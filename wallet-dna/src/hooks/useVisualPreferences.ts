"use client";

import { useCallback, useEffect, useState } from "react";
import type { WalletDNAVisualPreferences } from "@/lib/wallet-dna/types";
import { normaliseAddress } from "@/lib/wallet-dna/utils/helpers";

const STORAGE_PREFIX = "wallet-dna-visual-prefs:";

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}${normaliseAddress(wallet)}`;
}

function readPrefs(wallet: string): WalletDNAVisualPreferences {
  if (typeof window === "undefined") {
    return { walletAddress: wallet, hiddenCollections: [] };
  }
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    if (!raw) return { walletAddress: wallet, hiddenCollections: [] };
    const parsed = JSON.parse(raw) as WalletDNAVisualPreferences;
    return {
      walletAddress: wallet,
      hiddenCollections: Array.isArray(parsed.hiddenCollections) ? parsed.hiddenCollections : [],
    };
  } catch {
    return { walletAddress: wallet, hiddenCollections: [] };
  }
}

export function useVisualPreferences(walletAddress: string) {
  const [hiddenCollections, setHiddenCollections] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHiddenCollections(readPrefs(walletAddress).hiddenCollections);
    setReady(true);
  }, [walletAddress]);

  const persist = useCallback(
    (next: string[]) => {
      setHiddenCollections(next);
      const payload: WalletDNAVisualPreferences = {
        walletAddress,
        hiddenCollections: next,
      };
      localStorage.setItem(storageKey(walletAddress), JSON.stringify(payload));
    },
    [walletAddress],
  );

  const hideCollection = useCallback(
    (collectionKey: string) => {
      if (hiddenCollections.includes(collectionKey)) return;
      persist([...hiddenCollections, collectionKey]);
    },
    [hiddenCollections, persist],
  );

  const restoreCollection = useCallback(
    (collectionKey: string) => {
      persist(hiddenCollections.filter((k) => k !== collectionKey));
    },
    [hiddenCollections, persist],
  );

  const restoreAll = useCallback(() => persist([]), [persist]);

  return {
    ready,
    hiddenCollections,
    hideCollection,
    restoreCollection,
    restoreAll,
    isHidden: (key: string) => hiddenCollections.includes(key),
  };
}
