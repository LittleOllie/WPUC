interface PauseMenuProps {
  onResume: () => void;
  onRestartSame: () => void;
  onRestartNew: () => void;
  onHowToPlay: () => void;
  onReplayTutorial: () => void;
  onSettings: () => void;
  onReturn: () => void;
}

export default function PauseMenu({
  onResume,
  onRestartSame,
  onRestartNew,
  onHowToPlay,
  onReplayTutorial,
  onSettings,
  onReturn,
}: PauseMenuProps) {
  return (
    <div className="cp-overlay" role="dialog" aria-label="Pause menu">
      <div className="cp-panel">
        <h2>PAUSED</h2>
        <button type="button" onClick={onResume}>
          RESUME
        </button>
        <button type="button" onClick={onRestartSame}>
          RESTART INCIDENT
        </button>
        <button type="button" onClick={onRestartNew}>
          NEW INCIDENT
        </button>
        <button type="button" onClick={onHowToPlay}>
          HOW TO PLAY
        </button>
        <button type="button" onClick={onReplayTutorial}>
          REPLAY TUTORIAL
        </button>
        <button type="button" onClick={onSettings}>
          SETTINGS
        </button>
        <button type="button" onClick={onReturn}>
          RETURN TO BLACKWATER
        </button>
      </div>
    </div>
  );
}
