/** Plain-language rules shown on the methodology page. Keep in sync with analysis logic. */

export const PERSONALITY_RULES: Array<{ name: string; criteria: string }> = [
  {
    name: "New Collector",
    criteria: "Fewer than 3 NFTs held and fewer than 5 total transfers.",
  },
  {
    name: "Base Explorer",
    criteria: "At least 60% of NFTs on Base, 5+ Base NFTs, and 3+ Base collections.",
  },
  {
    name: "Diamond Collector",
    criteria: "Diamond Hands is the top score (or within 5 points of top), Diamond Hands ≥ 78, Collector ≥ 40.",
  },
  {
    name: "Collection Loyalist",
    criteria: "Loyalty score ≥ 80.",
  },
  {
    name: "Genesis Seeker",
    criteria: "Discovery score ≥ 78 and Discovery is your highest score.",
  },
  {
    name: "Active Mover",
    criteria: "Outbound transfers are at least 45% of inbound transfers, with 15+ total transfers.",
  },
  {
    name: "Art Wanderer",
    criteria: "Explorer ≥ 72, with Loyalty, Discovery, and Diamond Hands all below typical specialist levels.",
  },
  {
    name: "Multi-Chain Explorer",
    criteria: "5+ NFTs on Ethereum and Base, each chain ≥ 30% of holdings, Explorer ≥ 82 and top score.",
  },
  {
    name: "Vault Keeper",
    criteria: "Diamond Hands ≥ 88, low outbound activity (< 20% of inbound), 5+ NFTs held.",
  },
  {
    name: "Balanced Collector",
    criteria: "Default when no specialist personality matches — a well-rounded mix of traits.",
  },
];

export const BADGE_RULES: Array<{ name: string; criteria: string }> = [
  { name: "Diamond Hands", criteria: "Currently hold an NFT for at least 365 days." },
  { name: "Deep Freeze", criteria: "Currently hold an NFT for at least 730 days." },
  { name: "Base Explorer", criteria: "Own at least one included NFT on Base." },
  {
    name: "Base Native",
    criteria: "5+ Base NFTs, 70%+ of holdings on Base, across 3+ Base collections.",
  },
  { name: "NFT Veteran", criteria: "First known NFT activity at least three years ago." },
  { name: "Collection Explorer", criteria: "25+ unique collections in the wallet." },
  { name: "World Traveller", criteria: "Meaningful holdings on both Ethereum and Base." },
  {
    name: "Loyal Holder",
    criteria: "3+ NFTs in your largest collection, held for 180+ days in that collection.",
  },
  { name: "Mint Machine", criteria: "25+ identified mint events in transfer history." },
  {
    name: "Vault Keeper",
    criteria: "Diamond Hands score ≥ 88, low outbound ratio, and meaningful transfer history.",
  },
  { name: "One Collection Crew", criteria: "10+ NFTs from a single collection." },
];
