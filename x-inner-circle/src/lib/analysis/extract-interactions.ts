import type { InteractionEvent, InteractionType } from "@/lib/analysis/types";
import type { XPost, XUser } from "@/lib/x-api/types";

export function interactionDedupeKey(e: InteractionEvent): string {
  return `${e.postId}::${e.type}::${e.targetUserId}`;
}

export function dedupeEvents(events: InteractionEvent[]): InteractionEvent[] {
  const seen = new Set<string>();
  const out: InteractionEvent[] = [];
  for (const e of events) {
    const key = interactionDedupeKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function pushEvent(
  events: InteractionEvent[],
  partial: Omit<InteractionEvent, "direction"> & { direction?: InteractionEvent["direction"] },
): void {
  events.push({
    ...partial,
    direction: partial.direction ?? "outbound",
  });
}

export function extractInteractionsFromPosts(
  targetUserId: string,
  posts: XPost[],
  usersById: Map<string, XUser>,
): InteractionEvent[] {
  const events: InteractionEvent[] = [];
  const seenPosts = new Set<string>();

  for (const post of posts) {
    if (seenPosts.has(post.id)) continue;
    seenPosts.add(post.id);

    const authorId = post.author_id;
    const createdAt = post.created_at;
    const conversationId = post.conversation_id ?? null;

    if (authorId === targetUserId) {
      if (post.in_reply_to_user_id && post.in_reply_to_user_id !== targetUserId) {
        pushEvent(events, {
          sourceUserId: targetUserId,
          targetUserId: post.in_reply_to_user_id,
          postId: post.id,
          conversationId,
          createdAt,
          type: "reply_sent",
          weightSource: "author_reply",
          direction: "outbound",
        });
      }

      for (const m of post.entities?.mentions ?? []) {
        const mentioned = [...usersById.values()].find(
          (u) => u.username.toLowerCase() === m.username.toLowerCase(),
        );
        if (mentioned && mentioned.id !== targetUserId) {
          pushEvent(events, {
            sourceUserId: targetUserId,
            targetUserId: mentioned.id,
            postId: post.id,
            conversationId,
            createdAt,
            type: "mention_sent",
            weightSource: "entities.mentions",
            direction: "outbound",
          });
        }
      }

      for (const ref of post.referenced_tweets ?? []) {
        if (ref.type === "quoted") {
          const quotedAuthor = ref.author_id;
          if (quotedAuthor && quotedAuthor !== targetUserId) {
            pushEvent(events, {
              sourceUserId: targetUserId,
              targetUserId: quotedAuthor,
              postId: post.id,
              conversationId,
              createdAt,
              type: "quote_sent",
              weightSource: "referenced_tweets.quoted",
              direction: "outbound",
            });
          }
        }
        if (ref.type === "retweeted") {
          const rtAuthor = ref.author_id;
          if (rtAuthor && rtAuthor !== targetUserId) {
            pushEvent(events, {
              sourceUserId: targetUserId,
              targetUserId: rtAuthor,
              postId: post.id,
              conversationId,
              createdAt,
              type: "repost_sent",
              weightSource: "referenced_tweets.retweeted",
              direction: "outbound",
            });
          }
        }
      }
    } else {
      if (post.in_reply_to_user_id === targetUserId) {
        pushEvent(events, {
          sourceUserId: authorId,
          targetUserId: targetUserId,
          postId: post.id,
          conversationId,
          createdAt,
          type: "reply_received",
          weightSource: "in_reply_to_user_id",
          direction: "inbound",
        });
      }

      for (const m of post.entities?.mentions ?? []) {
        const targetUser = usersById.get(targetUserId);
        if (targetUser && m.username.toLowerCase() === targetUser.username.toLowerCase()) {
          pushEvent(events, {
            sourceUserId: authorId,
            targetUserId: targetUserId,
            postId: post.id,
            conversationId,
            createdAt,
            type: "mention_received",
            weightSource: "entities.mentions",
            direction: "inbound",
          });
        }
      }

      for (const ref of post.referenced_tweets ?? []) {
        if (ref.type === "quoted" && ref.author_id === targetUserId) {
          pushEvent(events, {
            sourceUserId: authorId,
            targetUserId: targetUserId,
            postId: post.id,
            conversationId,
            createdAt,
            type: "quote_received",
            weightSource: "referenced_tweets.quoted",
            direction: "inbound",
          });
        }
      }
    }
  }

  return dedupeEvents(events);
}

export function groupEventsByCounterparty(
  targetUserId: string,
  events: InteractionEvent[],
  usersById: Map<string, XUser>,
): Map<
  string,
  {
    username: string;
    displayName: string;
    profileImageUrl: string | null;
    events: InteractionEvent[];
    followerCount?: number;
  }
> {
  const groups = new Map<
    string,
    {
      username: string;
      displayName: string;
      profileImageUrl: string | null;
      events: InteractionEvent[];
      followerCount?: number;
    }
  >();

  for (const e of events) {
    const counterpartyId = e.sourceUserId === targetUserId ? e.targetUserId : e.sourceUserId;
    if (!counterpartyId || counterpartyId === targetUserId) continue;

    const user = usersById.get(counterpartyId);
    if (!user) continue;
    if (user.username.toLowerCase().endsWith("bot") && (user.public_metrics?.followers_count ?? 0) < 100) {
      continue;
    }

    let g = groups.get(counterpartyId);
    if (!g) {
      g = {
        username: user.username,
        displayName: user.name,
        profileImageUrl: user.profile_image_url ?? null,
        events: [],
        followerCount: user.public_metrics?.followers_count,
      };
      groups.set(counterpartyId, g);
    }
    g.events.push(e);
  }

  return groups;
}

export type { InteractionType };
