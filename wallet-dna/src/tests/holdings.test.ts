import { describe, expect, it } from "vitest";
import type { NormalizedNFT, NormalizedNFTTransfer } from "@/lib/wallet-dna/types";
import {
  currentHoldStartedAt,
  enrichNftsWithHoldPeriods,
  newestHighlightTimestamp,
  oldestHighlightTimestamp,
  resolveCurrentHoldStartedAt,
} from "@/lib/wallet-dna/utils/holdings";

const WALLET = "0xabc12345678901234567890123456789012345678";
const CONTRACT = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

function inbound(tokenId: string, daysAgo: number, to = WALLET): NormalizedNFTTransfer {
  const d = new Date();
  d.setTime(d.getTime() - daysAgo * 86400000);
  return {
    chain: "ethereum",
    blockNumber: "1",
    transactionHash: `0xin${tokenId}`,
    contractAddress: CONTRACT,
    tokenId,
    tokenType: "ERC721",
    from: "0x0000000000000000000000000000000000000000",
    to: to.toLowerCase(),
    timestamp: d.toISOString(),
    direction: "inbound",
    isMint: true,
    quantity: 1,
    dedupeKey: `in:${tokenId}`,
  };
}

function outbound(tokenId: string, daysAgo: number, from = WALLET): NormalizedNFTTransfer {
  const d = new Date();
  d.setTime(d.getTime() - daysAgo * 86400000);
  return {
    chain: "ethereum",
    blockNumber: "2",
    transactionHash: `0xout${tokenId}`,
    contractAddress: CONTRACT,
    tokenId,
    tokenType: "ERC721",
    from: from.toLowerCase(),
    to: "0x9999999999999999999999999999999999999999",
    timestamp: d.toISOString(),
    direction: "outbound",
    isMint: false,
    quantity: 1,
    dedupeKey: `out:${tokenId}`,
  };
}

function nft(tokenId: string): NormalizedNFT {
  return {
    chain: "ethereum",
    contractAddress: CONTRACT,
    tokenId,
    tokenType: "ERC721",
    balance: 1,
    title: `Test #${tokenId}`,
    collectionName: "Test",
    imageUrl: null,
    acquiredAt: null,
    isSpam: false,
  };
}

describe("currentHoldStartedAt", () => {
  it("uses latest inbound after outbound transfer", () => {
    const transfers = [
      inbound("1", 400),
      outbound("1", 200),
      inbound("1", 50),
    ];
    const started = currentHoldStartedAt(WALLET, "ethereum", CONTRACT, "1", transfers);
    expect(started).toBe(transfers[2]!.timestamp);
  });

  it("returns null when wallet no longer holds token", () => {
    const transfers = [inbound("2", 100), outbound("2", 10)];
    const started = currentHoldStartedAt(WALLET, "ethereum", CONTRACT, "2", transfers);
    expect(started).toBeNull();
  });
});

describe("enrichNftsWithHoldPeriods", () => {
  it("computes current hold days from uninterrupted period", () => {
    const transfers = [inbound("3", 30)];
    const enriched = enrichNftsWithHoldPeriods(WALLET, [nft("3")], transfers);
    expect(enriched[0]!.currentHoldDays).toBeGreaterThanOrEqual(29);
    expect(enriched[0]!.currentHoldDays).toBeLessThanOrEqual(31);
  });

  it("prefers newer provider acquiredAt over stale partial transfer history", () => {
    const d = new Date();
    d.setDate(d.getDate() - 4);
    const withAcquired: NormalizedNFT = {
      ...nft("4"),
      acquiredAt: d.toISOString(),
    };
    const transfers = [inbound("4", 400)];
    const enriched = enrichNftsWithHoldPeriods(WALLET, [withAcquired], transfers);
    expect(enriched[0]!.currentHoldDays).toBeGreaterThanOrEqual(3);
    expect(enriched[0]!.currentHoldDays).toBeLessThanOrEqual(5);
  });
});

describe("resolveCurrentHoldStartedAt", () => {
  it("prefers transfer walk when provider is only slightly newer", () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const withAcquired: NormalizedNFT = {
      ...nft("5"),
      acquiredAt: d.toISOString(),
    };
    const transfers = [inbound("5", 300), inbound("5", 12)];
    const resolved = resolveCurrentHoldStartedAt(WALLET, withAcquired, transfers);
    expect(resolved).toBe(transfers[1]!.timestamp);
  });

  it("uses older provider acquiredAt when transfer history missed the mint", () => {
    const d = new Date();
    d.setDate(d.getDate() - 270);
    const withAcquired: NormalizedNFT = {
      ...nft("7"),
      acquiredAt: d.toISOString(),
    };
    const transfers = [inbound("7", 240)];
    const resolved = resolveCurrentHoldStartedAt(WALLET, withAcquired, transfers);
    expect(resolved).toBe(d.toISOString());
  });

  it("prefers transfer history over stale provider acquiredAt", () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const withAcquired: NormalizedNFT = {
      ...nft("6"),
      acquiredAt: d.toISOString(),
    };
    const transfers = [inbound("6", 0.17)];
    const resolved = resolveCurrentHoldStartedAt(WALLET, withAcquired, transfers);
    expect(resolved).toBe(transfers[0]!.timestamp);
  });
});

describe("highlight acquisition timestamps", () => {
  it("uses the earliest provider or inbound date for oldest friend", () => {
    const d = new Date();
    d.setDate(d.getDate() - 270);
    const withAcquired: NormalizedNFT = {
      ...nft("8"),
      acquiredAt: d.toISOString(),
    };
    const transfers = [inbound("8", 240)];
    expect(oldestHighlightTimestamp(WALLET, withAcquired, transfers)).toBe(d.toISOString());
  });

  it("uses the latest provider or inbound date for newest pickup", () => {
    const d = new Date();
    d.setTime(d.getTime() - 86400000);
    const withAcquired: NormalizedNFT = {
      ...nft("9"),
      acquiredAt: d.toISOString(),
    };
    const transfers = [inbound("9", 5)];
    expect(newestHighlightTimestamp(WALLET, withAcquired, transfers)).toBe(d.toISOString());
  });
});
