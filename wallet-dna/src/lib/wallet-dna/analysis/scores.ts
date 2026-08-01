import type {
  AnalysisContext,
  NormalizedNFT,
  NormalizedNFTTransfer,
  ScoreConfidence,
  WalletDNAScore,
  WalletDNAScores,
} from "@/lib/wallet-dna/types";
import { computeDiscoveryMetrics } from "@/lib/wallet-dna/analysis/discovery";
import { computeDiamondHandsDiagnostics } from "@/lib/wallet-dna/analysis/diamond-hands-diagnostics";
import { clampScore, createTokenKey, maxOf, median } from "@/lib/wallet-dna/utils/helpers";
import {
  enrichNftsWithHoldPeriods,
  hasEverOutboundFromWallet,
} from "@/lib/wallet-dna/utils/holdings";

function confidenceFromCoverage(partial: boolean, activity: number): ScoreConfidence {
  if (partial || activity < 3) return "limited";
  if (activity < 10) return "medium";
  return "high";
}

function nftCountScore(n: number): number {
  if (n === 0) return 0;
  if (n === 1) return 12;
  if (n <= 4) return 25;
  if (n <= 9) return 40;
  if (n <= 24) return 58;
  if (n <= 49) return 72;
  if (n <= 99) return 84;
  if (n <= 249) return 93;
  return 100;
}

function uniqueCollectionScore(n: number): number {
  if (n === 0) return 0;
  if (n === 1) return 15;
  if (n <= 4) return 30;
  if (n <= 9) return 50;
  if (n <= 24) return 70;
  if (n <= 49) return 85;
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

function loyaltyStickinessScore(outboundCount: number, inboundCount: number): number {
  if (inboundCount === 0) return outboundCount === 0 ? 90 : 55;
  const ratio = outboundCount / inboundCount;
  if (ratio <= 0.02) return 100;
  if (ratio <= 0.05) return 97;
  if (ratio <= 0.1) return 92;
  if (ratio <= 0.15) return 86;
  if (ratio <= 0.25) return 74;
  if (ratio <= 0.4) return 58;
  return clampScore(100 - ratio * 100);
}

function loyaltyDepthScore(largestCollectionQty: number): number {
  if (largestCollectionQty >= 20) return 100;
  if (largestCollectionQty >= 10) return 90;
  if (largestCollectionQty >= 5) return 80;
  if (largestCollectionQty >= 3) return 68;
  if (largestCollectionQty >= 2) return 55;
  if (largestCollectionQty === 1) return 45;
  return 0;
}

function computeCurrentHoldLoyalty(
  wallet: string,
  nfts: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
): number | null {
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

  return held ? neverSentOut / held : null;
}

export function computeHoldMetrics(
  nfts: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
  wallet: string,
): {
  medianHoldDays: number | null;
  longestHoldDays: number | null;
  retentionRate: number | null;
  shortTermOutboundRate: number | null;
} {
  const enriched = enrichNftsWithHoldPeriods(wallet, nfts, transfers);
  const holdDays: number[] = [];
  for (const n of enriched) {
    if (n.isSpam) continue;
    if (n.currentHoldDays != null) {
      for (let i = 0; i < n.balance; i++) holdDays.push(n.currentHoldDays);
      continue;
    }
    const ts = n.acquiredAt ? new Date(n.acquiredAt).getTime() : null;
    if (ts && ts <= Date.now()) {
      const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
      for (let i = 0; i < n.balance; i++) holdDays.push(days);
    }
  }

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
        const days = (new Date(outTs).getTime() - acq) / (1000 * 60 * 60 * 24);
        if (days <= 30) shortTermOut++;
      }
    }
  }

  return {
    medianHoldDays: median(holdDays),
    longestHoldDays: maxOf(holdDays),
    retentionRate: inboundCount ? retained / inboundCount : null,
    shortTermOutboundRate: inboundCount ? shortTermOut / inboundCount : null,
  };
}

