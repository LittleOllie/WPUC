interface SimpleGameOverPanelProps {
  elapsedMs: number;
  bestTimeMs: number;
  onTryAgain: () => void;
  onNewIncident: () => void;
  onReturn: () => void;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function SimpleGameOverPanel({
  elapsedMs,
  bestTimeMs,
  onTryAgain,
  onNewIncident,
  onReturn,
}: SimpleGameOverPanelProps) {
  return (
    <div className="cp-overlay cp-overlay--gameover">
      <div className="cp-panel cp-panel--gameover">
        <h2>CONTAINMENT FAILED</h2>
        <p className="cp-panel__stat">HELD FOR</p>
        <p className="cp-panel__stat cp-panel__stat--big">{formatTime(elapsedMs)}</p>
        {bestTimeMs > 0 && (
          <p className="cp-panel__best">BEST {formatTime(bestTimeMs)}</p>
        )}
        <div className="cp-panel__actions">
          <button type="button" onClick={onTryAgain}>
            TRY AGAIN
          </button>
          <button type="button" onClick={onNewIncident}>
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
