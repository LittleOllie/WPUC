import { describe, it, expect } from "vitest";
import { recencyWeight, daysBetween } from "@/lib/analysis/recency-weight";

describe("recency-weight", () => {
  it("applies full weight inside 7 days", () => {
    const ref = new Date("2026-07-26T00:00:00Z");
    const recent = new Date("2026-07-24T00:00:00Z").toISOString();
    expect(recencyWeight(recent, ref)).toBe(1);
  });

  it("decays for older interactions", () => {
    const ref = new Date("2026-07-26T00:00:00Z");
    const older = new Date("2026-06-01T00:00:00Z").toISOString();
    expect(recencyWeight(older, ref)).toBeLessThan(1);
    expect(recencyWeight(older, ref)).toBe(0.65);
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-07-20T00:00:00Z", new Date("2026-07-26T00:00:00Z"))).toBe(6);
  });
});
