import type {
  AnalysisContext,
  DiamondHandsDiagnostics,
  NormalizedNFT,
  NormalizedNFTTransfer,
  WalletDNAScoreDebug,
} from "@/lib/wallet-dna/types";
import { createTokenKey, maxOf, median } from "@/lib/wallet-dna/utils/helpers";
import {
  enrichNftsWithHoldPeriods,
  hasEverOutboundFromWallet,
  resolveCurrentHoldStartedAt,
} from "@/lib/wallet-dna/utils/holdings";

const DAY_MS = 86400000;
const RECENT_WINDOW_DAYS = 90;

function medianHoldScore(days: number | null): number {
  if (days == null) return 45;
  if (days < 7) return 10;
  if (days < 30) return 25;
  if (days < 90) return 45;
  if (days < 180) return 60;
  if (days < 365) return 75;
  if (days < 730) return 90;
  return 100;
}

function longestHoldScore(days: number | null): number {
  if (days == null) return 25;
  if (days < 30) return 10;
  if (days < 90) return 25;
  if (days < 180) return 45;
  if (days < 365) return 65;
  if (days < 730) return 85;
  return 100;
}

function holdDaysFromIso(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
}

function percentOverThreshold(holdDays: number[], threshold: number): number {
  if (!holdDays.length) return 0;
  const count = holdDays.filter((d) => d >= threshold).length;
  return Math.round((count / holdDays.length) * 1000) / 10;
}

function computeRetentionMetrics(
  nfts: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
): {
  retentionRate: number | null;
  shortTermOutboundRate: number | null;
  earliestInboundByKey: Map<string, number>;
} {
  const inboundKeys = new Set<string>();
  const outboundKeys = new Set<string>();
  const earliestInboundByKey = new Map<string, number>();

  for (const t of transfers) {
    if (!t.tokenId) continue;
    const key = createTokenKey(t.chain, t.contractAddress, t.tokenId);
    if (t.direction === "inbound") {
      inboundKeys.add(key);
      if (t.timestamp) {
        const ts = new Date(t.timestamp).getTime();
        const prev = earliestInboundByKey.get(key);
        if (prev === undefined || ts < prev) earliestInboundByKey.set(key, ts);
      }
    } else {
      outboundKeys.add(key);
    }
  }

  let retained = 0;
  let inboundCount = 0;
  let shortTermOut = 0;

  for (const key of inboundKeys) {
    inboundCount++;
    const current = nfts.some(
      (n) => !n.isSpam && createTokenKey(n.chain, n.contractAddress, n.tokenId) === key,
    );
    if (current && !outboundKeys.has(key)) retained++;

    const acq = earliestInboundByKey.get(key);
    if (acq && outboundKeys.has(key)) {
      const outTs = transfers.find(
        (t) =>
          t.direction === "outbound" &&
          createTokenKey(t.chain, t.contractAddress, t.tokenId ?? "") === key &&
          t.timestamp,
      )?.timestamp;
      if (outTs) {
        const days = (new Date(outTs).getTime() - acq) / DAY_MS;
        if (days <= 30) shortTermOut++;
      }
    }
  }

  return {
    retentionRate: inboundCount ? retained / inboundCount : null,
    shortTermOutboundRate: inboundCount ? shortTermOut / inboundCount : null,
    earliestInboundByKey,
  };
}

function computeCurrentHoldStreakScore(
  wallet: string,
  nfts: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
): { score: number; neverSentOutPercent: number | null } {
  let held = 0;
  let neverSentOut = 0;

  for (const n of nfts) {
    if (n.isSpam) continue;
    held += n.balance;
    if (
      !hasEverOutboundFromWallet(wallet, n.chain, n.contractAddress, n.tokenId, transfers)
    ) {
      neverSentOut += n.balance;
    }
  }

  if (!held) return { score: 45, neverSentOutPercent: null };
  const ratio = neverSentOut / held;
  return { score: Math.round(ratio * 100), neverSentOutPercent: Math.round(ratio * 1000) / 10 };
}

