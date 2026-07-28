import { describe, expect, it } from "vitest";
import {
  collectNftImageCandidates,
  ensureDisplayableImage,
  expandImageCandidates,
  findCollectionImageMate,
} from "@/lib/wallet-dna/utils/nft-image-candidates";
import type { NormalizedNFT } from "@/lib/wallet-dna/types";

function nft(partial: Partial<NormalizedNFT> & Pick<NormalizedNFT, "tokenId">): NormalizedNFT {
  return {
    chain: "ethereum",
    contractAddress: "0xabc",
    tokenType: "ERC721",
    balance: 1,
    title: null,
    collectionName: "Test",
    imageUrl: null,
    thumbnailUrl: null,
    acquiredAt: null,
    isSpam: false,
    ...partial,
  };
}

describe("expandImageCandidates", () => {
  it("includes proxy and alternate IPFS gateways", () => {
    const candidates = expandImageCandidates("ipfs://bafybeigdyrzt");
    expect(candidates.length).toBeGreaterThan(2);
    expect(candidates.some((u) => u.includes("nftstorage.link"))).toBe(true);
    expect(candidates.some((u) => u.includes("ipfs.io"))).toBe(true);
  });
});

describe("ensureDisplayableImage", () => {
  it("borrows artwork from another token in the same collection", () => {
    const target = nft({ tokenId: "527", imageUrl: null, thumbnailUrl: null });
    const mate = nft({
      tokenId: "1",
      imageUrl: "https://nft-cdn.alchemy.com/eth-mainnet/1.png",
      thumbnailUrl: "https://nft-cdn.alchemy.com/eth-mainnet/1-thumb.png",
    });

    const resolved = ensureDisplayableImage(target, [target, mate]);
    expect(resolved.imageUrl).toBe(mate.imageUrl);
    expect(resolved.tokenId).toBe("527");
  });
});

describe("collectNftImageCandidates", () => {
  it("includes fallback collection mate URLs", () => {
    const candidates = collectNftImageCandidates(
      nft({
        tokenId: "527",
        imageUrl: "https://broken.example/527.png",
      }),
      [
        nft({
          tokenId: "1",
          imageUrl: "https://nft-cdn.alchemy.com/eth-mainnet/1.png",
        }),
      ],
    );

    expect(candidates.some((u) => u.includes("527.png"))).toBe(true);
    expect(candidates.some((u) => u.includes("eth-mainnet/1.png"))).toBe(true);
  });
});

describe("findCollectionImageMate", () => {
  it("skips the same token id", () => {
    const only = nft({
      tokenId: "527",
      imageUrl: "https://example.com/527.png",
    });
    expect(findCollectionImageMate(only, [only])).toBeNull();
  });
});
