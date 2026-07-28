import { describe, expect, it } from "vitest";
import { estimateLoadingProgress } from "@/components/wallet-dna/WalletDNAProgress";

describe("estimateLoadingProgress", () => {
  it("never reaches 100 until completing", () => {
    expect(estimateLoadingProgress(0, false)).toBeLessThan(15);
    expect(estimateLoadingProgress(30, false)).toBeLessThan(92);
    expect(estimateLoadingProgress(120, false)).toBeLessThanOrEqual(92);
    expect(estimateLoadingProgress(120, false)).toBeGreaterThan(80);
    expect(estimateLoadingProgress(120, true)).toBe(100);
  });

  it("increases over time", () => {
    expect(estimateLoadingProgress(60, false)).toBeGreaterThan(estimateLoadingProgress(10, false));
  });
});