export function computeDiamondHandsDiagnostics(ctx: AnalysisContext): DiamondHandsDiagnostics {
  const wallet = ctx.walletAddress;
  const nfts = ctx.nfts.filter((n) => !n.isSpam);
  const transfers = ctx.transfers;
  const now = Date.now();

  const analysedAssetCount = nfts.reduce((s, n) => s + n.balance, 0);

  const rawHoldDays: number[] = [];
  let unknownAcquisitionDateCount = 0;

  for (const n of nfts) {
    for (let i = 0; i < n.balance; i++) {
      if (!n.acquiredAt) {
        unknownAcquisitionDateCount++;
        continue;
      }
      const ts = new Date(n.acquiredAt).getTime();
      if (ts <= now) rawHoldDays.push(Math.floor((now - ts) / DAY_MS));
    }
  }

  const enriched = enrichNftsWithHoldPeriods(wallet, nfts, transfers);
  const reconciledHoldDays: number[] = [];
  for (const n of enriched) {
    for (let i = 0; i < n.balance; i++) {
      if (n.currentHoldDays != null) reconciledHoldDays.push(n.currentHoldDays);
    }
  }

  const rawMedian = rawHoldDays.length ? median(rawHoldDays) : null;
  const reconciledMedian = reconciledHoldDays.length ? median(reconciledHoldDays) : null;
  const medianHoldingDays = reconciledMedian ?? rawMedian ?? 0;
  const averageHoldingDays = reconciledHoldDays.length
    ? Math.round(
        (reconciledHoldDays.reduce((a, b) => a + b, 0) / reconciledHoldDays.length) * 10,
      ) / 10
    : rawHoldDays.length
      ? Math.round((rawHoldDays.reduce((a, b) => a + b, 0) / rawHoldDays.length) * 10) / 10
      : 0;
  const oldestCurrentHoldingDays =
    maxOf(reconciledHoldDays) ?? maxOf(rawHoldDays) ?? 0;

  const holdDaysForBuckets = reconciledHoldDays.length ? reconciledHoldDays : rawHoldDays;

  const { retentionRate, shortTermOutboundRate } = computeRetentionMetrics(nfts, transfers);
  const retentionScore = retentionRate != null ? Math.round(retentionRate * 100) : 45;
  const shortTermScore =
    shortTermOutboundRate != null
      ? Math.max(0, Math.round(100 - shortTermOutboundRate * 100))
      : 50;

  const holdingDurationScore = medianHoldScore(reconciledMedian ?? rawMedian);
  const longTermRetentionScore = longestHoldScore(
    maxOf(reconciledHoldDays) ?? maxOf(rawHoldDays),
  );
  const streak = computeCurrentHoldStreakScore(wallet, nfts, transfers);

  const finalScore = Math.round(
    holdingDurationScore * 0.35 +
      longTermRetentionScore * 0.2 +
      retentionScore * 0.25 +
      shortTermScore * 0.2,
  );

  const inbound = transfers.filter((t) => t.direction === "inbound");
  const outbound = transfers.filter((t) => t.direction === "outbound");
  const outboundToInboundRatio = inbound.length ? outbound.length / inbound.length : null;

  const recentCutoff = now - RECENT_WINDOW_DAYS * DAY_MS;
  const recentTransfersOut = outbound.filter(
    (t) => t.timestamp && new Date(t.timestamp).getTime() >= recentCutoff,
  ).length;
  const recentSales = recentTransfersOut;

  const currentlyHeldKeys = new Set(
    nfts.flatMap((n) =>
      Array.from({ length: n.balance }, () =>
        createTokenKey(n.chain, n.contractAddress, n.tokenId),
      ),
    ),
  );

  let historicalAssetsTransferredOut = 0;
  for (const t of outbound) {
    if (!t.tokenId) continue;
    const key = createTokenKey(t.chain, t.contractAddress, t.tokenId);
    if (!currentlyHeldKeys.has(key)) historicalAssetsTransferredOut++;
  }

  const timestamps = transfers.map((t) => t.timestamp).filter(Boolean) as string[];
  timestamps.sort();
  const walletAgeDays = timestamps[0]
    ? Math.floor((now - new Date(timestamps[0]).getTime()) / DAY_MS)
    : 0;

  const transferHistoryCapped = ctx.coverage.ethereum.capped || ctx.coverage.base.capped;
  const inboundTransfersComplete =
    ctx.coverage.ethereum.inboundTransfersComplete && ctx.coverage.base.inboundTransfersComplete;

  const penalties: string[] = [];
  const warnings: string[] = [];

  if (unknownAcquisitionDateCount > 0) {
    warnings.push(
      `${unknownAcquisitionDateCount} current asset(s) have no provider acquisition date — hold duration relies on transfer history where available.`,
    );
  }

  if (rawMedian != null && reconciledMedian != null && reconciledMedian - rawMedian >= 30) {
    warnings.push(
      `Reconciled median hold (${reconciledMedian}d) is much longer than raw provider acquiredAt (${rawMedian}d) — transfer history or provider date merge corrected stale timing.`,
    );
  } else if (rawMedian == null && reconciledMedian != null) {
    warnings.push(
      `Provider acquiredAt was missing for most assets; hold duration derived from transfer history (median ${reconciledMedian}d).`,
    );
  }

  if (transferHistoryCapped) {
    penalties.push(
      "Transfer history was capped — early mints and long holds may be under-counted in retention metrics.",
    );
  }

  if (!inboundTransfersComplete) {
    penalties.push(
      "Inbound transfer history is incomplete — retention and short-term outbound rates may be unreliable.",
    );
  }

  if (retentionRate != null && retentionRate < 0.5 && outboundToInboundRatio != null && outboundToInboundRatio < 0.15) {
    penalties.push(
      "Retention rate is low despite few outbound transfers — likely incomplete inbound history rather than active selling.",
    );
  }

  if (reconciledHoldDays.length === 0 && rawHoldDays.length === 0) {
    penalties.push(
      "No credible hold-duration signal — median and longest hold defaulted to conservative scores (45 / 25).",
    );
  }

  if (holdingDurationScore <= 45 && oldestCurrentHoldingDays >= 365) {
    penalties.push(
      "Median hold score is depressed while oldest current hold exceeds 365 days — check for a few recent acquisitions pulling the median down.",
    );
  }

  return {
    finalScore,
    averageHoldingDays,
    medianHoldingDays,
    oldestCurrentHoldingDays,
    currentAssetsOver180DaysPercent: percentOverThreshold(holdDaysForBuckets, 180),
    currentAssetsOver365DaysPercent: percentOverThreshold(holdDaysForBuckets, 365),
    currentAssetsOver730DaysPercent: percentOverThreshold(holdDaysForBuckets, 730),
    historicalAssetsSold: historicalAssetsTransferredOut,
    historicalAssetsTransferredOut,
    recentSales,
    recentTransfersOut,
    walletAgeDays,
    analysedAssetCount,
    unknownAcquisitionDateCount,
    componentScores: {
      holdingDuration: holdingDurationScore,
      longTermRetention: longTermRetentionScore,
      sellBehaviour: retentionScore,
      transferBehaviour: shortTermScore,
      holdingStreak: streak.score,
    },
    penalties,
    warnings,
    rawMedianHoldingDays: rawMedian,
    reconciledMedianHoldingDays: reconciledMedian,
    retentionRate: retentionRate != null ? Math.round(retentionRate * 1000) / 1000 : null,
    shortTermOutboundRate:
      shortTermOutboundRate != null ? Math.round(shortTermOutboundRate * 1000) / 1000 : null,
    outboundToInboundRatio:
      outboundToInboundRatio != null ? Math.round(outboundToInboundRatio * 1000) / 1000 : null,
    transferHistoryCapped,
    inboundTransfersComplete,
  };
}

