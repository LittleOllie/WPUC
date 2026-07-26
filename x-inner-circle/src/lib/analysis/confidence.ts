import type { ConfidenceLevel, InteractionEvent } from "@/lib/analysis/types";

export function calculateOverallConfidence(
  events: InteractionEvent[],
  limitations: string[],
  dataCompleteness: number,
): ConfidenceLevel {
  let score = 0;

  if (events.length >= 80) score += 3;
  else if (events.length >= 30) score += 2;
  else if (events.length >= 10) score += 1;

  const conversations = new Set(events.map((e) => e.conversationId).filter(Boolean));
  if (conversations.size >= 15) score += 2;
  else if (conversations.size >= 5) score += 1;

  score += Math.min(2, Math.floor(dataCompleteness * 2));

  if (limitations.length >= 2) score -= 2;
  else if (limitations.length === 1) score -= 1;

  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function candidateConfidence(
  eventCount: number,
  uniqueConversations: number,
  reciprocity: number,
): ConfidenceLevel {
  let score = 0;
  if (eventCount >= 12) score += 2;
  else if (eventCount >= 4) score += 1;
  if (uniqueConversations >= 4) score += 2;
  else if (uniqueConversations >= 2) score += 1;
  if (reciprocity >= 1.3) score += 2;
  else if (reciprocity >= 1.1) score += 1;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}
