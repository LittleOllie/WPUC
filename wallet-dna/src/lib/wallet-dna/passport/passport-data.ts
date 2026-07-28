import type { ShareCardFormat, WalletBadge, WalletDNAResult, WalletPassportData } from "@/lib/wallet-dna/types";
import { SCORE_LABELS } from "@/lib/wallet-dna/constants";
import { createWalletPassportNumber, createWalletPassportSeed } from "@/lib/wallet-dna/passport/passport-number";
import { selectPassportStamps, type StampDensity } from "@/lib/wallet-dna/passport/passport-stamps";
import { shortenAddress } from "@/lib/wallet-dna/utils/helpers";
import { getOllieVariantForPersonality } from "@/lib/wallet-dna/ollie-images";

const BADGE_PRIORITY = [
  "diamond-hands",
  "deep-freeze",
  "nft-veteran",
  "collection-explorer",
  "mint-machine",
  "loyal-holder",
  "vault-keeper",
  "base-explorer",
  "world-traveller",
];

function collectorSinceYear(result: WalletDNAResult): number | null {
  if (!result.stats.firstKnownActivity) return null;
  const y = new Date(result.stats.firstKnownActivity).getFullYear();
  return Number.isFinite(y) ? y : null;
}

function selectDisplayedBadges(badges: WalletBadge[]): WalletBadge[] {
  return badges
    .filter((b) => b.unlocked)
    .sort((a, b) => BADGE_PRIORITY.indexOf(a.id) - BADGE_PRIORITY.indexOf(b.id))
    .slice(0, 3);
}

function strongestTrait(result: WalletDNAResult): { name: string; value: number } {
  const keys = Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>;
  const sorted = [...keys].sort((a, b) => result.scores[b].value - result.scores[a].value);
  const top = sorted[0]!;
  return { name: SCORE_LABELS[top], value: result.scores[top].value };
}

function buildTraitCombo(result: WalletDNAResult): string | null {
  const keys = Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>;
  const ranked = keys
    .map((key) => ({ key, name: SCORE_LABELS[key], value: result.scores[key].value }))
    .sort((a, b) => b.value - a.value);

  const primary = ranked[0];
  const secondary = ranked[1];
  if (!primary || !secondary || secondary.value < 60) return null;

  if (primary.value - secondary.value <= 10) {
    return `${primary.name} ${primary.value} · ${secondary.name} ${secondary.value}`;
  }

  const personalityPrimary: Partial<Record<string, keyof typeof SCORE_LABELS>> = {
    "mint-hunter": "mintEnergy",
    "art-wanderer": "explorer",
    "base-explorer": "explorer",
    "multi-chain-explorer": "explorer",
    "diamond-collector": "diamondHands",
    "vault-keeper": "diamondHands",
    "collection-loyalist": "loyalty",
    "new-collector": "collector",
    "balanced-collector": "collector",
    "active-mover": "collector",
  };

  const expectedKey = personalityPrimary[result.personality.id];
  if (expectedKey && primary.key !== expectedKey) {
    const expected = result.scores[expectedKey];
    return `${primary.name} ${primary.value} · ${SCORE_LABELS[expectedKey]} ${expected.value}`;
  }

  return `${primary.name} ${primary.value} · ${secondary.name} ${secondary.value}`;
}

function mapOllieVariant(personalityId: string, ollieVariant: string): string {
  return getOllieVariantForPersonality(personalityId, ollieVariant);
}

export function buildWalletPassportData(
  result: WalletDNAResult,
  format: ShareCardFormat = "landscape",
  density: StampDensity = "standard",
  dnaIdSeed: string = createWalletPassportSeed(),
  passportNumber: string = createWalletPassportNumber(),
): WalletPassportData {
  const ensName = result.ensName;
  const walletIdentity = ensName ?? shortenAddress(result.walletAddress);

  return {
    passportNumber,
    walletIdentity,
    ensName,
    personalityName: result.personality.name,
    personalityId: result.personality.id,
    personalitySummary: result.personality.shareSummary,
    collectorSinceYear: collectorSinceYear(result),
    generatedAt: result.generatedAt,
    scores: result.scores,
    displayedBadges: selectDisplayedBadges(result.badges),
    stamps: selectPassportStamps(result, format, density),
    chains: result.chainsAnalysed,
    strongestTrait: strongestTrait(result),
    traitCombo: buildTraitCombo(result),
    ollieVariant: mapOllieVariant(result.personality.id, result.personality.ollieVariant),
    fingerprintSeed: result.walletAddress,
    scoringVersion: result.scoringVersion,
    walletAddress: result.walletAddress,
  };
}

export function passportShareText(data: WalletPassportData, siteUrl: string): string {
  const url = `${siteUrl}/wallet-dna/?wallet=${encodeURIComponent(data.walletAddress)}`;
  return [
    `My Wallet DNA: ${data.personalityName} 🧬`,
    data.personalitySummary,
    "",
    `Collector ${data.scores.collector.value} · Explorer ${data.scores.explorer.value} · Diamond Hands ${data.scores.diamondHands.value}`,
    "",
    `DNA ID: ${data.passportNumber}`,
    "",
    `Discover your Wallet DNA: ${url}`,
  ].join("\n");
}

export function passportExportFilename(walletAddress: string): string {
  const short = walletAddress.replace(/^0x/i, "").slice(0, 8);
  return `wallet-dna-profile-${short}.png`;
}
