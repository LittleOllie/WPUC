interface PuzzlePauseMenuProps {
  onResume: () => void;
  onTryAgain: () => void;
  onNewIncident: () => void;
  onHowToPlay: () => void;
  onReturn: () => void;
}

export default function PuzzlePauseMenu({
  onResume,
  onTryAgain,
  onNewIncident,
  onHowToPlay,
  onReturn,
}: PuzzlePauseMenuProps) {
  return (
    <div className="cp-overlay">
      <div className="cp-panel">
        <h2>PAUSED</h2>
        <div className="cp-panel__actions">
          <button type="button" onClick={onResume}>
            RESUME
          </button>
          <button type="button" onClick={onTryAgain}>
            TRY AGAIN
          </button>
          <button type="button" onClick={onNewIncident}>
            NEW INCIDENT
          </button>
          <button type="button" onClick={onHowToPlay}>
            HOW TO PLAY
          </button>
          <button type="button" onClick={onReturn}>
            RETURN TO BLACKWATER
          </button>
        </div>
      </div>
    </div>
  );
}
