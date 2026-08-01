"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { WalletDNAResult } from "@/lib/wallet-dna/types";
import { APP_COPY, analyseWallet } from "@/lib/wallet-dna/client";
import { validateWalletInput } from "@/lib/wallet-dna/utils/ens";
import { shortenAddress } from "@/lib/wallet-dna/utils/helpers";
import { WalletDNAResultView } from "@/components/wallet-dna/WalletDNAResultView";
import { WalletDNAProgress } from "@/components/wallet-dna/WalletDNAProgress";
import { LittleOllieLogo } from "@/components/wallet-dna/LittleOllieLogo";

type Phase = "landing" | "loading" | "result" | "error";

function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

function analysisTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && (e.name === "AbortError" || e.name === "TimeoutError");
}

export function WalletDNAClient() {
  const [input, setInput] = useState("");
  const [activeWallet, setActiveWallet] = useState("");
  const [phase, setPhase] = useState<Phase>("landing");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WalletDNAResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const autoRunDoneRef = useRef(false);

  const runAnalysis = useCallback(async (wallet: string, refresh = false) => {
    const trimmed = wallet.trim();

    if (!trimmed) {
      setError("Enter a wallet address or ENS name to analyse.");
      setPhase("error");
      return;
    }
    if (!validateWalletInput(trimmed)) {
      setError("That does not look like a valid Ethereum wallet address or ENS name.");
      setPhase("error");
      return;
    }

    const runId = ++runIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setInput(trimmed);
    setActiveWallet(trimmed);
    setPhase("loading");
    setError(null);
    setResult(null);
    setCompleting(false);
    setElapsedSec(0);

    const started = Date.now();
    const elapsedTimer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);

    try {
      const timeout = analysisTimeoutSignal(4 * 60 * 1000);
      const combined = combineAbortSignals([controller.signal, timeout]);
      const data = await analyseWallet(trimmed, combined, { refresh });

      if (runId !== runIdRef.current) return;

      setCompleting(true);
      await new Promise((r) => setTimeout(r, 650));

      if (runId !== runIdRef.current) return;

      setResult(data);
      setPhase("result");
      const url = new URL(window.location.href);
      url.searchParams.set("wallet", trimmed);
      window.history.replaceState({}, "", url.toString());
    } catch (e) {
      if (runId !== runIdRef.current) return;

      if (controller.signal.aborted || isAbortError(e)) {
        return;
      }
      if (e instanceof DOMException && e.name === "TimeoutError") {
        setError("Analysis is taking longer than expected. Try again or use a wallet with less activity.");
      } else {
        setError(e instanceof Error ? e.message : "Analysis failed");
      }
      setPhase("error");
    } finally {
      clearInterval(elapsedTimer);
      if (runId === runIdRef.current) {
        setCompleting(false);
      }
    }
  }, []);

  useEffect(() => {
    if (autoRunDoneRef.current) return;
    autoRunDoneRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const w = params.get("wallet")?.trim();
    if (!w || !validateWalletInput(w)) return;

    setInput(w);
    void runAnalysis(w);
  }, [runAnalysis]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runAnalysis(input);
  }

  function cancelAnalysis() {
    runIdRef.current += 1;
    abortRef.current?.abort();
    setCompleting(false);
    setPhase("landing");
  }

  function startNewAnalysis() {
    runIdRef.current += 1;
    abortRef.current?.abort();
    setPhase("landing");
    setResult(null);
    setError(null);
    setInput("");
    setActiveWallet("");
    setCompleting(false);
    setElapsedSec(0);

    const url = new URL(window.location.href);
    url.searchParams.delete("wallet");
    window.history.replaceState({}, "", url.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const loadingLabel =
    activeWallet && activeWallet.endsWith(".eth")
      ? activeWallet
      : activeWallet
        ? shortenAddress(activeWallet)
        : "";

  return (
    <main className={`wdna-wrap ${phase === "result" ? "wdna-wrap--wide" : ""}`}>
      <header className="wdna-header">
        <div className="wdna-header__toolbar">
          <Link href="https://littleollielabs.com/links/#nft" className="wdna-header__back-btn">
            ← Back to Labs
          </Link>
          {phase === "result" && (
            <button type="button" className="wdna-header__back-btn" onClick={startNewAnalysis}>
              Analyse new wallet
            </button>
          )}
        </div>

        <div className="wdna-header__brand">
          <Link href="https://littleollielabs.com/" aria-label="Little Ollie home" className="wdna-header__logo-link">
            <LittleOllieLogo large />
          </Link>
          <h1 className="wdna-header__title">
            Wallet <span className="wdna-header__title-accent">DNA</span>
          </h1>
          <p className="wdna-header__utility">LO web3 utility</p>
        </div>
      </header>

      {phase === "landing" && (
        <section className="wdna-card wdna-landing-card">
          <p className="wdna-landing-eyebrow">{APP_COPY.heroTitle}</p>
          <p className="wdna-landing-lead">{APP_COPY.heroSubtitle}</p>
          <form onSubmit={handleSubmit} className="wdna-analyse-form">
            <label htmlFor="wallet-input" className="sr-only">
              Wallet or ENS
            </label>
            <input
              id="wallet-input"
              className="wdna-input"
              placeholder="0x… or yourname.eth"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="wdna-form-note">{APP_COPY.privacy}</p>
            <p className="wdna-form-note wdna-form-note--muted">Supported: Ethereum · Base</p>
            <button type="submit" className="wdna-btn wdna-btn--submit">
              Analyse My Wallet
            </button>
          </form>
          <p className="wdna-form-note wdna-form-note--fine">{APP_COPY.ownershipNote}</p>
        </section>
      )}

      {phase === "loading" && (
        <WalletDNAProgress
          walletLabel={loadingLabel}
          elapsedSec={elapsedSec}
          completing={completing}
          onCancel={cancelAnalysis}
        />
      )}

      {phase === "error" && (
        <section className="wdna-card wdna-error-card" role="alert">
          <p className="wdna-error-card__message">{error}</p>
          {input && (
            <p className="wdna-error-card__wallet">
              Wallet: <code>{input}</code>
            </p>
          )}
          <button type="button" className="wdna-btn" onClick={() => setPhase("landing")}>
            Try again
          </button>
        </section>
      )}

      {phase === "result" && result && (
        <WalletDNAResultView
          result={result}
          onRerun={() => runAnalysis(input || result.walletAddress, true)}
          onAnalyseNew={startNewAnalysis}
        />
      )}

      {phase === "result" && !result && (
        <section className="wdna-card wdna-error-card" role="alert">
          <p className="wdna-error-card__message">Analysis completed but no result was returned. Please try again.</p>
          <button type="button" className="wdna-btn" onClick={() => setPhase("landing")}>
            Try again
          </button>
        </section>
      )}

      <footer className="wdna-footer">
        <Link href="/methodology/">How scoring works</Link>
        <p>{APP_COPY.disclaimer}</p>
      </footer>
    </main>
  );
}
