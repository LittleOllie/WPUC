import { describe, it, expect } from "vitest";
import { computeDiscoveryMetrics } from "@/lib/wallet-dna/analysis/discovery";
import { calculateScores } from "@/lib/wallet-dna/analysis/scores";
import { getGenesisSeekerTierCopy } from "@/lib/wallet-dna/analysis/personalities";
import { runAnalysisFromData } from "@/lib/wallet-dna/analysis/run-analysis";
import { buildFixtureData } from "@/lib/wallet-dna/providers/fixture-data";
import { FIXTURE_WALLETS } from "@/lib/wallet-dna/providers/fixtures";
import type {
  AnalysisContext,
  NormalizedNFT,
  NormalizedNFTTransfer,
  WalletCollectionSummary,
  WalletDNAStats,
} from "@/lib/wallet-dna/types";

function mockStats(overrides: Partial<WalletDNAStats> = {}): WalletDNAStats {
  return {
    nftsCurrentlyHeld: 0,
    uniqueCurrentCollections: 0,
    chainsUsed: [],
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

function collectionFromNft(n: NormalizedNFT): WalletCollectionSummary {
  return {
    chain: n.chain,
    contractAddress: n.contractAddress,
    collectionName: n.collectionName ?? n.title ?? "Unknown collection",
    currentQuantity: n.balance,
    totalInbound: 1,
    totalOutbound: 0,
    firstInteractionAt: n.acquiredAt,
    latestInteractionAt: n.acquiredAt,
    currentOldestHoldDays: n.acquiredAt
      ? Math.floor((Date.now() - new Date(n.acquiredAt).getTime()) / 86400000)
      : null,
  };
}

function baseCoverage(transferCount: number): AnalysisContext["coverage"] {
  return {
    ethereum: {
      ownershipComplete: true,
      inboundTransfersComplete: true,
      outboundTransfersComplete: true,
      transferCountAnalysed: transferCount,
      capped: false,
    },
    base: {
      ownershipComplete: true,
      inboundTransfersComplete: true,
      outboundTransfersComplete: true,
      transferCountAnalysed: 0,
      capped: false,
    },
  };
}

describe("Discovery score", () => {
  it("rewards early participation share more than raw mint volume alone", () => {
    const wallet = "0xcccccccccccccccccccccccccccccccccccccccc";
    const focusedNfts: NormalizedNFT[] = [];
    const focusedTransfers: NormalizedNFTTransfer[] = [];
    for (let i = 0; i < 8; i++) {
      const contract = `0x${String(i).padStart(40, "c")}`;
      focusedNfts.push({
        chain: "ethereum",
        contractAddress: contract,
        tokenId: String(i + 1),
        tokenType: "ERC721",
        balance: 1,
        title: `Early ${i}`,
        collectionName: `Early ${i}`,
        imageUrl: null,
        acquiredAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        isSpam: false,
      });
      focusedTransfers.push({
        chain: "ethereum",
        blockNumber: "1",
        transactionHash: `0xin${i}`,
        contractAddress: contract,
        tokenId: String(i + 1),
        tokenType: "ERC721",
        from: "0x0000000000000000000000000000000000000000",
        to: wallet,
        timestamp: new Date(Date.now() - 20 * 86400000).toISOString(),
        direction: "inbound",
        isMint: true,
        quantity: 1,
        dedupeKey: `in:${i}`,
      });
    }

    const whaleNfts: NormalizedNFT[] = [];
    const whaleTransfers: NormalizedNFTTransfer[] = [];
    for (let i = 0; i < 120; i++) {
      const contract = `0x${String(i % 40).padStart(40, "d")}`;
      whaleNfts.push({
        chain: "ethereum",
        contractAddress: contract,
        tokenId: String(i + 1),
        tokenType: "ERC721",
        balance: 1,
        title: `Whale ${i}`,
        collectionName: `Whale ${i % 40}`,
        imageUrl: null,
        acquiredAt: new Date(Date.now() - 900 * 86400000).toISOString(),
        isSpam: false,
      });
      whaleTransfers.push({
        chain: "ethereum",
        blockNumber: "1",
        transactionHash: `0xw${i}`,
        contractAddress: contract,
        tokenId: String(i + 1),
        tokenType: "ERC721",
        from: "0x0000000000000000000000000000000000000000",
        to: wallet,
        timestamp: new Date(Date.now() - 900 * 86400000).toISOString(),
        direction: "inbound",
        isMint: true,
        quantity: 1,
        dedupeKey: `w:${i}`,
      });
    }
    for (let i = 0; i < 80; i++) {
      whaleTransfers.push({
        chain: "ethereum",
        blockNumber: "2",
        transactionHash: `0xsec${i}`,
        contractAddress: whaleNfts[i]!.contractAddress,
        tokenId: String(i + 200),
        tokenType: "ERC721",
        from: "0x9999999999999999999999999999999999999999",
        to: wallet,
        timestamp: new Date(Date.now() - 800 * 86400000).toISOString(),
        direction: "inbound",
        isMint: false,
        quantity: 1,
        dedupeKey: `sec:${i}`,
      });
    }

    const focusedCtx: AnalysisContext = {
      walletAddress: wallet,
      nfts: focusedNfts,
      transfers: focusedTransfers,
      collections: focusedNfts.map(collectionFromNft),
      stats: mockStats({ inboundTransfers: focusedTransfers.length }),
      coverage: baseCoverage(focusedTransfers.length),
    };

    const whaleCtx: AnalysisContext = {
      walletAddress: wallet,
      nfts: whaleNfts,
      transfers: whaleTransfers,
      collections: whaleNfts.map(collectionFromNft),
      stats: mockStats({ inboundTransfers: whaleTransfers.length }),
      coverage: baseCoverage(whaleTransfers.length),
    };

    const focusedDiscovery = calculateScores(focusedCtx).discovery.value;
    const whaleDiscovery = calculateScores(whaleCtx).discovery.value;

    expect(focusedDiscovery).toBeGreaterThan(whaleDiscovery);
  });

  it("returns bounded discovery metrics", () => {
    const wallet = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const data = buildFixtureData("mint", wallet);
    const ctx: AnalysisContext = {
      walletAddress: wallet,
      nfts: data.nfts,
      transfers: data.transfers,
      collections: data.nfts.map(collectionFromNft),
      stats: mockStats(),
      coverage: data.coverage,
    };
    const metrics = computeDiscoveryMetrics(ctx);
    expect(metrics.discoveryValue).toBeGreaterThanOrEqual(0);
    expect(metrics.discoveryValue).toBeLessThanOrEqual(100);
  });
});

describe("Genesis Seeker copy", () => {
  it("returns tiered copy by discovery score", () => {
    expect(getGenesisSeekerTierCopy(96)).toContain("true Genesis Seeker");
    expect(getGenesisSeekerTierCopy(85)).toContain("regularly discover");
    expect(getGenesisSeekerTierCopy(65)).toContain("mixing established");
    expect(getGenesisSeekerTierCopy(45)).toContain("occasionally participate");
    expect(getGenesisSeekerTierCopy(20)).toContain("proven collections");
  });
});

describe("mint fixture personality", () => {
  it("can resolve to genesis seeker with discovery-forward profile", () => {
    const wallet = Object.keys(FIXTURE_WALLETS).find((k) => FIXTURE_WALLETS[k] === "mint")!;
    const data = buildFixtureData("mint", wallet);
    const { result } = runAnalysisFromData(wallet, null, data.nfts, data.transfers, data.coverage);
    expect(result.scores.discovery.value).toBeGreaterThan(0);
    expect(result.personality.name).toBeTruthy();
    if (result.personality.id === "genesis-seeker") {
      expect(result.personality.shortDescription).toContain("discovering projects");
    }
  });
});
