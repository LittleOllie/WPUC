import { describe, it, expect } from "vitest";
import { clampScore, createTokenKey, isValidEthAddress, median } from "@/lib/wallet-dna/utils/helpers";
import { validateWalletInput } from "@/lib/wallet-dna/utils/ens";

describe("helpers", () => {
  it("validates eth addresses", () => {
    expect(isValidEthAddress("0x1111111111111111111111111111111111111111")).toBe(true);
    expect(isValidEthAddress("not-an-address")).toBe(false);
  });

  it("clamps scores 0-100", () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-5)).toBe(0);
  });

  it("computes median", () => {
    expect(median([1, 3, 9])).toBe(3);
    expect(median([])).toBe(null);
  });

  it("creates stable token keys", () => {
    expect(createTokenKey("ethereum", "0xAbC", "1")).toBe("ethereum:0xabc:1");
    expect(createTokenKey("ethereum", "0xAbC", "0x2a")).toBe("ethereum:0xabc:42");
  });
});

describe("wallet input", () => {
  it("accepts ens and address", () => {
    expect(validateWalletInput("vitalik.eth")).toBe(true);
    expect(validateWalletInput("0x1111111111111111111111111111111111111111")).toBe(true);
    expect(validateWalletInput("!!!")).toBe(false);
  });
});
