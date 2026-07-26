import { describe, it, expect } from "vitest";
import {
  isValidEvmWalletAddress,
  isValidSolanaWalletAddress,
  isValidWalletForChain,
} from "../site/src/js/wallets/walletValidation.js";

describe("walletValidation", () => {
  it("accepts valid EVM addresses", () => {
    expect(isValidEvmWalletAddress("0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3")).toBe(true);
    expect(isValidEvmWalletAddress("0xABC")).toBe(false);
  });

  it("accepts valid Solana addresses", () => {
    expect(isValidSolanaWalletAddress("7EcDhSYGxXyscQ7arQsBFHCg5h764fNiFiFcNtdgATqF")).toBe(true);
    expect(isValidSolanaWalletAddress("0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3")).toBe(false);
  });

  it("routes by chain", () => {
    expect(isValidWalletForChain("0x19d72c2e078fab2dbc70a664e18061dc06eb0fe3", "eth")).toBe(true);
    expect(isValidWalletForChain("7EcDhSYGxXyscQ7arQsBFHCg5h764fNiFiFcNtdgATqF", "solana")).toBe(true);
    expect(isValidWalletForChain("7EcDhSYGxXyscQ7arQsBFHCg5h764fNiFiFcNtdgATqF", "eth")).toBe(false);
  });
});
