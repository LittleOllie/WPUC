import { describe, expect, it } from "vitest";
import {
  getLongestHeldNFT,
  getNewestPickup,
  getMostHeldCollectionHighlight,
  getMostActiveChainHighlight,
  selectWalletGalleryNFTs,
} from "@/lib/wallet-dna/analysis/visuals";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";
import type { NormalizedNFT, NormalizedNFTTransfer, WalletCollectionSummary } from "@/lib/wallet-dna/types";

const WALLET = "0x1111111111111111111111111111111111111111";

function nft(
  tokenId: string,
  collection: string,
  daysAgo: number,
  chain: "ethereum" | "base" = "ethereum",
): NormalizedNFT {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    chain,
    contractAddress: `0x${collection.padEnd(40, "a")}`,
    tokenId,
    tokenType: "ERC721",
    balance: 1,
    title: `${collection} #${tokenId}`,
    collectionName: collection,
    imageUrl: `https://example.com/${collection}/${tokenId}.png`,
    thumbnailUrl: `https://example.com/${collection}/${tokenId}.png`,
    acquiredAt: d.toISOString(),
    isSpam: false,
  };
}

function transfer(
  tokenId: string,
  contract: string,
  daysAgo: number,
  direction: "inbound" | "outbound",
): NormalizedNFTTransfer {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    chain: "ethereum",
    blockNumber: "1",
    transactionHash: `0x${direction}${tokenId}`,
    contractAddress: contract,
    tokenId,
    tokenType: "ERC721",
    from: direction === "outbound" ? WALLET : "0x0000000000000000000000000000000000000000",
    to: direction === "inbound" ? WALLET : "0x9999999999999999999999999999999999999999",
    timestamp: d.toISOString(),
    direction,
    isMint: direction === "inbound",
    quantity: 1,
    dedupeKey: `${direction}:${tokenId}`,
  };
}

describe("getLongestHeldNFT", () => {
  it("picks NFT with longest current uninterrupted hold", () => {
    const c1 = "0xaaa" + "a".repeat(37);
    const nfts = [nft("1", "Alpha", 100), nft("2", "Beta", 500)];
    const transfers = [
      transfer("1", c1, 100, "inbound"),
      transfer("2", `0xbbb${"b".repeat(37)}`, 500, "inbound"),
    ];
    const result = getLongestHeldNFT(nfts, transfers, WALLET);
    expect(result?.title).toBe("Oldest Friend");
    expect(result?.nft?.tokenId).toBe("2");
  });

  it("ignores original receipt after transfer out and back in", () => {
    const contract = `0xccc${"c".repeat(37)}`;
    const nfts = [nft("9", "Core", 10)];
    const transfers = [
      transfer("9", contract, 400, "inbound"),
      transfer("9", contract, 200, "outbound"),
      transfer("9", contract, 30, "inbound"),
    ];
    const result = getLongestHeldNFT(nfts, transfers, WALLET);
    expect(result?.nft?.tokenId).toBe("9");
    expect(result?.supportingText).toMatch(/Held for \d+ days/);
  });

  it("uses older provider date for oldest friend when mint transfer is missing", () => {
    const contract = `0xggg${"g".repeat(37)}`;
    const nineMonthsAgo = new Date();
    nineMonthsAgo.setDate(nineMonthsAgo.getDate() - 270);
    const held = nft("1", "Genesis", 240);
    held.contractAddress = contract;
    held.acquiredAt = nineMonthsAgo.toISOString();
    const transfers = [transfer("1", contract, 240, "inbound")];
    const result = getLongestHeldNFT([held], transfers, WALLET);
    expect(result?.nft?.tokenId).toBe("1");
    expect(result?.supportingText).toMatch(/Held for 2\d\d days/);
  });

  it("prefers the oldest provider acquiredAt across the full wallet", () => {
    const oldContract = `0xnnn${"n".repeat(37)}`;
    const midContract = `0xooo${"o".repeat(37)}`;
    const nineMonthsAgo = new Date();
    nineMonthsAgo.setDate(nineMonthsAgo.getDate() - 270);
    const oldest = nft("1", "Genesis", 100);
    oldest.contractAddress = oldContract;
    oldest.acquiredAt = nineMonthsAgo.toISOString();
    const middle = nft("2", "Middle", 50);
    middle.contractAddress = midContract;
    const transfers = [
      transfer("1", oldContract, 240, "inbound"),
      transfer("2", midContract, 50, "inbound"),
    ];
    const result = getLongestHeldNFT([oldest, middle], transfers, WALLET);
    expect(result?.nft?.tokenId).toBe("1");
    expect(result?.supportingText).toMatch(/Held for 2\d\d days/);
  });
});

