import { useCallback, useEffect, useState } from "react";
import { getTopScores, type LeaderboardEntry } from "../leaderboard";
import "./LeaderboardModal.css";

export type LeaderboardModalProps = {
  onClose: () => void;
};

const base = import.meta.env.BASE_URL;

export function LeaderboardModal({ onClose }: LeaderboardModalProps) {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTopScores();
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load leaderboard.";
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey: EventListener = (e) => {
      if (e instanceof globalThis.KeyboardEvent && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="leaderboard-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="leaderboard-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="leaderboard-modal-brand" aria-hidden="true">
          <img src={`${base}assets/lo.png`} alt="" className="leaderboard-modal-brand-lo" width={160} height={48} />
          <span className="leaderboard-modal-brand-x">×</span>
          <img src={`${base}assets/ddg.png`} alt="" className="leaderboard-modal-brand-ddg" width={56} height={56} />
        </div>
        <div className="leaderboard-modal-header">
          <h2 id="leaderboard-modal-title" className="leaderboard-modal-title">
            Leaderboard
          </h2>
          <button type="button" className="leaderboard-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="leaderboard-modal-sub">Top scores — LO × DDG</p>

        {loading ? (
          <p className="leaderboard-modal-status">Loading…</p>
        ) : error ? (
          <p className="leaderboard-modal-error" role="alert">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="leaderboard-modal-status">No scores yet. Be the first.</p>
        ) : (
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Handle</th>
                  <th scope="col">Score</th>
                  <th scope="col">Character</th>
                  <th scope="col">Scene</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td className="leaderboard-col-handle">{r.handle || "—"}</td>
                    <td>{r.score}</td>
                    <td>{r.character || "—"}</td>
                    <td>{r.scene || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="leaderboard-modal-actions">
          <button type="button" className="leaderboard-modal-refresh" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
