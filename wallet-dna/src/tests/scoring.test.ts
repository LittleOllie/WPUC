import { describe, it, expect } from "vitest";
import { calculateScores } from "@/lib/wallet-dna/analysis/scores";
import { runAnalysisFromData } from "@/lib/wallet-dna/analysis/run-analysis";
import { buildFixtureData } from "@/lib/wallet-dna/providers/fixture-data";
import { FIXTURE_WALLETS } from "@/lib/wallet-dna/providers/fixtures";
import type { AnalysisContext, NormalizedNFT, NormalizedNFTTransfer, WalletCollectionSummary, WalletDNAStats } from "@/lib/wallet-dna/types";

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

describe("fixture scoring", () => {
  it("produces diamond collector personality for diamond fixture", () => {
    const wallet = Object.keys(FIXTURE_WALLETS).find((k) => FIXTURE_WALLETS[k] === "diamond")!;
    const data = buildFixtureData("diamond", wallet);
    const { result } = runAnalysisFromData(wallet, null, data.nfts, data.transfers, data.coverage);
    expect(result.scores.diamondHands.value).toBeGreaterThan(50);
    expect(result.scores.collector.value).toBeGreaterThan(50);
    expect(result.personality.id).toBeTruthy();
    expect(result.narrative).toContain(result.personality.name);
    expect(result.visuals.galleryNFTs.length).toBeGreaterThan(0);
    expect(result.visuals.highlights.some((h) => h.title === "Most-Held Collection")).toBe(true);
  });

  it("throws for empty fixture", () => {
    const wallet = Object.keys(FIXTURE_WALLETS).find((k) => FIXTURE_WALLETS[k] === "empty")!;
    const data = buildFixtureData("empty", wallet);
    expect(() => runAnalysisFromData(wallet, null, data.nfts, data.transfers, data.coverage)).toThrow(
      "NO_NFT_ACTIVITY",
    );
  });

  it("scores are bounded", () => {
    const wallet = "0x2222222222222222222222222222222222222222";
    const data = buildFixtureData("base", wallet);
    const { result } = runAnalysisFromData(wallet, null, data.nfts, data.transfers, data.coverage);
    for (const s of Object.values(result.scores)) {
      expect(s.value).toBeGreaterThanOrEqual(0);
      expect(s.value).toBeLessThanOrEqual(100);
    }
  });

  it("rewards loyalty for wallets that hold without selling, even without deep stacks", () => {
    const wallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const nfts: NormalizedNFT[] = [];
    const transfers: NormalizedNFTTransfer[] = [];
    for (let i = 0; i < 12; i++) {
      const contract = `0x${String(i).padStart(40, "a")}`;
      nfts.push({
        chain: "ethereum",
        contractAddress: contract,
        tokenId: String(i + 1),
        tokenType: "ERC721",
        balance: 1,
        title: `Collection ${i} #${i + 1}`,
        collectionName: `Collection ${i}`,
        imageUrl: null,
        acquiredAt: new Date(Date.now() - 400 * 86400000).toISOString(),
        isSpam: false,
      });
      transfers.push({
        chain: "ethereum",
        blockNumber: "1",
        transactionHash: `0xin${i}`,
        contractAddress: contract,
        tokenId: String(i + 1),
        tokenType: "ERC721",
        from: "0x0000000000000000000000000000000000000000",
        to: wallet,
        timestamp: new Date(Date.now() - 400 * 86400000).toISOString(),
        direction: "inbound",
        isMint: true,
        quantity: 1,
        dedupeKey: `in:${i}`,
      });
    }

    const ctx: AnalysisContext = {
      walletAddress: wallet,
      nfts,
      transfers,
      collections: nfts.map(collectionFromNft),
      stats: mockStats({
        firstKnownActivity: transfers[0]!.timestamp,
        longestCurrentHoldDays: 400,
        nftsCurrentlyHeld: nfts.length,
        uniqueCurrentCollections: nfts.length,
        chainsUsed: ["ethereum"],
        ethereumNftCount: nfts.length,
        inboundTransfers: transfers.length,
        identifiedMints: transfers.length,
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

    const scores = calculateScores(ctx);
    expect(scores.loyalty.value).toBeGreaterThanOrEqual(80);
  });

  it("rewards low outbound ratio even when collection depth is wide not deep", () => {
    const wallet = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const nfts: NormalizedNFT[] = [];
    const transfers: NormalizedNFTTransfer[] = [];
    for (let i = 0; i < 40; i++) {
      const contract = `0x${String(i).padStart(40, "b")}`;
      nfts.push({
        chain: "ethereum",
        contractAddress: contract,
        tokenId: String(i + 1),
        tokenType: "ERC721",
        balance: 1,
        title: `Wide ${i} #${i + 1}`,
        collectionName: `Wide ${i}`,
        imageUrl: null,
        acquiredAt: new Date(Date.now() - 200 * 86400000).toISOString(),
        isSpam: false,
      });
      transfers.push({
        chain: "ethereum",
        blockNumber: "1",
        transactionHash: `0xin${i}`,
        contractAddress: contract,
        tokenId: String(i + 1),
        tokenType: "ERC721",
        from: "0x0000000000000000000000000000000000000000",
        to: wallet,
        timestamp: new Date(Date.now() - 200 * 86400000).toISOString(),
        direction: "inbound",
        isMint: true,
        quantity: 1,
        dedupeKey: `in:${i}`,
      });
    }
    transfers.push({
      chain: "ethereum",
      blockNumber: "2",
      transactionHash: "0xout1",
      contractAddress: nfts[0]!.contractAddress,
      tokenId: "1",
      tokenType: "ERC721",
      from: wallet,
      to: "0x9999999999999999999999999999999999999999",
      timestamp: new Date(Date.now() - 50 * 86400000).toISOString(),
      direction: "outbound",
      isMint: false,
      quantity: 1,
      dedupeKey: "out:1",
    });

    const ctx: AnalysisContext = {
      walletAddress: wallet,
      nfts: nfts.slice(1),
      transfers,
      collections: [],
      stats: mockStats({
        nftsCurrentlyHeld: nfts.slice(1).length,
        uniqueCurrentCollections: nfts.slice(1).length,
        chainsUsed: ["ethereum"],
        ethereumNftCount: nfts.slice(1).length,
        inboundTransfers: transfers.filter((t) => t.direction === "inbound").length,
        outboundTransfers: 1,
        identifiedMints: transfers.filter((t) => t.isMint).length,
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

    const scores = calculateScores(ctx);
    expect(scores.loyalty.value).toBeGreaterThanOrEqual(75);
  });
});
