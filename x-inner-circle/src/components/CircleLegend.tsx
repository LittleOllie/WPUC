import { RING_LABELS, type RingKey } from "@/lib/config";
import type { CandidateAccount } from "@/lib/analysis/types";

interface CircleLegendProps {
  rings: Record<RingKey, CandidateAccount[]>;
}

export function CircleLegend({ rings }: CircleLegendProps) {
  const keys: RingKey[] = ["inner", "besties", "goodFriends", "community"];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {keys.map((key) => (
        <div key={key} className="card p-4">
          <h3 className="font-bold text-white">{RING_LABELS[key]}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {rings[key]?.length
              ? rings[key].map((c) => `@${c.username}`).join(", ")
              : "No accounts met the threshold for this ring."}
          </p>
        </div>
      ))}
    </div>
  );
}
