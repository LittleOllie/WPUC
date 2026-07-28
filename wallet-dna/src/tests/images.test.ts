import { describe, expect, it } from "vitest";
import {
  hasDisplayableImage,
  normaliseNftImageUrl,
  pickNftImageUrl,
} from "@/lib/wallet-dna/utils/images";

describe("normaliseNftImageUrl", () => {
  it("converts ipfs URLs", () => {
    expect(normaliseNftImageUrl("ipfs://bafybeigdyrzt")).toContain("ipfs/");
  });

  it("converts arweave URLs", () => {
    expect(normaliseNftImageUrl("ar://abc123")).toBe("https://arweave.net/abc123");
  });

  it("rejects data URLs and SVG", () => {
    expect(normaliseNftImageUrl("data:image/png;base64,abc")).toBeNull();
    expect(normaliseNftImageUrl("https://x.com/nft.svg")).toBeNull();
    expect(normaliseNftImageUrl("https://ipfs.io/ipfs/QmVid/527.mp4")).toBeNull();
  });

  it("accepts https URLs", () => {
    expect(normaliseNftImageUrl("https://cdn.example.com/nft.png")).toBe(
      "https://cdn.example.com/nft.png",
    );
  });
});

describe("pickNftImageUrl", () => {
  it("prefers thumbnail when available", () => {
    const { thumbnailUrl, imageUrl } = pickNftImageUrl(
      "https://full.example.com/a.png",
      "https://thumb.example.com/a.png",
    );
    expect(thumbnailUrl).toBe("https://thumb.example.com/a.png");
    expect(imageUrl).toBe("https://full.example.com/a.png");
  });
});

describe("hasDisplayableImage", () => {
  it("returns true when image or thumbnail exists", () => {
    expect(hasDisplayableImage({ imageUrl: "https://a.com/x.png", thumbnailUrl: null })).toBe(true);
    expect(hasDisplayableImage({ imageUrl: null, thumbnailUrl: null })).toBe(false);
  });
});

describe("getProxiedImageSrc", () => {
  it("wraps allowed remote URLs with the proxy endpoint", async () => {
    const { getProxiedImageSrc } = await import("@/lib/wallet-dna/utils/image-proxy-url");
    const src = getProxiedImageSrc("https://nft-cdn.alchemy.com/eth-mainnet/abc.png");
    expect(src).toContain("/api/wallet-dna/image-proxy?url=");
    expect(src).toContain(encodeURIComponent("https://nft-cdn.alchemy.com/eth-mainnet/abc.png"));
  });
});
