import { describe, expect, it } from "vitest";
import { calculateScores } from "@/lib/wallet-dna/analysis/scores";
import {
  buildScoreDebug,
  computeDiamondHandsDiagnostics,
} from "@/lib/wallet-dna/analysis/diamond-hands-diagnostics";
import { runAnalysisFromData } from "@/lib/wallet-dna/analysis/run-analysis";
import { buildFixtureData } from "@/lib/wallet-dna/providers/fixture-data";
import type {
  AnalysisContext,
  NormalizedNFT,
  NormalizedNFTTransfer,
  WalletCollectionSummary,
  WalletDNAStats,
} from "@/lib/wallet-dna/types";

const WALLET = "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001";

function mockStats(overrides: Partial<WalletDNAStats> = {}): WalletDNAStats {
  return {
    nftsCurrentlyHeld: 0,
    uniqueCurrentCollections: 0,
    chainsUsed: ["ethereum"],
    firstKnownActivity: null,
    longestCurrentHoldDays: null,
    medianCurrentHoldDays: null,
    identifiedMints: 0,
    inboundTransfers: 0,
    outboundTransfers: 0,
    mostHeldCollection: null,
    ethereumNftCount: 0,
    baseNftCount: 0,
    spamExcluded: 0,
    rawNftCount: 0,
    ...overrides,
  };
}

function inbound(tokenId: string, daysAgo: number, contract: string): NormalizedNFTTransfer {
  return {
    chain: "ethereum",
    blockNumber: "1",
    transactionHash: `0xin${tokenId}`,
    contractAddress: contract,
    tokenId,
    tokenType: "ERC721",
    from: "0x0000000000000000000000000000000000000000",
    to: WALLET,
    timestamp: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    direction: "inbound",
    isMint: true,
    quantity: 1,
    dedupeKey: `in:${contract}:${tokenId}`,
  };
}

function coldStorageContext(): AnalysisContext {
  const nfts: NormalizedNFT[] = [];
  const transfers: NormalizedNFTTransfer[] = [];

  for (let i = 0; i < 20; i++) {
    const contract = `0x${String(i).padStart(40, "a")}`;
    nfts.push({
      chain: "ethereum",
      contractAddress: contract,
      tokenId: "1",
      tokenType: "ERC721",
      balance: 1,
      title: `Cold #${i}`,
      collectionName: `Cold ${i}`,
      imageUrl: null,
      acquiredAt: null,
      isSpam: false,
    });
    transfers.push(inbound("1", 1200 + i, contract));
  }

  transfers.push({
    chain: "ethereum",
    blockNumber: "2",
    transactionHash: "0xout-old",
    contractAddress: nfts[0]!.contractAddress,
    tokenId: "99",
    tokenType: "ERC721",
    from: WALLET,
    to: "0x9999999999999999999999999999999999999999",
    timestamp: new Date(Date.now() - 400 * 86400000).toISOString(),
    direction: "outbound",
    isMint: false,
    quantity: 1,
    dedupeKey: "out:old",
  });

  const collections: WalletCollectionSummary[] = nfts.map((n) => ({
    chain: n.chain,
    contractAddress: n.contractAddress,
    collectionName: n.collectionName ?? "Cold",
    currentQuantity: 1,
    totalInbound: 1,
    totalOutbound: 0,
    firstInteractionAt: transfers.find((t) => t.contractAddress === n.contractAddress)?.timestamp ?? null,
    latestInteractionAt: transfers.find((t) => t.contractAddress === n.contractAddress)?.timestamp ?? null,
    currentOldestHoldDays: 1200,
  }));

  return {
    walletAddress: WALLET,
    nfts,
    transfers,
    collections,
    stats: mockStats({
      nftsCurrentlyHeld: nfts.length,
      uniqueCurrentCollections: nfts.length,
      inboundTransfers: transfers.filter((t) => t.direction === "inbound").length,
      outboundTransfers: 1,
      identifiedMints: transfers.filter((t) => t.isMint).length,
      firstKnownActivity: transfers[0]?.timestamp ?? null,
    }),
    coverage: {
      ethereum: {
        ownershipComplete: true,
        inboundTransfersComplete: true,
        outboundTransfersComplete: true,
        transferCountAnalysed: transfers.length,
        capped: false,
      },
      base: {
        ownershipComplete: true,
        inboundTransfersComplete: true,
        outboundTransfersComplete: true,
        transferCountAnalysed: 0,
        capped: false,
      },
    },
  };
}

describe("Diamond Hands diagnostics", () => {
  it("exposes structured breakdown for cold-storage-like wallets", () => {
    const ctx = coldStorageContext();
    const debug = computeDiamondHandsDiagnostics(ctx);

    expect(debug.analysedAssetCount).toBe(20);
    expect(debug.unknownAcquisitionDateCount).toBe(20);
    expect(debug.reconciledMedianHoldingDays).toBeGreaterThan(1000);
    expect(debug.medianHoldingDays).toBeGreaterThan(1000);
    expect(debug.oldestCurrentHoldingDays).toBeGreaterThan(1000);
    expect(debug.currentAssetsOver365DaysPercent).toBe(100);
    expect(debug.recentTransfersOut).toBe(0);
    expect(debug.componentScores.holdingDuration).toBeGreaterThanOrEqual(90);
    expect(debug.warnings.some((w) => w.includes("no provider acquisition date"))).toBe(true);
  });

  it("scores cold storage much higher after reconciling transfer history", () => {
    const ctx = coldStorageContext();
    const scores = calculateScores(ctx);
    const debug = computeDiamondHandsDiagnostics(ctx);

    expect(scores.diamondHands.value).toBeGreaterThanOrEqual(80);
    expect(scores.diamondHands.value).toBe(debug.finalScore);
    expect(scores.diamondHands.value).toBeGreaterThan(51);
  });

  it("documents why raw acquiredAt alone would depress the score", () => {
    const ctx = coldStorageContext();
    const debug = computeDiamondHandsDiagnostics(ctx);

    expect(debug.rawMedianHoldingDays).toBeNull();
    expect(debug.warnings.length).toBeGreaterThan(0);
    expect(debug.penalties.length).toBe(0);
  });

  it("attaches scoreDebug in development analysis runs", () => {
    const wallet = "0x1111111111111111111111111111111111111111";
    const data = buildFixtureData("diamond", wallet);
    const { result } = runAnalysisFromData(wallet, null, data.nfts, data.transfers, data.coverage, {
      scoreDebug: true,
    });

    expect(result.scoreDebug?.diamondHands.finalScore).toBe(result.scores.diamondHands.value);
    expect(result.scoreDebug?.diamondHands.componentScores.holdingDuration).toBeGreaterThan(0);
    expect(result.scoreDebug?.tokenSamples?.length).toBeGreaterThan(0);
  });

  it("buildScoreDebug matches diagnostics helper", () => {
    const ctx = coldStorageContext();
    expect(buildScoreDebug(ctx).diamondHands.finalScore).toBe(
      computeDiamondHandsDiagnostics(ctx).finalScore,
    );
  });
});
