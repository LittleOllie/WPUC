import { describe, expect, it } from "vitest";
import type { NormalizedNFT } from "@/lib/wallet-dna/types";
import {
  addShareSelection,
  buildNftLookup,
  getSuggestedShareNFTKeys,
  keysToSelected,
  moveShareSelection,
  pruneStaleShareKeys,
  removeShareSelection,
  selectedToKeys,
} from "@/lib/wallet-dna/share-selection";
import { MAX_SHARE_CARD_NFTS } from "@/lib/wallet-dna/constants";
import { createTokenKey } from "@/lib/wallet-dna/utils/helpers";
import { buildCollectionOptions, filterPickerNfts, queryWalletNfts } from "@/lib/wallet-dna/nft-picker";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";

const WALLET = "0x1111111111111111111111111111111111111111";

function nft(tokenId: string, collection: string, chain: "ethereum" | "base" = "ethereum"): NormalizedNFT {
  return {
    chain,
    contractAddress: `0x${collection.padEnd(40, "a")}`,
    tokenId,
    tokenType: "ERC721",
    balance: 1,
    title: `${collection} #${tokenId}`,
    collectionName: collection,
    imageUrl: `https://example.com/${tokenId}.png`,
    thumbnailUrl: `https://example.com/${tokenId}.png`,
    acquiredAt: new Date().toISOString(),
    isSpam: false,
  };
}

describe("share-selection", () => {
  it("enforces maximum of four selections", () => {
    const selected = keysToSelected(["a", "b", "c", "d"]);
    const { error } = addShareSelection(selected, "e");
    expect(error).toBe("max");
  });

  it("preserves selection order", () => {
    const selected = keysToSelected(["a", "b"]);
    const moved = moveShareSelection(selected, "b", "left");
    expect(selectedToKeys(moved)).toEqual(["b", "a"]);
  });

  it("removes stale keys not in lookup", () => {
    const lookup = buildNftLookup([nft("1", "A")]);
    const key = createTokenKey("ethereum", nft("1", "A").contractAddress, "1");
    const { keys, removedCount } = pruneStaleShareKeys([key, "ethereum:0xdead:99"], lookup);
    expect(keys).toEqual([key]);
    expect(removedCount).toBe(1);
  });

  it("suggested keys exclude hidden collections", () => {
    const nfts = [nft("1", "HideMe"), nft("2", "ShowMe")];
    const hidden = [collectionKey("ethereum", nfts[0]!.contractAddress)];
    const keys = getSuggestedShareNFTKeys(WALLET, nfts, hidden);
    expect(keys.every((k) => !k.includes("HideMe"))).toBe(true);
  });
});

describe("nft-picker", () => {
  const nfts = [
    nft("1", "Alpha"),
    nft("2", "Alpha"),
    nft("3", "Beta", "base"),
    nft("4", "Gamma"),
  ];

  it("builds collection options with keys", () => {
    const cols = buildCollectionOptions(nfts);
    expect(cols.length).toBe(3);
    expect(cols[0]!.quantity).toBe(2);
  });

  it("filters by collection contract key", () => {
    const alpha = nfts[0]!.contractAddress;
    const filtered = filterPickerNfts(nfts, {
      chain: "ethereum",
      contract: alpha,
    });
    expect(filtered.every((n) => n.collectionName === "Alpha")).toBe(true);
  });

  it("searches by token id", () => {
    const filtered = filterPickerNfts(nfts, { search: "3" });
    expect(filtered.some((n) => n.tokenId === "3")).toBe(true);
  });

  it("paginates results", () => {
    const page1 = queryWalletNfts(nfts, { limit: 2 });
    expect(page1.nfts.length).toBe(2);
    expect(page1.nextCursor).toBe("2");
    const page2 = queryWalletNfts(nfts, { limit: 2, cursor: "2" });
    expect(page2.nfts.length).toBe(2);
  });

  it("distinguishes collections with same name on different chains", () => {
    const sameName = [
      { ...nft("1", "Art"), chain: "ethereum" as const },
      { ...nft("1", "Art"), chain: "base" as const, contractAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    ];
    const cols = buildCollectionOptions(sameName);
    expect(cols.length).toBe(2);
    expect(cols[0]!.key).not.toBe(cols[1]!.key);
  });
});

describe("removeShareSelection", () => {
  it("reindexes positions after removal", () => {
    const selected = keysToSelected(["a", "b", "c"]);
    const next = removeShareSelection(selected, "b");
    expect(selectedToKeys(next)).toEqual(["a", "c"]);
    expect(next.map((s) => s.position)).toEqual([1, 2]);
  });
});

describe("MAX_SHARE_CARD_NFTS", () => {
  it("is four", () => {
    expect(MAX_SHARE_CARD_NFTS).toBe(4);
  });
});
