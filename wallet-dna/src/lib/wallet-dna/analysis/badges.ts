import type { AnalysisContext, WalletBadge, WalletDNAScores } from "@/lib/wallet-dna/types";
import { computeHoldMetrics } from "@/lib/wallet-dna/analysis/scores";

const BADGE_DEFS: Omit<WalletBadge, "unlocked" | "unlockedReason">[] = [
  {
    id: "diamond-hands",
    name: "Diamond Hands",
    description: "Held an identifiable current NFT for at least 365 days.",
    iconKey: "diamond",
  },
  {
    id: "deep-freeze",
    name: "Deep Freeze",
    description: "Held an identifiable current NFT for at least 730 days.",
    iconKey: "freeze",
  },
  {
    id: "base-explorer",
    name: "Base Explorer",
    description: "Currently owns at least one included NFT on Base.",
    iconKey: "base",
  },
  {
    id: "base-native",
    name: "Base Native",
    description: "Most current NFTs live on Base across several collections.",
    iconKey: "base-native",
  },
  {
    id: "nft-veteran",
    name: "NFT Veteran",
    description: "First known NFT activity at least three years ago.",
    iconKey: "veteran",
  },
  {
    id: "collection-explorer",
    name: "Collection Explorer",
    description: "Interacted with at least 25 included unique NFT contracts.",
    iconKey: "explorer",
  },
  {
    id: "world-traveller",
    name: "World Traveller",
    description: "Meaningful activity on both Ethereum and Base.",
    iconKey: "world",
  },
  {
    id: "loyal-holder",
    name: "Loyal Holder",
    description: "Depth in a collection with sustained holding.",
    iconKey: "loyalty",
  },
  {
    id: "mint-machine",
    name: "Mint Machine",
    description: "At least 25 identified mint events.",
    iconKey: "mint",
  },
  {
    id: "vault-keeper",
    name: "Vault Keeper",
    description: "Strong retention with low outbound-transfer ratio.",
    iconKey: "vault",
  },
  {
    id: "one-collection-crew",
    name: "One Collection Crew",
    description: "Holds at least ten NFTs from one legitimate collection.",
    iconKey: "crew",
  },
  {
    id: "genesis-analyst",
    name: "Genesis Analyst",
    description: "Reserved for early Wallet DNA users (requires server persistence).",
    iconKey: "genesis",
  },
];

export function evaluateBadges(
  ctx: AnalysisContext,
  scores: WalletDNAScores,
  walletAddress: string,
): WalletBadge[] {
  const nfts = ctx.nfts.filter((n) => !n.isSpam);
  const nftCount = nfts.reduce((s, n) => s + n.balance, 0);
  const ethCount = nfts.filter((n) => n.chain === "ethereum").reduce((s, n) => s + n.balance, 0);
  const baseCount = nfts.filter((n) => n.chain === "base").reduce((s, n) => s + n.balance, 0);
  const holds = computeHoldMetrics(nfts, ctx.transfers, walletAddress);
  const mints = ctx.transfers.filter((t) => t.isMint).length;
  const inbound = ctx.transfers.filter((t) => t.direction === "inbound").length;
  const outbound = ctx.transfers.filter((t) => t.direction === "outbound").length;
  const outboundRate = inbound ? outbound / inbound : 1;
  const uniqueContracts = new Set(nfts.map((n) => `${n.chain}:${n.contractAddress}`)).size;
  const baseCollections = new Set(
    nfts.filter((n) => n.chain === "base").map((n) => n.contractAddress),
  ).size;
  const largestQty = ctx.collections[0]?.currentQuantity ?? 0;

  const firstActivity = ctx.stats.firstKnownActivity
    ? new Date(ctx.stats.firstKnownActivity).getTime()
    : null;
  const threeYearsAgo = Date.now() - 3 * 365.25 * 86400000;

  const checks: Record<string, { ok: boolean; reason: string | null }> = {
    "diamond-hands": {
      ok: (holds.longestHoldDays ?? 0) >= 365,
      reason: holds.longestHoldDays != null ? `${Math.round(holds.longestHoldDays)} day hold` : null,
    },
    "deep-freeze": {
      ok: (holds.longestHoldDays ?? 0) >= 730,
      reason: holds.longestHoldDays != null ? `${Math.round(holds.longestHoldDays)} day hold` : null,
    },
    "base-explorer": { ok: baseCount >= 1, reason: baseCount >= 1 ? "Owns Base NFTs" : null },
    "base-native": {
      ok: baseCount >= 5 && baseCount / Math.max(1, nftCount) >= 0.7 && baseCollections >= 3,
      reason: "Base-heavy collection",
    },
    "nft-veteran": {
      ok: firstActivity != null && firstActivity <= threeYearsAgo,
      reason: ctx.stats.firstKnownActivity ? "Long activity history" : null,
    },
    "collection-explorer": {
      ok: uniqueContracts >= 25,
      reason: `${uniqueContracts} collections`,
    },
    "world-traveller": {
      ok: ethCount > 0 && baseCount > 0 && nftCount >= 3,
      reason: "Ethereum + Base activity",
    },
    "loyal-holder": {
      ok: largestQty >= 3 && (ctx.collections[0]?.currentOldestHoldDays ?? 0) >= 180,
      reason: "Depth with sustained hold",
    },
    "mint-machine": { ok: mints >= 25, reason: `${mints} mints identified` },
    "vault-keeper": {
      ok: scores.diamondHands.value >= 88 && outboundRate < 0.25 && inbound >= 10,
      reason: "Strong retention pattern",
    },
    "one-collection-crew": {
      ok: largestQty >= 10,
      reason: `${largestQty} in top collection`,
    },
    "genesis-analyst": { ok: false, reason: null },
  };

  return BADGE_DEFS.map((def) => {
    const c = checks[def.id] ?? { ok: false, reason: null };
    return {
      ...def,
      unlocked: c.ok,
      unlockedReason: c.ok ? c.reason : null,
    };
  });
}
