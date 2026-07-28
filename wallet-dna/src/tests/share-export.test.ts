import { describe, expect, it } from "vitest";
import { isProxiableImageUrl } from "@/lib/wallet-dna/utils/image-proxy";
import { shareHighlightFacts } from "@/lib/wallet-dna/share-export";

describe("isProxiableImageUrl", () => {
  it("allows common NFT image hosts", () => {
    expect(isProxiableImageUrl("https://ipfs.io/ipfs/QmTest/image.png")).toBe(true);
    expect(isProxiableImageUrl("https://nft-cdn.alchemy.com/nft-mainnet/image.png")).toBe(true);
  });

  it("blocks video and non-https URLs", () => {
    expect(isProxiableImageUrl("https://ipfs.io/ipfs/QmTest/527.mp4")).toBe(false);
    expect(isProxiableImageUrl("http://ipfs.io/ipfs/x.png")).toBe(false);
    expect(isProxiableImageUrl("https://evil.example.com/nft.png")).toBe(false);
  });
});

describe("shareHighlightFacts", () => {
  it("filters NaN and invalid date strings", () => {
    const facts = shareHighlightFacts([
      {
        type: "longest-held",
        supportingText: "Held for NaN days · Received Invalid Date",
      },
      {
        type: "most-held-collection",
        collection: { collectionName: "TOLLBOUND", currentQuantity: 45, chain: "ethereum" },
      },
    ]);
    expect(facts.some((f) => /NaN|Invalid Date/i.test(f))).toBe(false);
    expect(facts[0]).toContain("TOLLBOUND");
  });
});
