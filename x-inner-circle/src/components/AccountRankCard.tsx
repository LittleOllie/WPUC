"use client";

import type { CandidateAccount } from "@/lib/analysis/types";
import { RING_LABELS } from "@/lib/config";

interface AccountRankCardProps {
  account: CandidateAccount;
  rank: number;
  onExplain: (account: CandidateAccount) => void;
}

export function AccountRankCard({ account, rank, onExplain }: AccountRankCardProps) {
  return (
    <article className="card flex items-start justify-between gap-4 p-4">
      <div>
        <p className="text-sm text-slate-400">#{rank}</p>
        <h3 className="text-lg font-bold text-white">@{account.username}</h3>
        <p className="text-sm text-slate-300">{account.displayName}</p>
        <p className="mt-2 text-sm text-slate-400">
          Score {account.score.toFixed(1)} • {account.ring ? RING_LABELS[account.ring] : "Unranked"} •{" "}
          {account.confidence} confidence
        </p>
      </div>
      <button type="button" className="btn-secondary shrink-0 text-sm" onClick={() => onExplain(account)}>
        Why?
      </button>
    </article>
  );
}