/** Per-token diagnostic rows for deep inspection in development. */
export function computeDiamondHandsTokenSamples(
  ctx: AnalysisContext,
  limit = 8,
): Array<{
  tokenKey: string;
  rawAcquiredAt: string | null;
  reconciledHoldStartedAt: string | null;
  holdDays: number | null;
  everOutbound: boolean;
}> {
  const wallet = ctx.walletAddress;
  const samples = ctx.nfts
    .filter((n) => !n.isSpam)
    .slice(0, limit)
    .map((n) => {
      const started = resolveCurrentHoldStartedAt(wallet, n, ctx.transfers);
      return {
        tokenKey: createTokenKey(n.chain, n.contractAddress, n.tokenId),
        rawAcquiredAt: n.acquiredAt,
        reconciledHoldStartedAt: started,
        holdDays: started ? holdDaysFromIso(started) : null,
        everOutbound: hasEverOutboundFromWallet(
          wallet,
          n.chain,
          n.contractAddress,
          n.tokenId,
          ctx.transfers,
        ),
      };
    });
  return samples;
}

export type { DiamondHandsDiagnostics, WalletDNAScoreDebug } from "@/lib/wallet-dna/types";

export function isScoreDebugEnabled(env: Record<string, string | undefined>): boolean {
  if (env.WALLET_DNA_SCORE_DEBUG === "true") return true;
  const nodeEnv = env.NODE_ENV ?? "development";
  return nodeEnv === "development" || nodeEnv === "test" || env.VITEST === "true";
}

export function buildScoreDebug(ctx: AnalysisContext): WalletDNAScoreDebug {
  return {
    diamondHands: computeDiamondHandsDiagnostics(ctx),
    tokenSamples: computeDiamondHandsTokenSamples(ctx),
  };
}
