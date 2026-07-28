import { basePath } from "@/lib/wallet-dna/client";

const PASSPORT_VARIANT_FILES: Record<string, string> = {
  default: "ollie-default.png",
  diamond: "ollie-diamond.png",
  explorer: "ollie-explorer.png",
  mint: "ollie-mint.png",
  loyalty: "ollie-loyalty.png",
  vault: "ollie-vault.png",
};

/** Public /ollie assets used when a dedicated passport PNG is not needed */
const PUBLIC_OLLIE_FILES: Record<string, string> = {
  default: "default.png",
  collector: "LOCollector.png",
  diamond: "LODiamondHand.png",
  explorer: "LOExplorer.png",
  mint: "LOMintEnergy.png",
  "active-mover": "LOActiveMover.png",
  loyalty: "LOCollectionLoyalist.png",
  "art-wanderer": "LOArtWanderer.png",
  vault: "LOVaultKeeper.png",
  balanced: "LOBalanced.png",
};

/** Resolve passport Ollie artwork — falls back to default site Ollie if variant missing. */
export function getPassportOllieSrc(variant: string): string {
  const publicFile = PUBLIC_OLLIE_FILES[variant];
  if (publicFile) {
    return `${basePath}/ollie/${publicFile}`;
  }
  const file = PASSPORT_VARIANT_FILES[variant] ?? PASSPORT_VARIANT_FILES.default!;
  return `${basePath}/passport/${file}`;
}

export function getPassportOllieFallbackSrc(): string {
  return `${basePath}/ollie/default.png`;
}

export function getDnaAnalysedStampSrc(): string {
  return `${basePath}/ollie/LODNAAnalysed.png`;
}

export const PASSPORT_OLLIE_ASSETS = [
  ...Object.entries(PASSPORT_VARIANT_FILES).map(([key, file]) => ({
    key,
    path: `public/passport/${file}`,
    description: `Passport artwork for ${key} personality variant`,
  })),
  {
    key: "collector",
    path: "public/ollie/LOCollector.png",
    description: "Collector personality artwork",
  },
  {
    key: "diamond",
    path: "public/ollie/LODiamondHand.png",
    description: "Diamond Collector personality artwork",
  },
  {
    key: "explorer",
    path: "public/ollie/LOExplorer.png",
    description: "Explorer personality artwork",
  },
  {
    key: "mint",
    path: "public/ollie/LOMintEnergy.png",
    description: "Mint Hunter personality artwork",
  },
  {
    key: "active-mover",
    path: "public/ollie/LOActiveMover.png",
    description: "Active Mover personality artwork",
  },
  {
    key: "loyalty",
    path: "public/ollie/LOCollectionLoyalist.png",
    description: "Collection Loyalist personality artwork",
  },
  {
    key: "art-wanderer",
    path: "public/ollie/LOArtWanderer.png",
    description: "Art Wanderer personality artwork",
  },
  {
    key: "vault",
    path: "public/ollie/LOVaultKeeper.png",
    description: "Vault Keeper personality artwork",
  },
  {
    key: "balanced",
    path: "public/ollie/LOBalanced.png",
    description: "Balanced Collector personality artwork",
  },
  {
    key: "dna-analysed-stamp",
    path: "public/ollie/LODNAAnalysed.png",
    description: "Wallet DNA analysed corner stamp on profile card",
  },
];
