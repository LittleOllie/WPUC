import { describe, expect, it } from "vitest";
import {
  ACTIVE_MOVER_PERSONALITY_IDS,
  COLLECTOR_PERSONALITY_IDS,
  DIAMOND_PERSONALITY_IDS,
  ART_WANDERER_PERSONALITY_IDS,
  BALANCED_COLLECTOR_PERSONALITY_IDS,
  EXPLORER_PERSONALITY_IDS,
  LOYALIST_PERSONALITY_IDS,
  VAULT_KEEPER_PERSONALITY_IDS,
  MINT_PERSONALITY_IDS,
  getOllieImageSrc,
  getOllieVariantForPersonality,
  isActiveMoverPersonality,
  isArtWandererPersonality,
  isBalancedCollectorPersonality,
  isCollectorPersonality,
  isDiamondPersonality,
  isExplorerPersonality,
  isLoyalistPersonality,
  isMintPersonality,
  isVaultKeeperPersonality,
} from "@/lib/wallet-dna/ollie-images";

describe("ollie image selection", () => {
  it("uses LOCollector for new collector", () => {
    for (const id of COLLECTOR_PERSONALITY_IDS) {
      expect(isCollectorPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LOCollector.webp");
      expect(getOllieVariantForPersonality(id, "default")).toBe("collector");
    }
  });

  it("uses LOBalanced for balanced collector", () => {
    for (const id of BALANCED_COLLECTOR_PERSONALITY_IDS) {
      expect(isBalancedCollectorPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LOBalanced.webp");
      expect(getOllieVariantForPersonality(id, "default")).toBe("balanced");
    }
  });

  it("uses LODiamondHand for diamond collector", () => {
    for (const id of DIAMOND_PERSONALITY_IDS) {
      expect(isDiamondPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LODiamondHand.webp");
      expect(getOllieVariantForPersonality(id, "diamond-explorer")).toBe("diamond");
    }
  });

  it("uses LOExplorer for explorer personalities", () => {
    for (const id of EXPLORER_PERSONALITY_IDS) {
      expect(isExplorerPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LOExplorer.webp");
      expect(getOllieVariantForPersonality(id, "default")).toBe("explorer");
    }
  });

  it("uses LOMintEnergy for genesis seeker (Discovery artwork)", () => {
    for (const id of MINT_PERSONALITY_IDS) {
      expect(isMintPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LOMintEnergy.webp");
      expect(getOllieVariantForPersonality(id, "default")).toBe("mint");
    }
  });

  it("uses LOActiveMover for active mover", () => {
    for (const id of ACTIVE_MOVER_PERSONALITY_IDS) {
      expect(isActiveMoverPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LOActiveMover.webp");
      expect(getOllieVariantForPersonality(id, "default")).toBe("active-mover");
    }
  });

  it("uses LOCollectionLoyalist for collection loyalist", () => {
    for (const id of LOYALIST_PERSONALITY_IDS) {
      expect(isLoyalistPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LOCollectionLoyalist.webp");
      expect(getOllieVariantForPersonality(id, "default")).toBe("loyalty");
    }
  });

  it("uses LOArtWanderer for art wanderer", () => {
    for (const id of ART_WANDERER_PERSONALITY_IDS) {
      expect(isArtWandererPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LOArtWanderer.webp");
      expect(getOllieVariantForPersonality(id, "default")).toBe("art-wanderer");
    }
  });

  it("uses LOVaultKeeper for vault keeper", () => {
    for (const id of VAULT_KEEPER_PERSONALITY_IDS) {
      expect(isVaultKeeperPersonality(id)).toBe(true);
      expect(getOllieImageSrc(id)).toContain("LOVaultKeeper.webp");
      expect(getOllieVariantForPersonality(id, "default")).toBe("vault");
    }
  });

  it("uses default Ollie for other personalities", () => {
    expect(getOllieImageSrc("base-pioneer")).toContain("default.webp");
    expect(getOllieVariantForPersonality("base-pioneer", "diamond-explorer")).toBe("explorer");
  });
});

describe("passport ollie assets", () => {
  it("resolves active mover artwork for profile card", async () => {
    const { getPassportOllieSrc } = await import("@/lib/wallet-dna/passport/ollie-assets");
    expect(getPassportOllieSrc("active-mover")).toContain("LOActiveMover.webp");
  });

  it("resolves collection loyalist artwork for profile card", async () => {
    const { getPassportOllieSrc } = await import("@/lib/wallet-dna/passport/ollie-assets");
    expect(getPassportOllieSrc("loyalty")).toContain("LOCollectionLoyalist.webp");
  });

  it("resolves art wanderer artwork for profile card", async () => {
    const { getPassportOllieSrc } = await import("@/lib/wallet-dna/passport/ollie-assets");
    expect(getPassportOllieSrc("art-wanderer")).toContain("LOArtWanderer.webp");
  });

  it("resolves vault keeper artwork for profile card", async () => {
    const { getPassportOllieSrc } = await import("@/lib/wallet-dna/passport/ollie-assets");
    expect(getPassportOllieSrc("vault")).toContain("LOVaultKeeper.webp");
  });

  it("resolves balanced collector artwork for profile card", async () => {
    const { getPassportOllieSrc } = await import("@/lib/wallet-dna/passport/ollie-assets");
    expect(getPassportOllieSrc("balanced")).toContain("LOBalanced.webp");
  });
});
