import { describe, expect, it } from "vitest";
import {
  isValidEvmWalletAddress,
  normaliseWalletAddress,
  shortenWalletAddress,
  validateWalletInput,
} from "../lib/wallet";

describe("wallet utilities", () => {
  const validAddress = "0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3";

  it("trims and normalises addresses to lowercase", () => {
    expect(normaliseWalletAddress(`  ${validAddress.toUpperCase()}  `)).toBe(
      validAddress,
    );
  });

  it("validates EVM address format", () => {
    expect(isValidEvmWalletAddress(validAddress)).toBe(true);
    expect(isValidEvmWalletAddress("0xABC")).toBe(false);
    expect(isValidEvmWalletAddress("not-a-wallet")).toBe(false);
  });

  it("prevents case-insensitive duplicate normalisation collisions", () => {
    const upper = validAddress.toUpperCase();
    expect(normaliseWalletAddress(validAddress)).toBe(
      normaliseWalletAddress(upper),
    );
  });

  it("rejects blank and invalid entries via validateWalletInput", () => {
    expect(validateWalletInput("").valid).toBe(false);
    expect(validateWalletInput("   ").valid).toBe(false);
    expect(validateWalletInput("0x123").valid).toBe(false);
  });

  it("does not silently modify malformed addresses into valid ones", () => {
    const malformed = "0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3extra";
    expect(validateWalletInput(malformed).valid).toBe(false);
  });

  it("shortens wallet addresses for display", () => {
    expect(shortenWalletAddress(validAddress)).toBe("0x19d7…0fe3");
  });
});
