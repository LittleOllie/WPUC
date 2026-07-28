import { getContextualGuidance } from "../utils/guidance";
import type { SimulationSnapshot } from "../types";

interface ContextualGuidanceProps {
  snapshot: SimulationSnapshot;
  now: number;
}

export default function ContextualGuidance({ snapshot, now }: ContextualGuidanceProps) {
  const highlights = snapshot.tutorialHighlights;
  const msg = getContextualGuidance(
    snapshot,
    now,
    Boolean(snapshot.tutorial?.active),
    highlights?.highlightSeal ?? false,
    highlights?.highlightSerum ?? false,
  );

  return (
    <div className="cp-guidance" role="status" aria-live="polite">
      {msg.text}
    </div>
  );
}
