"use client";

import { useCallback, useEffect, useState } from "react";
import type { WalletPassportPreferences } from "@/lib/wallet-dna/types";
import { normaliseAddress } from "@/lib/wallet-dna/utils/helpers";

const STORAGE_PREFIX = "wallet-dna:passport-preferences:";

export const DEFAULT_PASSPORT_PREFERENCES: WalletPassportPreferences = {
  shareStyle: "passport",
  format: "landscape",
  showENS: true,
  showShortAddress: true,
  showGeneratedDate: false,
  showCollectorSince: true,
  showPassportNumber: true,
  showScores: true,
  showStamps: true,
  showBadges: true,
  showOllie: true,
  stampDensity: "standard",
  stampLayoutIndex: 0,
};

/** Fixed prefs for the flagship Wallet DNA Profile Card — no user customisation */
export const FLAGSHIP_PROFILE_PREFS: WalletPassportPreferences = {
  ...DEFAULT_PASSPORT_PREFERENCES,
  shareStyle: "passport",
  format: "landscape",
  showGeneratedDate: false,
  stampDensity: "standard",
  stampLayoutIndex: 0,
};

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}${normaliseAddress(wallet)}`;
}

function loadPrefs(wallet: string): WalletPassportPreferences {
  if (typeof window === "undefined") return DEFAULT_PASSPORT_PREFERENCES;
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    if (!raw) return DEFAULT_PASSPORT_PREFERENCES;
    return { ...DEFAULT_PASSPORT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PASSPORT_PREFERENCES;
  }
}

function savePrefs(wallet: string, prefs: WalletPassportPreferences): void {
  try {
    localStorage.setItem(storageKey(wallet), JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

export function usePassportPreferences(walletAddress: string) {
  const [prefs, setPrefs] = useState<WalletPassportPreferences>(DEFAULT_PASSPORT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs(walletAddress));
    setReady(true);
  }, [walletAddress]);

  const update = useCallback(
    (patch: Partial<WalletPassportPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        savePrefs(walletAddress, next);
        return next;
      });
    },
    [walletAddress],
  );

  const cycleLayout = useCallback(() => {
    setPrefs((prev) => {
      const next = { ...prev, stampLayoutIndex: (prev.stampLayoutIndex + 1) % 3 };
      savePrefs(walletAddress, next);
      return next;
    });
  }, [walletAddress]);

  return { prefs, update, cycleLayout, ready };
}

/** Pure helper for tests */
export function mergePassportPreferences(
  stored: Partial<WalletPassportPreferences> | null,
): WalletPassportPreferences {
  return { ...DEFAULT_PASSPORT_PREFERENCES, ...stored };
}

export function passportPrefsStorageKey(wallet: string): string {
  return storageKey(wallet);
}