describe("getNewestPickup", () => {
  it("picks most recently received current NFT", () => {
    const nfts = [nft("1", "A", 100), nft("2", "B", 5)];
    const transfers = [
      transfer("1", nfts[0]!.contractAddress, 100, "inbound"),
      transfer("2", nfts[1]!.contractAddress, 5, "inbound"),
    ];
    const result = getNewestPickup(nfts, transfers, WALLET);
    expect(result?.title).toBe("Newest Pickup");
    expect(result?.nft?.tokenId).toBe("2");
  });

  it("uses provider acquiredAt when transfer history is incomplete", () => {
    const contract = `0xddd${"d".repeat(37)}`;
    const stale = nft("1", "Stale", 461);
    stale.contractAddress = contract;
    stale.tokenId = "1";
    const recent = nft("2", "Fresh", 3);
    const transfers = [transfer("1", contract, 461, "inbound")];
    const result = getNewestPickup([stale, recent], transfers, WALLET);
    expect(result?.nft?.tokenId).toBe("2");
    expect(result?.supportingText).toMatch(/Added 3 days ago/);
  });

  it("picks provider acquiredAt when it is the newest signal", () => {
    const contract = `0xggg${"g".repeat(37)}`;
    const older = nft("1", "Older", 5);
    older.contractAddress = contract;
    const newerContract = `0xhhh${"h".repeat(37)}`;
    const newer = nft("2", "Newer", 5);
    newer.contractAddress = newerContract;
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    newer.acquiredAt = oneDayAgo;
    const transfers = [
      transfer("1", contract, 5, "inbound"),
      transfer("2", newerContract, 5, "inbound"),
    ];
    const result = getNewestPickup([older, newer], transfers, WALLET);
    expect(result?.nft?.tokenId).toBe("2");
    expect(result?.supportingText).toMatch(/Added 1 day ago/);
  });

  it("reports hours ago for very recent pickups", () => {
    const contract = `0xeee${"e".repeat(37)}`;
    const older = nft("1", "Older", 2);
    older.contractAddress = contract;
    older.acquiredAt = null;
    const recentContract = `0xfff${"f".repeat(37)}`;
    const recent = nft("42", "Fresh", 2);
    recent.contractAddress = recentContract;
    recent.acquiredAt = null;
    const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString();
    const transfers = [
      transfer("1", contract, 2, "inbound"),
      {
        ...transfer("42", recentContract, 0, "inbound"),
        tokenId: "0x2a",
        timestamp: fourHoursAgo,
      },
    ];
    const result = getNewestPickup([older, recent], transfers, WALLET);
    expect(result?.nft?.tokenId).toBe("42");
    expect(result?.supportingText).toMatch(/Added 4 hours ago/);
  });

  it("picks the NFT with the newest provider acquiredAt even without a transfer record", () => {
    const olderContract = `0xjjj${"j".repeat(37)}`;
    const newerContract = `0xkkk${"k".repeat(37)}`;
    const older = nft("1", "Older", 10);
    older.contractAddress = olderContract;
    const newer = nft("2", "Newer", 10);
    newer.contractAddress = newerContract;
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    newer.acquiredAt = oneDayAgo;
    const transfers = [transfer("1", olderContract, 10, "inbound")];
    const result = getNewestPickup([older, newer], transfers, WALLET);
    expect(result?.nft?.tokenId).toBe("2");
    expect(result?.supportingText).toMatch(/Added 1 day ago/);
  });
});

describe("getMostHeldCollectionHighlight", () => {
  it("uses factual most-held language", () => {
    const collections: WalletCollectionSummary[] = [
      {
        chain: "ethereum",
        contractAddress: "0x1",
        collectionName: "TOLLBOUND",
        currentQuantity: 45,
        totalInbound: 50,
        totalOutbound: 5,
        firstInteractionAt: null,
        latestInteractionAt: null,
        currentOldestHoldDays: 100,
      },
    ];
    const result = getMostHeldCollectionHighlight(collections, 620);
    expect(result?.title).toBe("Most-Held Collection");
    expect(result?.supportingText).toContain("45 held");
    expect(result?.supportingText).toContain("7.3%");
  });
});

describe("getMostActiveChainHighlight", () => {
  it("reports dominant chain", () => {
    const result = getMostActiveChainHighlight(471, 149);
    expect(result?.title).toBe("Most Active Chain");
    expect(result?.supportingText).toContain("Ethereum");
    expect(result?.supportingText).toContain("76%");
  });
});

describe("selectWalletGalleryNFTs", () => {
  it("is deterministic for same wallet", () => {
    const nfts: NormalizedNFT[] = [];
    for (let i = 0; i < 20; i++) {
      nfts.push(nft(String(i), `Col${i % 8}`, i, i % 2 === 0 ? "ethereum" : "base"));
    }
    const a = selectWalletGalleryNFTs(WALLET, nfts, { limit: 12 });
    const b = selectWalletGalleryNFTs(WALLET, nfts, { limit: 12 });
    expect(a.map((n) => n.tokenId)).toEqual(b.map((n) => n.tokenId));
  });

  it("excludes hidden collections", () => {
    const nfts = [nft("1", "HideMe", 1), nft("2", "ShowMe", 2)];
    const hidden = [collectionKey("ethereum", nfts[0]!.contractAddress)];
    const picked = selectWalletGalleryNFTs(WALLET, nfts, { limit: 12, hiddenCollectionKeys: hidden });
    expect(picked.every((n) => n.collectionName !== "HideMe")).toBe(true);
  });

  it("excludes spam", () => {
    const spam = { ...nft("1", "Spam", 1), isSpam: true };
    const picked = selectWalletGalleryNFTs(WALLET, [spam, nft("2", "Good", 2)], { limit: 12 });
    expect(picked.every((n) => !n.isSpam)).toBe(true);
  });
});
