import { describe, it, expect } from "vitest";
import { getNftFetchCacheKey } from "../site/src/js/api.js";

describe("api cache keys", () => {
  it("builds stable wallet cache keys", () => {
    const k = getNftFetchCacheKey("0xAbC", "eth", "0xdef");
    expect(k).toBe("0xabc::eth::0xdef");
  });

  it("includes minimal and thumb flags", () => {
    expect(getNftFetchCacheKey("0xabc", "eth", "", true, true)).toBe("0xabc::eth::::m1::t1");
  });
});
