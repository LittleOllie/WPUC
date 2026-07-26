import { describe, it, expect } from "vitest";
import { computeAvatarPositions, pngFilename } from "@/lib/image/layout";

describe("svg layout", () => {
  it("places avatars in a circle", () => {
    const slots = computeAvatarPositions("inner", 4);
    expect(slots).toHaveLength(4);
    expect(slots[0]?.x).toBeGreaterThan(0);
    expect(slots[0]?.size).toBeGreaterThan(0);
  });

  it("offsets rings differently", () => {
    const inner = computeAvatarPositions("inner", 6)[0]?.angle ?? 0;
    const besties = computeAvatarPositions("besties", 6)[0]?.angle ?? 0;
    expect(inner).not.toBe(besties);
  });

  it("returns empty for zero count", () => {
    expect(computeAvatarPositions("community", 0)).toEqual([]);
  });

  it("builds png filename", () => {
    expect(pngFilename("Jack", new Date("2026-07-26T00:00:00Z"))).toBe("x-inner-circle-jack-2026-07-26.png");
  });
});
