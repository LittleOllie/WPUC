import type { AnalysisContext } from "@/lib/wallet-dna/types";
import { clampScore } from "@/lib/wallet-dna/utils/helpers";

function uniqueCollectionScore(n: number): number {
  if (n === 0) return 0;
  if (n === 1) return 15;
  if (n <= 4) return 30;
  if (n <= 9) return 50;
  if (n <= 24) return 70;
  if (n <= 49) return 85;
  return 100;
}

export type DiscoveryMetrics = {
  mintShare: number;
  uniqueMintCollections: number;
  earlyParticipationCollections: number;
  purchasesWithin24h: number;
  purchasesWithin7d: number;
  newerCollections: number;
  emergingCollectionRatio: number;
  recentMultiChainActivity: boolean;
  discoveryValue: number;
};

const DAY_MS = 86400000;

/** Earliest inbound timestamp per contract for this wallet. */
function firstInboundByContract(
  inbound: AnalysisContext["transfers"],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of inbound) {
    if (!t.timestamp) continue;
    const key = `${t.chain}:${t.contractAddress}`;
    const ts = new Date(t.timestamp).getTime();
    const prev = map.get(key);
    if (prev === undefined || ts < prev) map.set(key, ts);
  }
  return map;
}

export function computeDiscoveryMetrics(ctx: AnalysisContext): DiscoveryMetrics {
  const inbound = ctx.transfers.filter((t) => t.direction === "inbound");
  const inboundCount = inbound.length;
  const mints = inbound.filter((t) => t.isMint);
  const mintShare = inboundCount ? mints.length / inboundCount : 0;
  const mintContracts = new Set(mints.map((m) => `${m.chain}:${m.contractAddress}`));
  const uniqueMintCollections = mintContracts.size;

  const walletFirstByContract = firstInboundByContract(inbound);
  let purchasesWithin24h = 0;
  let purchasesWithin7d = 0;
  let earlyParticipationCollections = 0;

  for (const [contractKey, firstTs] of walletFirstByContract) {
    const contractInbound = inbound.filter(
      (t) => `${t.chain}:${t.contractAddress}` === contractKey,
    );
    let participatedEarly = false;

    for (const t of contractInbound) {
      if (!t.timestamp) continue;
      const ts = new Date(t.timestamp).getTime();
      const hoursFromFirst = (ts - firstTs) / (1000 * 60 * 60);

      if (t.isMint) {
        participatedEarly = true;
        if (hoursFromFirst <= 24) purchasesWithin24h++;
        if (hoursFromFirst <= 24 * 7) purchasesWithin7d++;
        continue;
      }

      if (hoursFromFirst <= 24) {
        purchasesWithin24h++;
        participatedEarly = true;
      } else if (hoursFromFirst <= 24 * 7) {
        purchasesWithin7d++;
        participatedEarly = true;
      }
    }

    if (participatedEarly) earlyParticipationCollections++;
  }

  const uniqueCollections = Math.max(
    walletFirstByContract.size,
    ctx.collections.length,
    1,
  );
  const now = Date.now();

  let newerCollections = 0;
  let emergingCollections = 0;
  for (const c of ctx.collections) {
    if (!c.firstInteractionAt) continue;
    const ageDays = (now - new Date(c.firstInteractionAt).getTime()) / DAY_MS;
    if (ageDays <= 180) newerCollections++;
    if (ageDays <= 365) emergingCollections++;
  }

  const emergingCollectionRatio = ctx.collections.length
    ? emergingCollections / ctx.collections.length
    : 0;

  const recentWindowMs = 90 * DAY_MS;
  const recentEth = inbound.some(
    (t) =>
      t.chain === "ethereum" &&
      t.timestamp &&
      now - new Date(t.timestamp).getTime() <= recentWindowMs,
  );
  const recentBase = inbound.some(
    (t) =>
      t.chain === "base" &&
      t.timestamp &&
      now - new Date(t.timestamp).getTime() <= recentWindowMs,
  );
  const recentMultiChainActivity = recentEth && recentBase;

  const mintShareScore = clampScore(mintShare * 100);
  const mintBreadthScore = uniqueCollectionScore(Math.min(uniqueMintCollections, 40));
  const earlyParticipationRate = clampScore(
    (earlyParticipationCollections / uniqueCollections) * 100,
  );
  const earlyWindowScore = clampScore(
    Math.min(100, purchasesWithin24h * 8 + purchasesWithin7d * 3),
  );
  const newerCollectionScore = clampScore(Math.min(100, newerCollections * 10));
  const emergingScore = clampScore(emergingCollectionRatio * 100);
  const ecosystemScore = recentMultiChainActivity ? 100 : recentEth || recentBase ? 55 : 0;

  const discoveryValue = clampScore(
    mintShareScore * 0.22 +
      mintBreadthScore * 0.15 +
      earlyParticipationRate * 0.22 +
      earlyWindowScore * 0.13 +
      newerCollectionScore * 0.13 +
      emergingScore * 0.08 +
      ecosystemScore * 0.07,
  );

  return {
    mintShare,
    uniqueMintCollections,
    earlyParticipationCollections,
    purchasesWithin24h,
    purchasesWithin7d,
    newerCollections,
    emergingCollectionRatio,
    recentMultiChainActivity,
    discoveryValue,
  };
}
