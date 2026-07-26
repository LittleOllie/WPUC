import type { AnalysisResult } from "@/lib/analysis/types";

interface AnalysisSummaryProps {
  result: AnalysisResult;
}

export function AnalysisSummary({ result }: AnalysisSummaryProps) {
  const cards = [
    { label: "Posts analysed", value: result.sourceCounts.postsAnalysed },
    { label: "Mentions analysed", value: result.sourceCounts.mentionsAnalysed },
    { label: "Accounts discovered", value: result.sourceCounts.accountsDiscovered },
    { label: "Interactions counted", value: result.sourceCounts.interactionsCounted },
    { label: "Analysis period", value: `${result.analysisWindow.days} days` },
    { label: "Result confidence", value: result.confidence },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <p className="text-sm text-slate-400">{c.label}</p>
          <p className="text-2xl font-bold capitalize text-white">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
