import { describe, it, expect } from "vitest";
import { calculateReciprocity, reciprocityBalanceScore } from "@/lib/analysis/calculate-reciprocity";
import { calculateScoreForCandidate } from "@/lib/analysis/calculate-score";
import type { InteractionEvent } from "@/lib/analysis/types";

describe("calculate-score", () => {
  it("rewards balanced reciprocity", () => {
    expect(reciprocityBalanceScore(10, 9)).toBeGreaterThan(0.8);
    expect(reciprocityBalanceScore(30, 0)).toBe(0.2);
  });

  it("applies celebrity safeguard for one-way replies to large accounts", () => {
    const events: InteractionEvent[] = Array.from({ length: 20 }, (_, i) => ({
      sourceUserId: "target",
      targetUserId: "celebrity",
      postId: `p${i}`,
      conversationId: `c${i}`,
      createdAt: new Date().toISOString(),
      type: "reply_sent" as const,
      weightSource: "test",
      direction: "outbound" as const,
    }));
    const low = calculateScoreForCandidate("target", events, new Date(), 2_000_000);
    const balancedEvents: InteractionEvent[] = [
      ...events.slice(0, 5),
      ...events.slice(0, 5).map((e, i) => ({
        ...e,
        postId: `r${i}`,
        sourceUserId: "celebrity",
        targetUserId: "target",
        type: "reply_received" as const,
        direction: "inbound" as const,
      })),
    ];
    const better = calculateScoreForCandidate("target", balancedEvents, new Date(), 2_000_000);
    expect(better.score).toBeGreaterThan(low.score);
  });

  it("calculates reciprocity multiplier from events", () => {
    const events: InteractionEvent[] = [
      {
        sourceUserId: "a",
        targetUserId: "b",
        postId: "1",
        conversationId: "c",
        createdAt: new Date().toISOString(),
        type: "reply_sent",
        weightSource: "t",
        direction: "outbound",
      },
      {
        sourceUserId: "b",
        targetUserId: "a",
        postId: "2",
        conversationId: "c",
        createdAt: new Date().toISOString(),
        type: "reply_received",
        weightSource: "t",
        direction: "inbound",
      },
    ];
    expect(calculateReciprocity("a", "b", events)).toBeGreaterThan(1);
  });
});
