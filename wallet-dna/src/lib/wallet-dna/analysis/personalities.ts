import type { AnalysisContext, WalletDNAScores, WalletPersonality } from "@/lib/wallet-dna/types";
import { getTopScoreKey } from "@/lib/wallet-dna/analysis/scores";

export const PERSONALITIES: Record<string, WalletPersonality> = {
  "new-collector": {
    id: "new-collector",
    name: "New Collector",
    shortDescription:
      "Your wallet is just getting started on its collecting journey. Every great collection begins with a first piece.",
    shareSummary: "You're just getting started — every great collection begins somewhere.",
    themeKey: "starter",
    ollieVariant: "default",
    shareSubtitle: "Just getting started",
  },
  "base-explorer": {
    id: "base-explorer",
    name: "Base Explorer",
    shortDescription:
      "Base is your playground. A meaningful share of your NFT activity lives on Base, and you collect across several collections there.",
    shareSummary: "You love exploring Base and discovering what's next on your home chain.",
    themeKey: "base",
    ollieVariant: "base-explorer",
    shareSubtitle: "Base-forward collector",
  },
  "multi-chain-explorer": {
    id: "multi-chain-explorer",
    name: "Multi-Chain Explorer",
    shortDescription:
      "You collect across Ethereum and Base, exploring more than one chain rather than staying in one lane.",
    shareSummary: "You love exploring new collections across chains and enjoy discovering what's next.",
    themeKey: "multi",
    ollieVariant: "default",
    shareSubtitle: "Cross-chain collector",
  },
  "diamond-collector": {
    id: "diamond-collector",
    name: "Diamond Collector",
    shortDescription:
      "You favour long-term ownership over constant movement. Your wallet shows patience, commitment and a strong instinct for holding what matters to you.",
    shareSummary: "You build your collection patiently and value long-term ownership.",
    themeKey: "diamond",
    ollieVariant: "diamond-explorer",
    shareSubtitle: "Patient holder",
  },
  "collection-loyalist": {
    id: "collection-loyalist",
    name: "Collection Loyalist",
    shortDescription:
      "You return to the same collections again and again, building depth rather than chasing every new drop.",
    shareSummary: "You go deep on the collections you love instead of chasing every new drop.",
    themeKey: "loyalty",
    ollieVariant: "default",
    shareSubtitle: "Depth over breadth",
  },
  "mint-hunter": {
    id: "mint-hunter",
    name: "Mint Hunter",
    shortDescription:
      "You show up at the source. A meaningful share of your inbound NFT activity comes from direct mints.",
    shareSummary: "You show up at the source and love being early when something new mints.",
    themeKey: "mint",
    ollieVariant: "default",
    shareSubtitle: "Mint-forward",
  },
  "active-mover": {
    id: "active-mover",
    name: "Active Mover",
    shortDescription:
      "You actively move through the NFT ecosystem, regularly discovering, collecting and transferring assets.",
    shareSummary: "You're always in motion — collecting, trading and staying close to the action.",
    themeKey: "active",
    ollieVariant: "default",
    shareSubtitle: "Always in motion",
  },
  "art-wanderer": {
    id: "art-wanderer",
    name: "Art Wanderer",
    shortDescription:
      "Your wallet roams across many collections without locking into one dominant theme — variety is your pattern.",
    shareSummary: "You roam across collections with wide-ranging taste and curiosity.",
    themeKey: "wanderer",
    ollieVariant: "default",
    shareSubtitle: "Wide-ranging taste",
  },
  "vault-keeper": {
    id: "vault-keeper",
    name: "Vault Keeper",
    shortDescription:
      "What enters your wallet tends to stay. Outbound transfers are rare compared with your holding history.",
    shareSummary: "What enters your wallet tends to stay — you're built for the long hold.",
    themeKey: "vault",
    ollieVariant: "diamond-explorer",
    shareSubtitle: "Long-term vault",
  },
  "balanced-collector": {
    id: "balanced-collector",
    name: "Balanced Collector",
    shortDescription:
      "Your collecting style balances breadth, depth and activity without one trait dominating everything else.",
    shareSummary: "You collect with balance — breadth, depth and patience all in the mix.",
    themeKey: "balanced",
    ollieVariant: "default",
    shareSubtitle: "Well-rounded collector",
  },
};

export function selectPersonality(ctx: AnalysisContext, scores: WalletDNAScores): WalletPersonality {
  const nfts = ctx.nfts.filter((n) => !n.isSpam);
  const nftCount = nfts.reduce((s, n) => s + n.balance, 0);
  const transfers = ctx.transfers.length;
  const ethCount = nfts.filter((n) => n.chain === "ethereum").reduce((s, n) => s + n.balance, 0);
  const baseCount = nfts.filter((n) => n.chain === "base").reduce((s, n) => s + n.balance, 0);
  const total = ethCount + baseCount || 1;
  const baseShare = baseCount / total;
  const outbound = ctx.transfers.filter((t) => t.direction === "outbound").length;
  const inbound = ctx.transfers.filter((t) => t.direction === "inbound").length;
  const outboundRate = inbound ? outbound / inbound : 0;
  const mints = ctx.transfers.filter((t) => t.isMint).length;
  const mintShare = inbound ? mints / inbound : 0;

  const top = getTopScoreKey(scores);
  const sorted = Object.values(scores).map((s) => s.value).sort((a, b) => b - a);
  const second = sorted[1] ?? 0;

  if (nftCount < 3 && transfers < 5) return PERSONALITIES["new-collector"]!;

  if (baseShare >= 0.6 && baseCount >= 5 && ctx.collections.filter((c) => c.chain === "base").length >= 3) {
    return PERSONALITIES["base-explorer"]!;
  }

  if (
    (top === "diamondHands" || scores.diamondHands.value >= second - 5) &&
    scores.diamondHands.value >= 78 &&
    scores.collector.value >= 40
  ) {
    return PERSONALITIES["diamond-collector"]!;
  }

  if (scores.loyalty.value >= 80 && nftCount > 0) {
    return PERSONALITIES["collection-loyalist"]!;
  }

  if (scores.mintEnergy.value >= 78 && mintShare >= 0.25 && top === "mintEnergy") {
    return PERSONALITIES["mint-hunter"]!;
  }

  if (outboundRate >= 0.45 && transfers >= 15) {
    return PERSONALITIES["active-mover"]!;
  }

  if (
    scores.explorer.value >= 72 &&
    scores.loyalty.value < 70 &&
    scores.mintEnergy.value < 85 &&
    scores.diamondHands.value < 80
  ) {
    return PERSONALITIES["art-wanderer"]!;
  }

  const ethShare = ethCount / total;
  if (
    ethCount >= 5 &&
    baseCount >= 5 &&
    ethShare >= 0.3 &&
    baseShare >= 0.3 &&
    scores.explorer.value >= 82 &&
    top === "explorer"
  ) {
    return PERSONALITIES["multi-chain-explorer"]!;
  }

  if (scores.diamondHands.value >= 88 && outboundRate < 0.2 && nftCount >= 5) {
    return PERSONALITIES["vault-keeper"]!;
  }

  return PERSONALITIES["balanced-collector"]!;
}
