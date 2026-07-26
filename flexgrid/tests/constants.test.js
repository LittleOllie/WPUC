import { describe, it, expect } from "vitest";
import {
  FLEX_GRID_MAX_NFTS,
  WHALE_MODE_THRESHOLD,
  isWhaleModeCount,
} from "../site/src/js/core/constants.js";

describe("constants", () => {
  it("enforces 900 NFT cap constant", () => {
    expect(FLEX_GRID_MAX_NFTS).toBe(900);
  });

  it("whale mode above 300", () => {
    expect(WHALE_MODE_THRESHOLD).toBe(300);
    expect(isWhaleModeCount(301)).toBe(true);
    expect(isWhaleModeCount(300)).toBe(false);
  });
});
