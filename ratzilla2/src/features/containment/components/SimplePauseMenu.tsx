interface SimplePauseMenuProps {
  onResume: () => void;
  onTryAgain: () => void;
  onNewIncident: () => void;
  onHowToPlay: () => void;
  onReturn: () => void;
}

export default function SimplePauseMenu({
  onResume,
  onTryAgain,
  onNewIncident,
  onHowToPlay,
  onReturn,
}: SimplePauseMenuProps) {
  return (
    <div className="cp-overlay" role="dialog" aria-label="Paused">
      <div className="cp-panel">
        <h2>PAUSED</h2>
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
  );
}
