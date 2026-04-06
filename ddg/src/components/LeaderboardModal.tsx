import { useEffect, useId, useRef, useState } from "react";
import type { LeaderboardEntry } from "../leaderboard";
import "./LeaderboardModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

type LoadState = "idle" | "loading" | "ok" | "error";

export default function LeaderboardModal({ open, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setState("idle");
      return;
    }
    lastFocusRef.current = document.activeElement as HTMLElement;
    document.body.classList.add("modal-scroll-lock");
    requestAnimationFrame(() => closeRef.current?.focus());

    let cancelled = false;
    setState("loading");
    setError(null);
    setRows([]);

    import("../leaderboard")
      .then(({ getTopScores }) => getTopScores())
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setState("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setState("error");
      });

    return () => {
      cancelled = true;
      document.body.classList.remove("modal-scroll-lock");
      lastFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="lb-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="lb-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="lb-modal-header">
          <h2 id={titleId} className="lb-modal-title">
            Global leaderboard
          </h2>
          <button ref={closeRef} type="button" className="lb-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="lb-modal-body">
          {state === "loading" ? <p className="lb-modal-status">Loading…</p> : null}
          {state === "error" && error ? (
            <p className="lb-modal-status lb-modal-status--error" role="alert">
              {error}
            </p>
          ) : null}
          {state === "ok" ? (
            <div className="lb-table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Handle</th>
                    <th scope="col">Score</th>
                    <th scope="col" className="lb-col-meta">
                      Character
                    </th>
                    <th scope="col" className="lb-col-meta">
                      Scene
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="lb-table-empty">
                        No scores yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.handle}</td>
                        <td>{r.score}</td>
                        <td className="lb-col-meta">{r.character}</td>
                        <td className="lb-col-meta">{r.scene}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
