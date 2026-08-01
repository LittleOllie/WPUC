import { SCHEMA_VERSION, SCORING_VERSION } from "@/lib/wallet-dna/constants";
import type {
  AnalysisContext,
  AnalysisCoverage,
  NormalizedNFT,
  NormalizedNFTTransfer,
  SupportedChain,
  WalletDNAResult,
} from "@/lib/wallet-dna/types";
import { filterIncludedNfts } from "@/lib/wallet-dna/analysis/spam";
import { groupCollections } from "@/lib/wallet-dna/analysis/normalise";
import { calculateScores } from "@/lib/wallet-dna/analysis/scores";
import { selectPersonality, enrichPersonalityCopy } from "@/lib/wallet-dna/analysis/personalities";
import {
  buildScoreDebug,
} from "@/lib/wallet-dna/analysis/diamond-hands-diagnostics";
import { evaluateBadges } from "@/lib/wallet-dna/analysis/badges";
import { generateNarrative } from "@/lib/wallet-dna/analysis/narrative";
import { buildWalletVisuals } from "@/lib/wallet-dna/analysis/visuals";
import { median, maxOf } from "@/lib/wallet-dna/utils/helpers";

function buildStats(
  included: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
  excludedSpam: number,
  rawCount: number,
): AnalysisContext["stats"] {
  const eth = included.filter((n) => n.chain === "ethereum");
  const base = included.filter((n) => n.chain === "base");
  const chains: SupportedChain[] = [];
  if (eth.length) chains.push("ethereum");
  if (base.length) chains.push("base");

  const holdDays: number[] = [];
  const now = Date.now();
  for (const n of included) {
    if (n.acquiredAt) {
      holdDays.push(Math.floor((now - new Date(n.acquiredAt).getTime()) / 86400000));
    }
  }

  const timestamps = transfers.map((t) => t.timestamp).filter(Boolean) as string[];
  timestamps.sort();

  const collections = groupCollections(included, transfers);

  return {
    nftsCurrentlyHeld: included.reduce((s, n) => s + n.balance, 0),
    uniqueCurrentCollections: new Set(included.map((n) => `${n.chain}:${n.contractAddress}`)).size,
    chainsUsed: chains,
    firstKnownActivity: timestamps[0] ?? null,
    longestCurrentHoldDays: maxOf(holdDays),
    medianCurrentHoldDays: median(holdDays),
    identifiedMints: transfers.filter((t) => t.isMint).length,
    inboundTransfers: transfers.filter((t) => t.direction === "inbound").length,
    outboundTransfers: transfers.filter((t) => t.direction === "outbound").length,
    mostHeldCollection: collections[0]?.collectionName ?? null,
    ethereumNftCount: eth.reduce((s, n) => s + n.balance, 0),
    baseNftCount: base.reduce((s, n) => s + n.balance, 0),
    spamExcluded: excludedSpam,
    rawNftCount: rawCount,
  };
}

export function runAnalysisFromData(
  walletAddress: string,
  ensName: string | null,
  nfts: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
  coverage: AnalysisCoverage,
  options?: { scoreDebug?: boolean },
): { result: WalletDNAResult; includedNfts: NormalizedNFT[] } {
  const { included, excludedSpam, rawCount } = filterIncludedNfts(nfts);

  if (included.length === 0 && transfers.length === 0) {
    throw new Error("NO_NFT_ACTIVITY");
  }

  if (included.length === 0 && transfers.length > 0) {
    throw new Error("NO_NFT_ACTIVITY");
  }

  const collections = groupCollections(included, transfers);
  const stats = buildStats(included, transfers, excludedSpam, rawCount);

  const ctx: AnalysisContext = {
    walletAddress,
    nfts: included,
    transfers,
    collections,
    coverage,
    stats,
  };

  const scores = calculateScores(ctx);
  const personality = enrichPersonalityCopy(selectPersonality(ctx, scores), scores);
  const badges = evaluateBadges(ctx, scores, walletAddress);

  const warnings: string[] = [
    "Obvious spam and malformed NFT records were excluded where identifiable.",
  ];
  if (coverage.ethereum.capped || coverage.base.capped) {
    warnings.push("Some historical activity could not be fully analysed, so a few scores have limited confidence.");
  }

  const partialResult: WalletDNAResult = {
    schemaVersion: SCHEMA_VERSION,
    scoringVersion: SCORING_VERSION,
    walletAddress,
    ensName,
    generatedAt: new Date().toISOString(),
    chainsAnalysed: stats.chainsUsed.length ? stats.chainsUsed : (["ethereum", "base"] as SupportedChain[]),
    analysisCoverage: coverage,
    personality,
    scores,
    stats,
    badges,
    topCollections: collections.slice(0, 5),
    narrative: "",
    warnings,
    visuals: buildWalletVisuals(
      walletAddress,
      included,
      transfers,
      collections,
      stats.ethereumNftCount,
      stats.baseNftCount,
    ),
  };

  partialResult.narrative = generateNarrative(partialResult);
  if (options?.scoreDebug) {
    partialResult.scoreDebug = buildScoreDebug(ctx);
  }
  return { result: partialResult, includedNfts: included };
}

export function stripScoreDebug(result: WalletDNAResult): WalletDNAResult {
  if (!result.scoreDebug) return result;
  const stripped = { ...result };
  delete stripped.scoreDebug;
  return stripped;
}

export async function runWalletDNAAnalysisFull(
  input: string,
  env: import("@/lib/wallet-dna/env").WalletDNAEnv,
): Promise<{ result: WalletDNAResult; includedNfts: NormalizedNFT[] }> {
  const { resolveWalletInput } = await import("@/lib/wallet-dna/utils/ens");
  const { FIXTURE_WALLETS, getFixtureResult, analyseWithProvider } = await import(
    "@/lib/wallet-dna/providers/fixtures"
  );

  const { address, ensName } = await resolveWalletInput(input);

  if (env.useFixtures && FIXTURE_WALLETS[address.toLowerCase()]) {
    const out = await getFixtureResult(address, FIXTURE_WALLETS[address.toLowerCase()]!, env);
    return out!;
  }

  if (!env.alchemyApiKey) {
    throw new Error("PROVIDER_UNAVAILABLE");
  }

  return analyseWithProvider(address, ensName, env.alchemyApiKey, env.maxTransfersPerChain, env);
}

export async function runWalletDNAAnalysis(
  input: string,
  env: import("@/lib/wallet-dna/env").WalletDNAEnv,
): Promise<WalletDNAResult> {
  const { result } = await runWalletDNAAnalysisFull(input, env);
  return result;
}
