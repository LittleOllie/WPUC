import { getOllieDisplaySrc, getOllieExportSrc } from "@/lib/wallet-dna/ollie-image-url";

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

/** Resolve passport Ollie artwork — WebP for display. */
export function getPassportOllieSrc(variant: string): string {
  const png = getPassportOlliePngFilename(variant);
  return getOllieDisplaySrc(png);
}

export function getPassportOllieExportSrc(variant: string): string {
  return getOllieExportSrc(getPassportOlliePngFilename(variant));
}

function getPassportOlliePngFilename(variant: string): string {
  const publicFile = PUBLIC_OLLIE_FILES[variant];
  if (publicFile) return publicFile;
  const file = PASSPORT_VARIANT_FILES[variant] ?? PASSPORT_VARIANT_FILES.default!;
  return file;
}

export function getPassportOllieFallbackSrc(): string {
  return getOllieDisplaySrc("default.png");
}

export function getPassportOllieFallbackExportSrc(): string {
  return getOllieExportSrc("default.png");
}

export function getDnaAnalysedStampSrc(): string {
  return getOllieDisplaySrc("LODNAAnalysed.png");
}

export function getDnaAnalysedStampExportSrc(): string {
  return getOllieExportSrc("LODNAAnalysed.png");
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
    description: "Genesis Seeker personality artwork (Discovery score)",
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
