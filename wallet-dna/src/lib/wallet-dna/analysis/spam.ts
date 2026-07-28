import type { NormalizedNFT } from "@/lib/wallet-dna/types";

const PHISHING_PATTERNS = [
  /claim\s+your/i,
  /free\s+mint/i,
  /airdrop\s+now/i,
  /visit\s+.*\.(xyz|top|click|ru)/i,
  /wallet\s+drain/i,
];

export function isSpamNft(raw: {
  contractAddress?: string;
  title?: string | null;
  collectionName?: string | null;
  imageUrl?: string | null;
  providerSpam?: boolean;
  isHidden?: boolean;
}): boolean {
  if (raw.providerSpam) return true;
  if (raw.isHidden) return true;
  if (!raw.contractAddress || !/^0x[a-f0-9]{40}$/i.test(raw.contractAddress)) return true;

  const text = `${raw.title ?? ""} ${raw.collectionName ?? ""}`.trim();
  if (text) {
    for (const p of PHISHING_PATTERNS) {
      if (p.test(text)) return true;
    }
  }
  return false;
}

export function filterIncludedNfts(nfts: NormalizedNFT[]): {
  included: NormalizedNFT[];
  excludedSpam: number;
  rawCount: number;
} {
  const rawCount = nfts.length;
  const included = nfts.filter((n) => !n.isSpam);
  return { included, excludedSpam: rawCount - included.length, rawCount };
}
