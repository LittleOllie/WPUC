import { describe, it, expect } from "vitest";
import { assignRings } from "@/lib/analysis/assign-rings";
import type { CandidateAccount } from "@/lib/analysis/types";

function mockCandidate(id: string, score: number, reciprocity: number, twoWay = true): CandidateAccount {
  return {
    userId: id,
    username: id,
    displayName: id,
    profileImageUrl: null,
    rawEvents: [],
    counts: {
      reply_sent: twoWay ? 3 : 10,
      reply_received: twoWay ? 3 : 0,
      mention_sent: 0,
      mention_received: 0,
      quote_sent: 0,
      quote_received: 0,
      repost_sent: 0,
      conversation_exchange: 0,
    },
    reciprocity,
    uniqueConversationCount: 3,
    activeDays: 3,
    activeWeeks: 2,
    latestInteractionAt: new Date().toISOString(),
    score,
    confidence: "medium",
    ring: null,
    explanation: ["test"],
  };
}

describe("assign-rings", () => {
  it("assigns deterministically by score", () => {
    const candidates = [
      mockCandidate("a", 100, 1.4),
      mockCandidate("b", 90, 1.3),
      mockCandidate("c", 80, 1.2),
    ];
    const rings = assignRings(candidates);
    expect(rings.inner.map((c) => c.userId)).toEqual(["a", "b", "c"]);
  });

  it("does not force rings to be full", () => {
    const rings = assignRings([mockCandidate("solo", 50, 1.1)]);
    const total = rings.inner.length + rings.besties.length + rings.goodFriends.length + rings.community.length;
    expect(total).toBeLessThanOrEqual(1);
  });

  it("requires two-way interaction for inner circle by default", () => {
    const rings = assignRings([
      mockCandidate("one-way", 200, 1.05, false),
      mockCandidate("two-way", 120, 1.4, true),
    ]);
    expect(rings.inner.some((c) => c.userId === "two-way")).toBe(true);
    expect(rings.inner.some((c) => c.userId === "one-way")).toBe(false);
  });
});
