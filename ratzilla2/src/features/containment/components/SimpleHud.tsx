interface SimpleHudProps {
  elapsedMs: number;
  closedCount: number;
  maxClosed: number;
  bestTimeMs: number;
  message: string | null;
  onPause: () => void;
  onHowToPlay: () => void;
  onReturn: () => void;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function SimpleHud({
  elapsedMs,
  closedCount,
  maxClosed,
  bestTimeMs,
  message,
  onPause,
  onHowToPlay,
  onReturn,
}: SimpleHudProps) {
  return (
    <header className="cp-simple-hud">
      <div className="cp-simple-hud__left">
        <button type="button" className="cp-simple-hud__back" onClick={onReturn}>
          ←
        </button>
        <span className="cp-simple-hud__timer">{formatTime(elapsedMs)}</span>
      </div>
      <div className="cp-simple-hud__centre">
        <span className="cp-simple-hud__doors">
          DOORS {closedCount} / {maxClosed}
        </span>
        {message && <span className="cp-simple-hud__msg">{message}</span>}
      </div>
      <div className="cp-simple-hud__right">
        {bestTimeMs > 0 && (
          <span className="cp-simple-hud__best">BEST {formatTime(bestTimeMs)}</span>
        )}
        <button type="button" onClick={onHowToPlay} aria-label="How to play">
          ?
        </button>
        <button type="button" onClick={onPause}>
          II
        </button>
      </div>
    </header>
  );
}
