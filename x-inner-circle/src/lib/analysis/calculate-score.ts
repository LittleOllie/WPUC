import {
  ANALYSIS_CONFIG,
  SCORING_WEIGHTS,
} from "@/lib/config";
import { calculateReciprocity } from "@/lib/analysis/calculate-reciprocity";
import { recencyWeight, countActiveDays, countActiveWeeks } from "@/lib/analysis/recency-weight";
import type {
  CandidateAccount,
  InteractionEvent,
  InteractionType,
  TargetAccount,
} from "@/lib/analysis/types";

const ALL_TYPES: InteractionType[] = [
  "reply_sent",
  "reply_received",
  "mention_sent",
  "mention_received",
  "quote_sent",
  "quote_received",
  "repost_sent",
  "conversation_exchange",
];

function emptyCounts(): Record<InteractionType, number> {
  return Object.fromEntries(ALL_TYPES.map((t) => [t, 0])) as Record<InteractionType, number>;
}

function diminishing(value: number, cap = ANALYSIS_CONFIG.diminishingReturnsCap): number {
  if (value <= 0) return 0;
  return Math.min(value, cap) + Math.log1p(Math.max(0, value - cap));
}

export function calculateScoreForCandidate(
  targetUserId: string,
  events: InteractionEvent[],
  reference = new Date(),
  followerCount = 0,
): {
  score: number;
  counts: Record<InteractionType, number>;
  reciprocity: number;
  uniqueConversationCount: number;
  activeDays: number;
  activeWeeks: number;
  latestInteractionAt: string | null;
} {
  const counts = emptyCounts();
  const conversations = new Set<string>();
  const dates: string[] = [];

  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.conversationId) conversations.add(e.conversationId);
    dates.push(e.createdAt);
  }

  let score = 0;
  for (const type of ALL_TYPES) {
    const n = counts[type] ?? 0;
    if (n <= 0) continue;
    const base = SCORING_WEIGHTS[type] ?? 1;
    const weighted = diminishing(n) * base;
    const avgRecency =
      events
        .filter((e) => e.type === type)
        .reduce((s, e) => s + recencyWeight(e.createdAt, reference), 0) / Math.max(1, n);
    score += weighted * avgRecency;
  }

  const counterpartyId = events[0]?.sourceUserId === targetUserId
    ? events[0]?.targetUserId
    : events[0]?.targetUserId === targetUserId
      ? events[0]?.sourceUserId
      : events.find((e) => e.sourceUserId !== targetUserId)?.sourceUserId ?? "";

  const reciprocity = counterpartyId
    ? calculateReciprocity(targetUserId, counterpartyId, events)
    : 1;

  score *= reciprocity;

  const uniqueConversationCount = conversations.size;
  score += uniqueConversationCount * ANALYSIS_CONFIG.uniqueConversationBonus;

  const activeDays = countActiveDays(dates);
  const activeWeeks = countActiveWeeks(dates);
  score += activeDays * ANALYSIS_CONFIG.consistencyDayBonus;
  score += activeWeeks * ANALYSIS_CONFIG.consistencyWeekBonus;

  const sent = (counts.reply_sent ?? 0) + (counts.mention_sent ?? 0) + (counts.quote_sent ?? 0);
  const received = (counts.reply_received ?? 0) + (counts.mention_received ?? 0) + (counts.quote_received ?? 0);
  const balance = sent > 0 && received > 0 ? Math.min(sent, received) / Math.max(sent, received) : 0;

  if (
    followerCount >= ANALYSIS_CONFIG.celebrityFollowerThreshold &&
    balance < 0.15 &&
    sent > received * 3
  ) {
    score *= ANALYSIS_CONFIG.celebrityOneWayPenalty;
  }

  const latestInteractionAt = dates.sort().at(-1) ?? null;

  return {
    score: Math.round(score * 100) / 100,
    counts,
    reciprocity,
    uniqueConversationCount,
    activeDays,
    activeWeeks,
    latestInteractionAt,
  };
}

export function buildCandidateFromEvents(
  target: TargetAccount,
  userId: string,
  username: string,
  displayName: string,
  profileImageUrl: string | null,
  events: InteractionEvent[],
  followerCount = 0,
  reference = new Date(),
): CandidateAccount | null {
  if (events.length < ANALYSIS_CONFIG.minEventsForCandidate) return null;

  const metrics = calculateScoreForCandidate(target.id, events, reference, followerCount);
  if (metrics.score < ANALYSIS_CONFIG.minScoreForRing) return null;

  const explanation = buildExplanation(username, metrics.counts, metrics);

  return {
    userId,
    username,
    displayName,
    profileImageUrl,
    rawEvents: events,
    counts: metrics.counts,
    reciprocity: metrics.reciprocity,
    uniqueConversationCount: metrics.uniqueConversationCount,
    activeDays: metrics.activeDays,
    activeWeeks: metrics.activeWeeks,
    latestInteractionAt: metrics.latestInteractionAt,
    score: metrics.score,
    confidence: "medium",
    ring: null,
    explanation,
  };
}

function buildExplanation(
  username: string,
  counts: Record<InteractionType, number>,
  metrics: ReturnType<typeof calculateScoreForCandidate>,
): string[] {
  const lines: string[] = [];
  const twoWayReplies = Math.min(counts.reply_sent ?? 0, counts.reply_received ?? 0);
  if (twoWayReplies > 0) lines.push(`${twoWayReplies} two-way replies`);
  if ((counts.mention_sent ?? 0) + (counts.mention_received ?? 0) > 0) {
    lines.push(
      `${(counts.mention_sent ?? 0) + (counts.mention_received ?? 0)} mention interactions`,
    );
  }
  if (metrics.uniqueConversationCount > 0) {
    lines.push(`${metrics.uniqueConversationCount} unique conversations`);
  }
  if (metrics.activeWeeks > 0) lines.push(`activity across ${metrics.activeWeeks} weeks`);
  if (metrics.latestInteractionAt) {
    const days = Math.floor(
      (Date.now() - new Date(metrics.latestInteractionAt).getTime()) / (24 * 60 * 60 * 1000),
    );
    lines.push(`most recent interaction ${days} day${days === 1 ? "" : "s"} ago`);
  }
  if (lines.length === 0) lines.push(`public interaction signals with @${username}`);
  return lines;
}

export function scoreCandidates(
  target: TargetAccount,
  grouped: Map<
    string,
    {
      username: string;
      displayName: string;
      profileImageUrl: string | null;
      events: InteractionEvent[];
      followerCount?: number;
    }
  >,
  reference = new Date(),
): CandidateAccount[] {
  const out: CandidateAccount[] = [];
  for (const [userId, data] of grouped) {
    if (userId === target.id) continue;
    const c = buildCandidateFromEvents(
      target,
      userId,
      data.username,
      data.displayName,
      data.profileImageUrl,
      data.events,
      data.followerCount ?? 0,
      reference,
    );
    if (c) out.push(c);
  }
  return out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.reciprocity !== a.reciprocity) return b.reciprocity - a.reciprocity;
    return a.username.localeCompare(b.username);
  });
}

export type { RingKey } from "@/lib/config";