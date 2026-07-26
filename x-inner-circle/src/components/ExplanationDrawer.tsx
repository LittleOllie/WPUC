"use client";

import type { CandidateAccount } from "@/lib/analysis/types";
import { RING_LABELS } from "@/lib/config";

interface ExplanationDrawerProps {
  account: CandidateAccount | null;
  onClose: () => void;
}

export function ExplanationDrawer({ account, onClose }: ExplanationDrawerProps) {
  if (!account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="explain-title">
      <div className="card max-h-[80vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="explain-title" className="text-xl font-bold text-white">
              @{account.username}
            </h2>
            <p className="text-sm text-slate-400">
              {account.ring ? RING_LABELS[account.ring] : "Ranked account"} — based on recent public X interactions.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} aria-label="Close explanation">
            Close
          </button>
        </div>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-200">
          {account.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-400">
          This estimates public interaction closeness — not private messages or real-world friendship.
        </p>
      </div>
    </div>
  );
}
