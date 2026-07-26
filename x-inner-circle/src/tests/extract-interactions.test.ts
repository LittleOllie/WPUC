import { describe, it, expect } from "vitest";
import { dedupeEvents, extractInteractionsFromPosts } from "@/lib/analysis/extract-interactions";
import type { XPost, XUser } from "@/lib/x-api/types";

const targetId = "t1";
const otherId = "u2";

const users = new Map<string, XUser>([
  [targetId, { id: targetId, username: "target", name: "Target" }],
  [otherId, { id: otherId, username: "other", name: "Other" }],
]);

describe("extract-interactions", () => {
  it("dedupes identical events", () => {
    const events = dedupeEvents([
      {
        sourceUserId: targetId,
        targetUserId: otherId,
        postId: "p1",
        conversationId: "c1",
        createdAt: new Date().toISOString(),
        type: "reply_sent",
        weightSource: "test",
        direction: "outbound",
      },
      {
        sourceUserId: targetId,
        targetUserId: otherId,
        postId: "p1",
        conversationId: "c1",
        createdAt: new Date().toISOString(),
        type: "reply_sent",
        weightSource: "test",
        direction: "outbound",
      },
    ]);
    expect(events).toHaveLength(1);
  });

  it("extracts reply_sent and reply_received", () => {
    const posts: XPost[] = [
      {
        id: "p1",
        author_id: targetId,
        created_at: new Date().toISOString(),
        in_reply_to_user_id: otherId,
        conversation_id: "c1",
      },
      {
        id: "p2",
        author_id: otherId,
        created_at: new Date().toISOString(),
        in_reply_to_user_id: targetId,
        conversation_id: "c2",
      },
    ];
    const events = extractInteractionsFromPosts(targetId, posts, users);
    expect(events.some((e) => e.type === "reply_sent")).toBe(true);
    expect(events.some((e) => e.type === "reply_received")).toBe(true);
  });

  it("extracts mention_sent", () => {
    const posts: XPost[] = [
      {
        id: "p3",
        author_id: targetId,
        created_at: new Date().toISOString(),
        entities: { mentions: [{ username: "other" }] },
      },
    ];
    const events = extractInteractionsFromPosts(targetId, posts, users);
    expect(events.some((e) => e.type === "mention_sent")).toBe(true);
  });
});
