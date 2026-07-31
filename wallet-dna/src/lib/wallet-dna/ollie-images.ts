import { getOllieDisplaySrc, getOllieExportSrc } from "@/lib/wallet-dna/ollie-image-url";

export const COLLECTOR_PERSONALITY_IDS = new Set(["new-collector"]);

/** Personalities that use the LOBalanced artwork */
export const BALANCED_COLLECTOR_PERSONALITY_IDS = new Set(["balanced-collector"]);

/** Personalities that use the LODiamondHand artwork */
export const DIAMOND_PERSONALITY_IDS = new Set(["diamond-collector"]);

/** Personalities that use the LOExplorer artwork */
export const EXPLORER_PERSONALITY_IDS = new Set(["base-explorer", "multi-chain-explorer"]);

/** Personalities that use the LOArtWanderer artwork */
export const ART_WANDERER_PERSONALITY_IDS = new Set(["art-wanderer"]);

/** Personalities that use the LOMintEnergy artwork (Discovery / Genesis Seeker) */
export const DISCOVERY_PERSONALITY_IDS = new Set(["genesis-seeker"]);

/** @deprecated Use DISCOVERY_PERSONALITY_IDS */
export const MINT_PERSONALITY_IDS = DISCOVERY_PERSONALITY_IDS;

/** Personalities that use the LOActiveMover artwork */
export const ACTIVE_MOVER_PERSONALITY_IDS = new Set(["active-mover"]);

/** Personalities that use the LOCollectionLoyalist artwork */
export const LOYALIST_PERSONALITY_IDS = new Set(["collection-loyalist"]);

/** Personalities that use the LOVaultKeeper artwork */
export const VAULT_KEEPER_PERSONALITY_IDS = new Set(["vault-keeper"]);

export function isCollectorPersonality(personalityId: string): boolean {
  return COLLECTOR_PERSONALITY_IDS.has(personalityId);
}

export function isDiamondPersonality(personalityId: string): boolean {
  return DIAMOND_PERSONALITY_IDS.has(personalityId);
}

export function isExplorerPersonality(personalityId: string): boolean {
  return EXPLORER_PERSONALITY_IDS.has(personalityId);
}

export function isDiscoveryPersonality(personalityId: string): boolean {
  return DISCOVERY_PERSONALITY_IDS.has(personalityId);
}

/** @deprecated Use isDiscoveryPersonality */
export function isMintPersonality(personalityId: string): boolean {
  return isDiscoveryPersonality(personalityId);
}

export function isActiveMoverPersonality(personalityId: string): boolean {
  return ACTIVE_MOVER_PERSONALITY_IDS.has(personalityId);
}

export function isLoyalistPersonality(personalityId: string): boolean {
  return LOYALIST_PERSONALITY_IDS.has(personalityId);
}

export function isArtWandererPersonality(personalityId: string): boolean {
  return ART_WANDERER_PERSONALITY_IDS.has(personalityId);
}

export function isVaultKeeperPersonality(personalityId: string): boolean {
  return VAULT_KEEPER_PERSONALITY_IDS.has(personalityId);
}

export function isBalancedCollectorPersonality(personalityId: string): boolean {
  return BALANCED_COLLECTOR_PERSONALITY_IDS.has(personalityId);
}

export function getOllieHeroClassName(personalityId: string): string {
  if (isDiamondPersonality(personalityId)) return " wdna-hero__ollie--diamond";
  if (isArtWandererPersonality(personalityId)) return " wdna-hero__ollie--art-wanderer";
  if (isExplorerPersonality(personalityId)) return " wdna-hero__ollie--explorer";
  if (isDiscoveryPersonality(personalityId)) return " wdna-hero__ollie--mint";
  if (isActiveMoverPersonality(personalityId)) return " wdna-hero__ollie--active-mover";
  if (isLoyalistPersonality(personalityId)) return " wdna-hero__ollie--loyalist";
  if (isVaultKeeperPersonality(personalityId)) return " wdna-hero__ollie--vault-keeper";
  if (isBalancedCollectorPersonality(personalityId)) return " wdna-hero__ollie--balanced";
  if (isCollectorPersonality(personalityId)) return " wdna-hero__ollie--collector";
  return "";
}

export function getOllieImageSrc(personalityId: string): string {
  return getOllieDisplaySrc(getOlliePngFilename(personalityId));
}

/** Full PNG path for export / rasterisation */
export function getOllieImageExportSrc(personalityId: string): string {
  return getOllieExportSrc(getOlliePngFilename(personalityId));
}

function getOlliePngFilename(personalityId: string): string {
  if (isDiamondPersonality(personalityId)) return "LODiamondHand.png";
  if (isExplorerPersonality(personalityId)) return "LOExplorer.png";
  if (isArtWandererPersonality(personalityId)) return "LOArtWanderer.png";
  if (isDiscoveryPersonality(personalityId)) return "LOMintEnergy.png";
  if (isActiveMoverPersonality(personalityId)) return "LOActiveMover.png";
  if (isLoyalistPersonality(personalityId)) return "LOCollectionLoyalist.png";
  if (isVaultKeeperPersonality(personalityId)) return "LOVaultKeeper.png";
  if (isBalancedCollectorPersonality(personalityId)) return "LOBalanced.png";
  if (isCollectorPersonality(personalityId)) return "LOCollector.png";
  return "default.png";
}

export function getOllieVariantForPersonality(personalityId: string, ollieVariant: string): string {
  if (isDiamondPersonality(personalityId)) return "diamond";
  if (isExplorerPersonality(personalityId)) return "explorer";
  if (isArtWandererPersonality(personalityId)) return "art-wanderer";
  if (isDiscoveryPersonality(personalityId)) return "mint";
  if (isActiveMoverPersonality(personalityId)) return "active-mover";
  if (isLoyalistPersonality(personalityId)) return "loyalty";
  if (isVaultKeeperPersonality(personalityId)) return "vault";
  if (isBalancedCollectorPersonality(personalityId)) return "balanced";
  if (isCollectorPersonality(personalityId)) return "collector";
  const byPersonality: Record<string, string> = {
    "base-pioneer": "explorer",
  };
  if (byPersonality[personalityId]) return byPersonality[personalityId]!;
  if (ollieVariant.includes("diamond")) return "diamond";
  if (ollieVariant.includes("explorer")) return "explorer";
  return "default";
}

export function getPassportOllieClassName(variant: string): string {
  if (variant === "diamond") return " wdna-passport-ollie--diamond";
  if (variant === "explorer") return " wdna-passport-ollie--explorer";
  if (variant === "art-wanderer") return " wdna-passport-ollie--art-wanderer";
  if (variant === "mint") return " wdna-passport-ollie--mint";
  if (variant === "active-mover") return " wdna-passport-ollie--active-mover";
  if (variant === "loyalty") return " wdna-passport-ollie--loyalist";
  if (variant === "vault") return " wdna-passport-ollie--vault-keeper";
  if (variant === "balanced") return " wdna-passport-ollie--balanced";
  if (variant === "collector") return " wdna-passport-ollie--collector";
  return "";
}
