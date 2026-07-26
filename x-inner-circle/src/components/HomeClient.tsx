"use client";

import { useCallback, useState } from "react";
import { APP_CONFIG, PROGRESS_STAGES } from "@/lib/config";
import type { AnalysisResult, CandidateAccount } from "@/lib/analysis/types";
import type { AnalyseResponse } from "@/types/api";
import { downloadBlob, exportHighResPng, exportSvgToPng } from "@/lib/image/export-png";
import { pngFilename } from "@/lib/image/layout";
import { AccountRankCard } from "@/components/AccountRankCard";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { CircleLegend } from "@/components/CircleLegend";
import { CircleVisual } from "@/components/CircleVisual";
import { ErrorMessage } from "@/components/ErrorMessage";
import { ExplanationDrawer } from "@/components/ExplanationDrawer";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { UsernameForm } from "@/components/UsernameForm";

import { normaliseUsername } from "@/lib/security/sanitise";

const useClientMock = process.env.NEXT_PUBLIC_USE_CLIENT_MOCK === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function HomeClient() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [explain, setExplain] = useState<CandidateAccount | null>(null);

  const runStagesDuringFetch = useCallback(async () => {
    for (let i = 0; i < PROGRESS_STAGES.length - 1; i++) {
      setStageIndex(i);
      await new Promise((r) => setTimeout(r, 220));
    }
  }, []);

  const analyse = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setStageIndex(0);

    const stagePromise = runStagesDuringFetch();

    try {
      if (useClientMock) {
        const norm = normaliseUsername(input);
        if (!norm.ok) {
          await stagePromise;
          setError(norm.reason);
          setRetryable(false);
          return;
        }
        const { getMockAnalysisResult } = await import("@/lib/mock/mock-analysis");
        const data = await getMockAnalysisResult(norm.username);
        await stagePromise;
        setStageIndex(PROGRESS_STAGES.length - 1);
        setResult(data);
        return;
      }

      const res = await fetch(`${basePath}/api/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = (await res.json()) as AnalyseResponse;
      await stagePromise;
      setStageIndex(PROGRESS_STAGES.length - 1);

      if (!data.success) {
        setError(data.error.friendlyMessage);
        setRetryable(data.error.retryable);
        return;
      }
      setResult(data.data);
    } catch {
      setError("Network error — please check your connection and try again.");
      setRetryable(true);
    } finally {
      setLoading(false);
    }
  }, [input, runStagesDuringFetch]);

  const downloadPng = async (highRes = false) => {
    if (!result?.svgMarkup) return;
    const blob = highRes ? await exportHighResPng(result.svgMarkup) : await exportSvgToPng(result.svgMarkup);
    downloadBlob(blob, pngFilename(result.target.username));
  };

  const shareOnX = () => {
    if (!result) return;
    const text = encodeURIComponent(
      `I mapped my public X inner circle with ${APP_CONFIG.name} — based on recent public interactions.`,
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="mx-auto min-h-screen max-w-[1100px] px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-indigo-300">Little Ollie Labs</p>
          <h1 className="text-3xl font-black sm:text-4xl">{APP_CONFIG.heroTitle}</h1>
        </div>
        <a href="../links/#nft" className="text-sm text-slate-300 underline">
          ← Back to NFT Tools Lab
        </a>
      </header>

      {!result ? (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <section className="card p-6 sm:p-8">
            <p className="mb-6 text-slate-300">{APP_CONFIG.heroSubtitle}</p>
            <UsernameForm
              value={input}
              onChange={setInput}
              onSubmit={analyse}
              loading={loading}
              error={error}
            />
            {loading ? <div className="mt-6"><AnalysisProgress stageIndex={stageIndex} /></div> : null}
            {error && !loading ? (
              <div className="mt-4">
                <ErrorMessage message={error} retryable={retryable} onRetry={analyse} />
              </div>
            ) : null}
            <div className="mt-6">
              <PrivacyNotice />
            </div>
          </section>
          <section className="card flex min-h-[320px] items-center justify-center p-8 text-center text-slate-400">
            <div>
              <div className="mx-auto mb-4 h-48 w-48 rounded-full border-4 border-indigo-500/30 p-2">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-indigo-500/10 text-5xl">
                  ◉
                </div>
              </div>
              <p>Your concentric circles preview will appear here after analysis.</p>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-8">
          {result.svgMarkup ? <CircleVisual svgMarkup={result.svgMarkup} username={result.target.username} /> : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => downloadPng(false)}>
              Download PNG
            </button>
            <button type="button" className="btn-secondary" onClick={() => downloadPng(true)}>
              High-res PNG
            </button>
            <button type="button" className="btn-secondary" onClick={shareOnX}>
              Share on X
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              Analyse Another Account
            </button>
          </div>
          <AnalysisSummary result={result} />
          <CircleLegend rings={result.rings} />
          <section>
            <h2 className="mb-4 text-2xl font-bold">Ranked relationships</h2>
            <div className="space-y-3">
              {result.candidates.slice(0, 30).map((c, i) => (
                <AccountRankCard key={c.userId} account={c} rank={i + 1} onExplain={setExplain} />
              ))}
            </div>
          </section>
          {result.limitations.length ? (
            <div className="card p-4 text-sm text-slate-300">
              <h3 className="font-bold text-white">Limitations</h3>
              <ul className="mt-2 list-disc pl-5">
                {result.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <PrivacyNotice />
        </div>
      )}

      <ExplanationDrawer account={explain} onClose={() => setExplain(null)} />

      {process.env.NODE_ENV === "development" && result ? (
        <details className="card mt-8 p-4 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold text-white">Development diagnostics</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(result.usage, null, 2)}</pre>
        </details>
      ) : null}
    </main>
  );
}
