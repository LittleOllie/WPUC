import { ANALYSIS_CONFIG, RING_CAPACITY, type RingKey } from "@/lib/config";
import { candidateConfidence } from "@/lib/analysis/confidence";
import type { CandidateAccount } from "@/lib/analysis/types";

const RING_ORDER: RingKey[] = ["inner", "besties", "goodFriends", "community"];

function hasTwoWayInteraction(c: CandidateAccount): boolean {
  const sent =
    (c.counts.reply_sent ?? 0) + (c.counts.mention_sent ?? 0) + (c.counts.quote_sent ?? 0);
  const received =
    (c.counts.reply_received ?? 0) +
    (c.counts.mention_received ?? 0) +
    (c.counts.quote_received ?? 0);
  return sent > 0 && received > 0;
}

export function assignRings(candidates: CandidateAccount[]): Record<RingKey, CandidateAccount[]> {
  const rings: Record<RingKey, CandidateAccount[]> = {
    inner: [],
    besties: [],
    goodFriends: [],
    community: [],
  };

  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.reciprocity !== a.reciprocity) return b.reciprocity - a.reciprocity;
    return a.username.localeCompare(b.username);
  });

  const placed = new Set<string>();

  for (const ring of RING_ORDER) {
    const cap = RING_CAPACITY[ring];
    for (const c of sorted) {
      if (placed.has(c.userId)) continue;
      if (rings[ring].length >= cap) break;
      if (c.score < ANALYSIS_CONFIG.minScoreForRing) continue;

      if (
        ring === "inner" &&
        ANALYSIS_CONFIG.innerCircleRequiresReciprocity &&
        !hasTwoWayInteraction(c)
      ) {
        continue;
      }

      const withRing: CandidateAccount = {
        ...c,
        ring,
        confidence: candidateConfidence(
          c.rawEvents.length,
          c.uniqueConversationCount,
          c.reciprocity,
        ),
      };
      rings[ring].push(withRing);
      placed.add(c.userId);
    }
  }

  return rings;
}

export function flattenRingCandidates(rings: Record<RingKey, CandidateAccount[]>): CandidateAccount[] {
  return RING_ORDER.flatMap((k) => rings[k]);
}
