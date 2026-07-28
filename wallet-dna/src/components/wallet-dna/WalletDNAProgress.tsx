"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LOADING_DNA_SCORES,
  LOADING_OLLIE_LINES,
  LOADING_PERSONALITY_TEASES,
  LOADING_TIPS,
  PROGRESS_STAGES,
} from "@/lib/wallet-dna/constants";
import { basePath } from "@/lib/wallet-dna/client";

type Props = {
  walletLabel?: string;
  elapsedSec: number;
  completing: boolean;
  onCancel: () => void;
};

/** Smooth progress that never falsely hits 100% until analysis completes. */
export function estimateLoadingProgress(elapsedSec: number, completing: boolean): number {
  if (completing) return 100;
  const pct = 6 + 86 * (1 - Math.exp(-elapsedSec / 48));
  return Math.min(92, Math.round(pct));
}

function stageForElapsed(elapsedSec: number): string {
  if (elapsedSec < 4) return PROGRESS_STAGES[0]!;
  if (elapsedSec < 12) return PROGRESS_STAGES[1]!;
  if (elapsedSec < 22) return PROGRESS_STAGES[2]!;
  if (elapsedSec < 40) return PROGRESS_STAGES[3]!;
  if (elapsedSec < 55) return PROGRESS_STAGES[4]!;
  if (elapsedSec < 70) return PROGRESS_STAGES[5]!;
  return PROGRESS_STAGES[6]!;
}

function waitLabel(elapsedSec: number): string {
  if (elapsedSec < 15) return "Ollie is on the case.";
  if (elapsedSec < 45) return "Still scanning — active wallets take a bit.";
  if (elapsedSec < 90) return "Deep read in progress. Almost there.";
  return "Whale-sized history — Ollie is still working.";
}

export function WalletDNAProgress({ walletLabel, elapsedSec, completing, onCancel }: Props) {
  const progress = estimateLoadingProgress(elapsedSec, completing);
  const [lineIndex, setLineIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [teaseIndex, setTeaseIndex] = useState(0);
  const [activeScoreIndex, setActiveScoreIndex] = useState(0);

  useEffect(() => {
    if (completing) return;
    const t = window.setInterval(() => {
      setActiveScoreIndex((i) => (i + 1) % LOADING_DNA_SCORES.length);
    }, 2200);
    return () => clearInterval(t);
  }, [completing]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % LOADING_OLLIE_LINES.length);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % LOADING_TIPS.length);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      setTeaseIndex((i) => (i + 1) % LOADING_PERSONALITY_TEASES.length);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const stage = completing ? "Profile ready!" : stageForElapsed(elapsedSec);
  const ollieLine = completing ? "Your Wallet DNA is ready to share." : LOADING_OLLIE_LINES[lineIndex]!;

  const chainStatus = useMemo(() => {
    if (elapsedSec < 8) return { eth: "active" as const, base: "pending" as const };
    if (elapsedSec < 20) return { eth: "done" as const, base: "active" as const };
    return { eth: "done" as const, base: "done" as const };
  }, [elapsedSec]);

  return (
    <section className="wdna-loader" aria-live="polite" aria-busy={!completing}>
      <div className="wdna-loader__layout">
        <div className="wdna-loader__ollie-col">
          <div className="wdna-loader__ollie-wrap wdna-loader__ollie-wrap--lab">
            <div className="wdna-loader__glow" aria-hidden="true" />
            <img
              className={`wdna-loader__ollie wdna-loader__ollie--lab${completing ? " wdna-loader__ollie--done" : ""}`}
              src={`${basePath}/ollie/LOLabCoat.png`}
              alt="Ollie in lab coat"
              width={220}
              height={330}
            />
          </div>
        </div>

        <div className="wdna-loader__copy">
          <div className="wdna-loader__bubble">
            <span className="wdna-loader__bubble-label">Ollie says</span>
            <p className="wdna-loader__bubble-text" key={ollieLine}>
              {ollieLine}
            </p>
          </div>

          <p className="wdna-loader__stage">{stage}</p>
          {walletLabel ? (
            <p className="wdna-loader__wallet">
              Analysing <strong>{walletLabel}</strong>
            </p>
          ) : null}
          <p className="wdna-loader__wait">
            {completing ? "Opening your collector profile…" : waitLabel(elapsedSec)}
          </p>

          <div className="wdna-loader__chains" aria-label="Supported chains">
            <ChainChip label="Ethereum" status={chainStatus.eth} />
            <ChainChip label="Base" status={chainStatus.base} />
          </div>
        </div>
      </div>

      <div className="wdna-loader__progress-head">
        <span>{completing ? "Complete" : "Scanning"}</span>
        <strong>{progress}%</strong>
      </div>
      <div className="wdna-loader__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`wdna-loader__bar-fill${completing ? " wdna-loader__bar-fill--done" : ""}`}
          style={{ width: `${progress}%` }}
        />
        {!completing && progress >= 85 && <div className="wdna-loader__bar-shimmer" aria-hidden="true" />}
      </div>
      {!completing && progress >= 85 && (
        <p className="wdna-loader__almost">Final stretch — still reading on-chain history.</p>
      )}

      <div className="wdna-loader__meta">
        <span className="wdna-loader__elapsed">{elapsedSec}s elapsed</span>
        {!completing && (
          <span className="wdna-loader__tease">
            Could you be a <em>{LOADING_PERSONALITY_TEASES[teaseIndex]}</em>?
          </span>
        )}
      </div>

      <p className="wdna-loader__tip" key={LOADING_TIPS[tipIndex]}>
        💡 {LOADING_TIPS[tipIndex]}
      </p>

      <div className="wdna-loader__dna-scores" role="group" aria-label="Calculating your five DNA scores">
        <p className="sr-only" aria-live="polite">
          {completing
            ? "All five DNA scores calculated."
            : `Calculating ${LOADING_DNA_SCORES[activeScoreIndex]!.label}.`}
        </p>
        {LOADING_DNA_SCORES.map((score, i) => {
          const isActive = completing || i === activeScoreIndex;
          const isDone = !completing && i < activeScoreIndex;
          return (
            <div
              key={score.letter}
              className={`wdna-loader__dna-item${isActive ? " wdna-loader__dna-item--active" : ""}${isDone ? " wdna-loader__dna-item--done" : ""}${completing ? " wdna-loader__dna-item--complete" : ""}`}
            >
              <span className="wdna-loader__dna-letter" aria-hidden="true">
                {score.letter}
              </span>
              <span className="wdna-loader__dna-label">{score.label}</span>
            </div>
          );
        })}
      </div>

      <button type="button" className="wdna-btn wdna-loader__cancel" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}

function ChainChip({
  label,
  status,
}: {
  label: string;
  status: "pending" | "active" | "done";
}) {
  return (
    <span className={`wdna-loader__chain wdna-loader__chain--${status}`}>
      {status === "done" ? "✓ " : status === "active" ? "◌ " : "· "}
      {label}
    </span>
  );
}