export function calculateScores(ctx: AnalysisContext): WalletDNAScores {
  const nfts = ctx.nfts.filter((n) => !n.isSpam);
  const partial =
    ctx.coverage.ethereum.capped ||
    ctx.coverage.base.capped ||
    !ctx.coverage.ethereum.inboundTransfersComplete;

  const nftCount = nfts.reduce((s, n) => s + n.balance, 0);
  const collections = new Map<string, number>();
  for (const n of nfts) {
    const k = `${n.chain}:${n.contractAddress}`;
    collections.set(k, (collections.get(k) ?? 0) + n.balance);
  }
  const uniqueCollections = collections.size;
  const multiPiece = [...collections.values()].filter((c) => c >= 2).length;
  const multiPct = uniqueCollections ? multiPiece / uniqueCollections : 0;

  const ethCount = nfts.filter((n) => n.chain === "ethereum").reduce((s, n) => s + n.balance, 0);
  const baseCount = nfts.filter((n) => n.chain === "base").reduce((s, n) => s + n.balance, 0);
  const multiChain =
    ethCount > 0 && baseCount > 0 ? 100 : ethCount > 0 || baseCount > 0 ? 50 : 0;

  const collectorValue = clampScore(
    nftCountScore(nftCount) * 0.35 +
      uniqueCollectionScore(uniqueCollections) * 0.3 +
      clampScore(multiPct * 100) * 0.2 +
      multiChain * 0.15,
  );

  const holds = computeHoldMetrics(nfts, ctx.transfers, ctx.walletAddress);
  const diamondDiagnostics = computeDiamondHandsDiagnostics(ctx);
  const retentionScore =
    holds.retentionRate != null ? clampScore(holds.retentionRate * 100) : 45;

  const diamondValue = diamondDiagnostics.finalScore;

  const interactedCollections = ctx.collections.length;
  const largestShare =
    nftCount > 0
      ? Math.max(...[...collections.values()].map((v) => v / nftCount))
      : 1;
  const outsideLargest = clampScore((1 - largestShare) * 100);

  const explorerValue = clampScore(
    uniqueCollectionScore(interactedCollections) * 0.4 +
      multiChain * 0.25 +
      outsideLargest * 0.2 +
      clampScore(Math.min(100, uniqueCollections * 4)) * 0.15,
  );

  const discoveryMetrics = computeDiscoveryMetrics(ctx);
  const discoveryValue = discoveryMetrics.discoveryValue;

  const largestCollectionQty = collections.size ? Math.max(...collections.values()) : 0;
  const depthScore = loyaltyDepthScore(largestCollectionQty);

  const outboundCount = ctx.transfers.filter((t) => t.direction === "outbound").length;
  const inboundCount = ctx.transfers.filter((t) => t.direction === "inbound").length;
  const outboundRatio = inboundCount ? outboundCount / inboundCount : 0;
  const stickinessScore = loyaltyStickinessScore(outboundCount, inboundCount);
  const currentHoldLoyalty = computeCurrentHoldLoyalty(ctx.walletAddress, nfts, ctx.transfers);
  const currentHoldScore =
    currentHoldLoyalty != null ? clampScore(currentHoldLoyalty * 100) : retentionScore;

  const loyaltyValue = clampScore(
    stickinessScore * 0.3 +
      currentHoldScore * 0.25 +
      retentionScore * 0.2 +
      longestHoldScore(holds.longestHoldDays) * 0.15 +
      depthScore * 0.1,
  );

  const activity = ctx.transfers.length + nftCount;
  const conf = (partial: boolean) => confidenceFromCoverage(partial, activity);

  const mk = (value: number, summary: string, factors: WalletDNAScore["factors"]): WalletDNAScore => ({
    value,
    confidence: conf(partial),
    summary,
    factors,
  });

  return {
    collector: mk(collectorValue, "Breadth and depth of current NFT ownership.", [
      { label: "Current NFTs", value: String(nftCount) },
      { label: "Unique collections", value: String(uniqueCollections) },
    ]),
    diamondHands: mk(diamondValue, diamondDiagnostics.warnings[0] ?? "Holding duration and retention behaviour.", [
      {
        label: "Median hold (days)",
        value:
          diamondDiagnostics.reconciledMedianHoldingDays?.toFixed(0) ??
          holds.medianHoldDays?.toFixed(0) ??
          "Unknown",
      },
      {
        label: "Longest hold (days)",
        value: String(
          diamondDiagnostics.oldestCurrentHoldingDays ??
            holds.longestHoldDays?.toFixed(0) ??
            "Unknown",
        ),
      },
      {
        label: "Held 365+ days",
        value: `${diamondDiagnostics.currentAssetsOver365DaysPercent}% of current assets`,
      },
      {
        label: "Retention rate",
        value:
          holds.retentionRate != null ? `${Math.round(holds.retentionRate * 100)}%` : "Unknown",
      },
    ]),
    explorer: mk(explorerValue, "Variety across chains and collections.", [
      { label: "Collections interacted", value: String(interactedCollections) },
      { label: "Multi-chain", value: ethCount > 0 && baseCount > 0 ? "Yes" : "Single chain" },
    ]),
    discovery: mk(
      discoveryValue,
      "Early participation across mints, early buys, and newer collections.",
      [
        {
          label: "Mint share of inbound",
          value: `${Math.round(discoveryMetrics.mintShare * 100)}%`,
        },
        {
          label: "Early participation collections",
          value: String(discoveryMetrics.earlyParticipationCollections),
        },
        {
          label: "Purchases within 7 days",
          value: String(discoveryMetrics.purchasesWithin7d),
        },
        {
          label: "Newer collections (180d)",
          value: String(discoveryMetrics.newerCollections),
        },
      ],
    ),
    loyalty: mk(
      loyaltyValue,
      "Commitment to holding — low selling, strong retention, and staying power.",
      [
        {
          label: "Outbound vs inbound",
          value: inboundCount ? `${Math.round(outboundRatio * 100)}%` : "Unknown",
        },
        {
          label: "Current holds never sold",
          value:
            currentHoldLoyalty != null ? `${Math.round(currentHoldLoyalty * 100)}%` : "Unknown",
        },
        {
          label: "Retention rate",
          value: holds.retentionRate != null ? `${Math.round(holds.retentionRate * 100)}%` : "Unknown",
        },
      ],
    ),
  };
}

export function getTopScoreKey(scores: WalletDNAScores): keyof WalletDNAScores {
  const entries = Object.entries(scores) as [keyof WalletDNAScores, WalletDNAScore][];
  entries.sort((a, b) => b[1].value - a[1].value);
  return entries[0]?.[0] ?? "collector";
}
