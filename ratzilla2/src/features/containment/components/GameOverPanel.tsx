import type { SimulationSnapshot } from "../types";
import { getRankForScore } from "../config/ranks";
import type { ContainmentPersistedData } from "../persistence/storage";

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface GameOverPanelProps {
  snapshot: SimulationSnapshot;
  best: ContainmentPersistedData;
  onRestartSame: () => void;
  onRestartNew: () => void;
  onReturn: () => void;
}

export default function GameOverPanel({
  snapshot,
  best,
  onRestartSame,
  onRestartNew,
  onReturn,
}: GameOverPanelProps) {
  const rank = getRankForScore(snapshot.score);

  return (
    <div className="cp-overlay cp-overlay--gameover" role="dialog" aria-label="Game over">
      <div className="cp-panel cp-panel--gameover">
        <h2>CONTAINMENT FAILURE</h2>
        <p className="cp-panel__sub">SITE CONNECTION LOST</p>

        <p className="cp-panel__stat">
          CONTAINMENT HELD: {formatTime(snapshot.elapsedMs)}
        </p>
        <p className="cp-panel__stat">SCORE: {snapshot.score}</p>
        <p className="cp-panel__stat">RANK: {rank}</p>
        <p className="cp-panel__stat">INCIDENT: {snapshot.incident.seedLabel}</p>

        <details className="cp-panel__breakdown">
          <summary>RESULTS BREAKDOWN</summary>
          <ul>
            <li>Rooms remaining: {snapshot.rooms.filter((r) => r.state !== "lost" && r.state !== "purged").length}</li>
            <li>Core integrity: {Math.round(snapshot.coreIntegrity)}%</li>
            <li>Mutations endured: {snapshot.activeMutations.length}</li>
            <li>Infection cleared: {snapshot.infectionRoomsCleared}</li>
            <li>Bulkheads sealed: {snapshot.bulkheadsRemaining}</li>
          </ul>
        </details>

        {best.bestScore > 0 && (
          <p className="cp-panel__best">
            BEST: {formatTime(best.bestTimeMs)} / {best.bestScore} pts
          </p>
        )}

        <div className="cp-panel__actions">
          <button type="button" onClick={onRestartSame}>
            REINITIALISE INCIDENT
          </button>
          <button type="button" onClick={onRestartNew}>
            NEW INCIDENT
          </button>
          <button type="button" onClick={onReturn}>
            RETURN TO BLACKWATER
          </button>
        </div>
      </div>
    </div>
  );
}
