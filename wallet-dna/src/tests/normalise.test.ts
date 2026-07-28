import { describe, expect, it } from "vitest";
import { mapAssetTransfer } from "@/lib/wallet-dna/analysis/normalise";

const WALLET = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

describe("mapAssetTransfer", () => {
  it("maps inbound erc721 mint transfers", () => {
    const items = mapAssetTransfer(
      "ethereum",
      {
        from: "0x0000000000000000000000000000000000000000",
        to: WALLET,
        hash: "0xhash",
        blockNum: "0x10",
        category: "erc721",
        erc721TokenId: "0x1",
        rawContract: { address: "0xabcabcabcabcabcabcabcabcabcabcabcabcabca" },
        metadata: { blockTimestamp: "2024-01-01T00:00:00.000Z" },
        uniqueId: "abc",
      },
      "inbound",
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.direction).toBe("inbound");
    expect(items[0]?.isMint).toBe(true);
    expect(items[0]?.tokenId).toBe("1");
  });

  it("maps outbound erc1155 transfers", () => {
    const items = mapAssetTransfer(
      "base",
      {
        from: WALLET,
        to: "0x1111111111111111111111111111111111111111",
        hash: "0xout",
        blockNum: "0x20",
        category: "erc1155",
        erc1155Metadata: [{ tokenId: "0x2a", value: "0x3" }],
        rawContract: { address: "0xdefdefdefdefdefdefdefdefdefdefdefdefdef" },
        uniqueId: "def",
      },
      "outbound",
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.direction).toBe("outbound");
    expect(items[0]?.tokenType).toBe("ERC1155");
    expect(items[0]?.quantity).toBe(3);
  });
});
