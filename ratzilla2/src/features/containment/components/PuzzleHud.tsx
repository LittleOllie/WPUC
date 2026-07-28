interface PuzzleHudProps {
  stage: number;
  score: number;
  locks: number;
  spreadCountdownMs: number;
  message: string | null;
  bestScore: number;
  onPause: () => void;
  onHowToPlay: () => void;
  onReturn: () => void;
}

export default function PuzzleHud({
  stage,
  score,
  locks,
  spreadCountdownMs,
  message,
  bestScore,
  onPause,
  onHowToPlay,
  onReturn,
}: PuzzleHudProps) {
  const spreadSec = Math.max(0, Math.ceil(spreadCountdownMs / 1000));

  return (
    <header className="cp-puzzle-hud">
      <div className="cp-puzzle-hud__left">
        <button type="button" className="cp-puzzle-hud__back" onClick={onReturn}>
          ← EXIT
        </button>
        <span className="cp-puzzle-hud__stage">STAGE {stage}</span>
      </div>
      <div className="cp-puzzle-hud__centre">
        <span className="cp-puzzle-hud__locks">LOCKS: {locks}</span>
        <span className="cp-puzzle-hud__spread">NEXT SPREAD: {spreadSec}</span>
        {message && <span className="cp-puzzle-hud__msg">{message}</span>}
      </div>
      <div className="cp-puzzle-hud__right">
        <span className="cp-puzzle-hud__score">{score.toLocaleString()}</span>
        {bestScore > 0 && (
          <span className="cp-puzzle-hud__best">BEST {bestScore.toLocaleString()}</span>
        )}
        <button type="button" className="cp-puzzle-hud__icon" onClick={onHowToPlay}>
          ?
        </button>
        <button type="button" className="cp-puzzle-hud__icon" onClick={onPause}>
          ❚❚
        </button>
      </div>
    </header>
  );
}
