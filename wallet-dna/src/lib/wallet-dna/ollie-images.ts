import { basePath } from "@/lib/wallet-dna/client";

/** Personalities that use the LOCollector artwork */
export const COLLECTOR_PERSONALITY_IDS = new Set(["new-collector"]);

/** Personalities that use the LOBalanced artwork */
export const BALANCED_COLLECTOR_PERSONALITY_IDS = new Set(["balanced-collector"]);

/** Personalities that use the LODiamondHand artwork */
export const DIAMOND_PERSONALITY_IDS = new Set(["diamond-collector"]);

/** Personalities that use the LOExplorer artwork */
export const EXPLORER_PERSONALITY_IDS = new Set(["base-explorer", "multi-chain-explorer"]);

/** Personalities that use the LOArtWanderer artwork */
export const ART_WANDERER_PERSONALITY_IDS = new Set(["art-wanderer"]);

/** Personalities that use the LOMintEnergy artwork */
export const MINT_PERSONALITY_IDS = new Set(["mint-hunter"]);

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

export function isMintPersonality(personalityId: string): boolean {
  return MINT_PERSONALITY_IDS.has(personalityId);
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
  if (isMintPersonality(personalityId)) return " wdna-hero__ollie--mint";
  if (isActiveMoverPersonality(personalityId)) return " wdna-hero__ollie--active-mover";
  if (isLoyalistPersonality(personalityId)) return " wdna-hero__ollie--loyalist";
  if (isVaultKeeperPersonality(personalityId)) return " wdna-hero__ollie--vault-keeper";
  if (isBalancedCollectorPersonality(personalityId)) return " wdna-hero__ollie--balanced";
  if (isCollectorPersonality(personalityId)) return " wdna-hero__ollie--collector";
  return "";
}

export function getOllieImageSrc(personalityId: string): string {
  if (isDiamondPersonality(personalityId)) {
    return `${basePath}/ollie/LODiamondHand.png`;
  }
  if (isExplorerPersonality(personalityId)) {
    return `${basePath}/ollie/LOExplorer.png`;
  }
  if (isArtWandererPersonality(personalityId)) {
    return `${basePath}/ollie/LOArtWanderer.png`;
  }
  if (isMintPersonality(personalityId)) {
    return `${basePath}/ollie/LOMintEnergy.png`;
  }
  if (isActiveMoverPersonality(personalityId)) {
    return `${basePath}/ollie/LOActiveMover.png`;
  }
  if (isLoyalistPersonality(personalityId)) {
    return `${basePath}/ollie/LOCollectionLoyalist.png`;
  }
  if (isVaultKeeperPersonality(personalityId)) {
    return `${basePath}/ollie/LOVaultKeeper.png`;
  }
  if (isBalancedCollectorPersonality(personalityId)) {
    return `${basePath}/ollie/LOBalanced.png`;
  }
  if (isCollectorPersonality(personalityId)) {
    return `${basePath}/ollie/LOCollector.png`;
  }
  return `${basePath}/ollie/default.png`;
}

export function getOllieVariantForPersonality(personalityId: string, ollieVariant: string): string {
  if (isDiamondPersonality(personalityId)) return "diamond";
  if (isExplorerPersonality(personalityId)) return "explorer";
  if (isArtWandererPersonality(personalityId)) return "art-wanderer";
  if (isMintPersonality(personalityId)) return "mint";
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
