"use client";

import { PROGRESS_STAGES } from "@/lib/config";

interface AnalysisProgressProps {
  stageIndex: number;
}

export function AnalysisProgress({ stageIndex }: AnalysisProgressProps) {
  return (
    <div className="card p-6" aria-live="polite" aria-busy="true">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-indigo-300">Analysis in progress</p>
      <ol className="space-y-3">
        {PROGRESS_STAGES.map((label, i) => {
          const active = i === stageIndex;
          const done = i < stageIndex;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${active ? "bg-indigo-500/20" : ""}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : active ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-300"}`}
                aria-hidden="true"
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={active ? "font-semibold text-white" : "text-slate-300"}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
