import type { ShareCardFormat, WalletBadge, WalletDNAResult, WalletPassportStamp } from "@/lib/wallet-dna/types";
import { stableHash } from "@/lib/wallet-dna/utils/helpers";

const DIAMOND_HANDS_THRESHOLD = 65;

function badgeUnlocked(badges: WalletBadge[], id: string): boolean {
  return badges.some((b) => b.id === id && b.unlocked);
}

function firstActivityYear(result: WalletDNAResult): number | null {
  if (!result.stats.firstKnownActivity) return null;
  const y = new Date(result.stats.firstKnownActivity).getFullYear();
  return Number.isFinite(y) ? y : null;
}

function formatPassportDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase()
    .replace(/,/g, "");
}

function rotationSeed(wallet: string, stampId: string): number {
  return (stableHash(`${wallet}:${stampId}:rot`) % 17) - 8;
}

/** Build all stamp candidates from analysis — includes locked stamps for testing selection. */
export function buildPassportStampCandidates(result: WalletDNAResult): WalletPassportStamp[] {
  const badges = result.badges;
  const eth = result.stats.ethereumNftCount > 0;
  const base = result.stats.baseNftCount > 0;
  const multiChain =
    eth &&
    base &&
    result.stats.nftsCurrentlyHeld !== "unknown" &&
    (result.stats.nftsCurrentlyHeld as number) >= 3;
  const veteranYear = firstActivityYear(result);
  const threeYearsAgo = Date.now() - 3 * 365.25 * 86400000;
  const isVeteran =
    result.stats.firstKnownActivity != null &&
    new Date(result.stats.firstKnownActivity).getTime() <= threeYearsAgo;
  const diamondBadge = badgeUnlocked(badges, "diamond-hands");
  const diamondScore = result.scores.diamondHands.value >= DIAMOND_HANDS_THRESHOLD;
  const deepFreeze = badgeUnlocked(badges, "deep-freeze");
  const holdDays = result.stats.longestCurrentHoldDays;

  const wallet = result.walletAddress;

  const stamps: WalletPassportStamp[] = [
    {
      id: "wallet-dna-analysed",
      label: "WALLET DNA",
      shortLabel: "DNA",
      description: "Wallet DNA analysis completed",
      iconKey: "helix",
      styleKey: "default",
      unlocked: true,
      priority: 100,
      rotationSeed: rotationSeed(wallet, "wallet-dna-analysed"),
      subtext: "ANALYSED",
      dateText: formatPassportDate(result.generatedAt),
    },
    {
      id: "ethereum",
      label: "ETHEREUM",
      shortLabel: "ETH",
      description: "Holds included Ethereum NFTs",
      iconKey: "ethereum",
      styleKey: "ethereum",
      unlocked: eth,
      priority: 90,
      rotationSeed: rotationSeed(wallet, "ethereum"),
      subtext: "COLLECTOR",
    },
    {
      id: "base",
      label: "BASE",
      shortLabel: "BASE",
      description: "Holds included Base NFTs",
      iconKey: "base",
      styleKey: "base",
      unlocked: base,
      priority: 88,
      rotationSeed: rotationSeed(wallet, "base"),
      subtext: "EXPLORER",
    },
    {
      id: "multi-chain",
      label: "MULTI-CHAIN",
      shortLabel: "MULTI",
      description: "Meaningful activity on Ethereum and Base",
      iconKey: "multichain",
      styleKey: "multichain",
      unlocked: multiChain,
      priority: 92,
      rotationSeed: rotationSeed(wallet, "multi-chain"),
    },
    {
      id: "nft-veteran",
      label: "NFT VETERAN",
      shortLabel: "VET",
      description: "First known NFT activity at least three years ago",
      iconKey: "veteran",
      styleKey: "veteran",
      unlocked: isVeteran,
      priority: 85,
      rotationSeed: rotationSeed(wallet, "nft-veteran"),
      subtext: veteranYear ? `SINCE ${veteranYear}` : undefined,
    },
    {
      id: "diamond-hands",
      label: "DIAMOND HANDS",
      shortLabel: "DIAMOND",
      description: "Strong long-term holding pattern",
      iconKey: "diamond",
      styleKey: "diamond",
      unlocked: diamondBadge || diamondScore,
      priority: 80,
      rotationSeed: rotationSeed(wallet, "diamond-hands"),
    },
    {
      id: "deep-freeze",
      label: "DEEP FREEZE",
      shortLabel: "FREEZE",
      description: "Held an identifiable NFT for at least 730 days",
      iconKey: "freeze",
      styleKey: "diamond",
      unlocked: deepFreeze,
      priority: 78,
      rotationSeed: rotationSeed(wallet, "deep-freeze"),
      dateText: holdDays != null ? `${Math.round(holdDays).toLocaleString()} DAYS` : undefined,
    },
    {
      id: "mint-machine",
      label: "MINT MACHINE",
      shortLabel: "MINT",
      description: "Frequent identified mint activity",
      iconKey: "mint",
      styleKey: "mint",
      unlocked: badgeUnlocked(badges, "mint-machine"),
      priority: 75,
      rotationSeed: rotationSeed(wallet, "mint-machine"),
    },
    {
      id: "collection-explorer",
      label: "COLLECTION EXPLORER",
      shortLabel: "EXPLORE",
      description: "Broad collection exploration",
      iconKey: "explorer",
      styleKey: "explorer",
      unlocked: badgeUnlocked(badges, "collection-explorer"),
      priority: 74,
      rotationSeed: rotationSeed(wallet, "collection-explorer"),
    },
    {
      id: "loyal-holder",
      label: "LOYAL HOLDER",
      shortLabel: "LOYAL",
      description: "Depth in collections with sustained holding",
      iconKey: "loyalty",
      styleKey: "loyalty",
      unlocked: badgeUnlocked(badges, "loyal-holder"),
      priority: 73,
      rotationSeed: rotationSeed(wallet, "loyal-holder"),
    },
    {
      id: "vault-keeper",
      label: "VAULT KEEPER",
      shortLabel: "VAULT",
      description: "Strong retention with low outbound ratio",
      iconKey: "vault",
      styleKey: "vault",
      unlocked: badgeUnlocked(badges, "vault-keeper"),
      priority: 72,
      rotationSeed: rotationSeed(wallet, "vault-keeper"),
    },
  ];

  return stamps;
}

