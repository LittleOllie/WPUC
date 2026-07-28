import type { WalletDNAResult } from "@/lib/wallet-dna/types";
import { stableHash } from "@/lib/wallet-dna/utils/helpers";

const TEMPLATES: Record<string, string[]> = {
  "diamond-collector": [
    "You are a {personality}. Your wallet favours long-term ownership{fHold}. You have explored {collections} collections across {chains}, but your strongest pattern is patience rather than constant movement.",
    "As a {personality}, you tend to hold what you collect. With a median current hold of {medianHold} days, your wallet reads as steady rather than restless.",
  ],
  "base-explorer": [
    "You are a {personality}. Base plays a leading role in your collecting, with {baseCount} current NFTs there across {baseCollections} collections.",
    "Your {personality} profile shows meaningful Base activity — {baseCount} NFTs on Base shape how your wallet DNA reads today.",
  ],
  "mint-hunter": [
    "You are a {personality}. With {mints} identified mint events, a meaningful share of your inbound activity starts at the source.",
    "As a {personality}, direct mints feature prominently — {mints} mint events appear in your public history.",
  ],
  "collection-loyalist": [
    "You are a {personality}. Your deepest relationship is with {topCollection}, where you currently hold {topQty} NFTs.",
    "Your {personality} pattern shows repeated depth — {topCollection} stands out in your current holdings.",
  ],
  "balanced-collector": [
    "You are a {personality}. Your wallet balances breadth and depth with {nftCount} current NFTs across {collections} collections on {chains}.",
    "As a {personality}, no single trait dominates — you collect across {collections} collections with a mix of holding and discovery.",
  ],
  default: [
    "You are a {personality}. Your wallet currently holds {nftCount} NFTs across {collections} collections on {chains}.",
    "Your Wallet DNA reads as {personality} — {nftCount} NFTs and {collections} collections shape this profile.",
  ],
};

export function generateNarrative(result: Pick<
  WalletDNAResult,
  "personality" | "walletAddress" | "stats" | "scores" | "topCollections" | "chainsAnalysed"
>): string {
  const id = result.personality.id;
  const pool = TEMPLATES[id] ?? TEMPLATES.default!;
  const idx = stableHash(result.walletAddress) % pool.length;
  let text = pool[idx]!;

  const medianHold =
    result.stats.medianCurrentHoldDays != null
      ? String(Math.round(result.stats.medianCurrentHoldDays))
      : "an unknown";
  const fHold =
    result.stats.medianCurrentHoldDays != null
      ? `, with a median current holding period of ${medianHold} days`
      : "";

  const chains =
    result.chainsAnalysed.length === 2
      ? "Ethereum and Base"
      : result.chainsAnalysed[0] === "base"
        ? "Base"
        : "Ethereum";

  const top = result.topCollections[0];
  const replacements: Record<string, string> = {
    "{personality}": result.personality.name,
    "{nftCount}": String(result.stats.nftsCurrentlyHeld),
    "{collections}": String(result.stats.uniqueCurrentCollections),
    "{chains}": chains,
    "{medianHold}": medianHold,
    "{fHold}": fHold,
    "{mints}": String(result.stats.identifiedMints),
    "{baseCount}": String(result.stats.baseNftCount),
    "{baseCollections}": String(
      result.topCollections.filter((c) => c.chain === "base").length || 1,
    ),
    "{topCollection}": top?.collectionName ?? "your most-held collection",
    "{topQty}": String(top?.currentQuantity ?? 0),
  };

  for (const [k, v] of Object.entries(replacements)) {
    text = text.replaceAll(k, v);
  }
  return text;
}
