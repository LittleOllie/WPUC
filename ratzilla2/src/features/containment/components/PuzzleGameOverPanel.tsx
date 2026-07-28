interface PuzzleGameOverPanelProps {
  stage: number;
  score: number;
  bestScore: number;
  onTryAgain: () => void;
  onNewIncident: () => void;
  onReturn: () => void;
}

export default function PuzzleGameOverPanel({
  stage,
  score,
  bestScore,
  onTryAgain,
  onNewIncident,
  onReturn,
}: PuzzleGameOverPanelProps) {
  return (
    <div className="cp-overlay cp-overlay--gameover">
      <div className="cp-panel cp-panel--gameover">
        <h2>CONTAINMENT FAILED</h2>
        <p className="cp-panel__stat">STAGE {stage}</p>
        <p className="cp-panel__stat cp-panel__stat--big">SCORE {score.toLocaleString()}</p>
        {bestScore > 0 && (
          <p className="cp-panel__best">BEST {bestScore.toLocaleString()}</p>
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