export const PASSPORT_STAMP_MAX: Record<ShareCardFormat, number> = {
  landscape: 6,
  square: 5,
  portrait: 7,
};

export type StampDensity = "minimal" | "standard" | "full";

function densityLimit(format: ShareCardFormat, density: StampDensity): number {
  const max = PASSPORT_STAMP_MAX[format];
  if (density === "minimal") return Math.min(3, max);
  if (density === "full") return max;
  return Math.max(1, max - 1);
}

/** Resolve chain stamp conflicts — prefer multi-chain over individual when space is tight. */
function pickChainStamps(
  candidates: WalletPassportStamp[],
  slotBudget: number,
  preferMulti: boolean,
): WalletPassportStamp[] {
  const multi = candidates.find((s) => s.id === "multi-chain" && s.unlocked);
  const eth = candidates.find((s) => s.id === "ethereum" && s.unlocked);
  const base = candidates.find((s) => s.id === "base" && s.unlocked);
  if (!eth && !base && !multi) return [];

  if (preferMulti && multi && slotBudget <= 2) return [multi];
  if (slotBudget >= 3 && eth && base && multi) return [eth, base, multi];
  if (multi && slotBudget <= 2) return [multi];
  const picked: WalletPassportStamp[] = [];
  if (eth) picked.push(eth);
  if (base && slotBudget > 1) picked.push(base);
  if (multi && slotBudget > picked.length) picked.push(multi);
  return picked.slice(0, slotBudget);
}

function personalityStampId(personalityId: string): string | null {
  const map: Record<string, string> = {
    "diamond-collector": "diamond-hands",
    "genesis-seeker": "mint-machine",
    "collection-loyalist": "loyal-holder",
    "vault-keeper": "vault-keeper",
    "multi-chain-explorer": "collection-explorer",
    "base-explorer": "base",
    "base-pioneer": "base",
  };
  return map[personalityId] ?? null;
}

export function selectPassportStamps(
  result: WalletDNAResult,
  format: ShareCardFormat,
  density: StampDensity = "standard",
): WalletPassportStamp[] {
  const candidates = buildPassportStampCandidates(result);
  const unlocked = candidates.filter((s) => s.unlocked);
  const limit = densityLimit(format, density);
  const official = unlocked.find((s) => s.id === "wallet-dna-analysed")!;
  const selected: WalletPassportStamp[] = [official];
  let remaining = limit - 1;

  const preferMulti = density !== "full" || format === "square";
  const chainBudget = format === "landscape" && density === "full" ? 3 : Math.min(2, remaining);
  const chainStamps = pickChainStamps(unlocked, chainBudget, preferMulti);
  for (const s of chainStamps) {
    if (!selected.some((x) => x.id === s.id)) {
      selected.push(s);
      remaining -= 1;
    }
  }

  const veteran = unlocked.find((s) => s.id === "nft-veteran");
  if (veteran && remaining > 0 && density !== "minimal") {
    selected.push(veteran);
    remaining -= 1;
  }

  const personalityId = personalityStampId(result.personality.id);
  if (personalityId && remaining > 0) {
    const pStamp = unlocked.find((s) => s.id === personalityId);
    if (pStamp && !selected.some((x) => x.id === pStamp.id)) {
      selected.push(pStamp);
      remaining -= 1;
    }
  }

  const achievementOrder = [
    "diamond-hands",
    "deep-freeze",
    "mint-machine",
    "collection-explorer",
    "loyal-holder",
    "vault-keeper",
  ];
  const achievements = unlocked
    .filter((s) => achievementOrder.includes(s.id))
    .sort((a, b) => b.priority - a.priority);

  for (const s of achievements) {
    if (remaining <= 0) break;
    if (selected.some((x) => x.id === s.id)) continue;
    selected.push(s);
    remaining -= 1;
  }

  return selected.slice(0, limit);
}

const CORNER_STAMP_ORDER = [
  "multi-chain",
  "nft-veteran",
  "diamond-hands",
  "deep-freeze",
  "mint-machine",
  "collection-explorer",
  "loyal-holder",
  "vault-keeper",
  "ethereum",
  "base",
] as const;

/** Single passport-style stamp for the bottom-right corner of the flagship card. */
export function selectCornerStamp(
  stamps: WalletPassportStamp[],
  personalityId: string,
): WalletPassportStamp {
  const unlocked = stamps.filter((s) => s.unlocked);
  const personalityStamp = personalityStampId(personalityId);
  if (personalityStamp) {
    const match = unlocked.find((s) => s.id === personalityStamp);
    if (match) return match;
  }

  for (const id of CORNER_STAMP_ORDER) {
    const match = unlocked.find((s) => s.id === id);
    if (match) return match;
  }

  return unlocked.find((s) => s.id === "wallet-dna-analysed") ?? stamps[0]!;
}

export function stampRotation(stamp: WalletPassportStamp, layoutIndex: number): number {
  const base = stamp.rotationSeed;
  const presetOffset = (layoutIndex % 3) * 4 - 4;
  return base + presetOffset;
}
