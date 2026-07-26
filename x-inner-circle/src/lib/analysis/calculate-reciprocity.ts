import { RECIPROCITY_MULTIPLIERS } from "@/lib/config";
import type { InteractionEvent } from "@/lib/analysis/types";

export function calculateReciprocity(
  targetUserId: string,
  counterpartyUserId: string,
  events: InteractionEvent[],
): number {
  let targetToOther = 0;
  let otherToTarget = 0;

  for (const e of events) {
    const isTargetSource = e.sourceUserId === targetUserId;
    const isTargetTarget = e.targetUserId === targetUserId;
    const involvesCounterparty =
      e.sourceUserId === counterpartyUserId || e.targetUserId === counterpartyUserId;
    if (!involvesCounterparty) continue;

    if (isTargetSource && e.targetUserId === counterpartyUserId) targetToOther += 1;
    if (isTargetTarget && e.sourceUserId === counterpartyUserId) otherToTarget += 1;
  }

  if (targetToOther === 0 && otherToTarget === 0) return 0;
  if (targetToOther === 0 || otherToTarget === 0) return RECIPROCITY_MULTIPLIERS.low;

  const ratio = Math.min(targetToOther, otherToTarget) / Math.max(targetToOther, otherToTarget);
  if (ratio >= 0.75) return RECIPROCITY_MULTIPLIERS.strong;
  if (ratio >= 0.35) return RECIPROCITY_MULTIPLIERS.moderate;
  return RECIPROCITY_MULTIPLIERS.low;
}

export function reciprocityBalanceScore(sent: number, received: number): number {
  if (sent + received === 0) return 0;
  if (sent === 0 || received === 0) return 0.2;
  return Math.min(sent, received) / Math.max(sent, received);
}
