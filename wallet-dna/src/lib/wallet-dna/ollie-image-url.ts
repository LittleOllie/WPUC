import { basePath } from "@/lib/wallet-dna/client";

/** PNG basename e.g. `LOCollector.png` */
export function getOllieDisplaySrc(pngFilename: string): string {
  const webp = pngFilename.replace(/\.png$/i, ".webp");
  return `${basePath}/ollie/${webp}`;
}

/** Full-resolution PNG for export / fallback */
export function getOllieExportSrc(pngFilename: string): string {
  return `${basePath}/ollie/${pngFilename}`;
}

export const OLLIE_IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "LOActiveMover.png": { width: 1024, height: 1536 },
  "LOArtWanderer.png": { width: 1024, height: 1536 },
  "LOBalanced.png": { width: 1024, height: 1536 },
  "LOCollectionLoyalist.png": { width: 1024, height: 1536 },
  "LOCollector.png": { width: 1024, height: 1536 },
  "LODNAAnalysed.png": { width: 1024, height: 1536 },
  "LODiamondHand.png": { width: 1024, height: 1536 },
  "LOExplorer.png": { width: 1024, height: 1536 },
  "LOLabCoat.png": { width: 1024, height: 1536 },
  "LOMintEnergy.png": { width: 1024, height: 1536 },
  "LOVaultKeeper.png": { width: 1024, height: 1306 },
  "default.png": { width: 1024, height: 1024 },
};

export function getOllieImageDimensions(pngFilename: string): { width: number; height: number } | null {
  return OLLIE_IMAGE_DIMENSIONS[pngFilename] ?? null;
}
