import type { PuzzleMode } from "../types/puzzle";

interface PuzzleModeBarProps {
  mode: PuzzleMode;
  onModeChange: (mode: PuzzleMode) => void;
}

export default function PuzzleModeBar({ mode, onModeChange }: PuzzleModeBarProps) {
  return (
    <footer className="cp-puzzle-mode">
      <button
        type="button"
        className={`cp-puzzle-mode__btn${mode === "scan" ? " cp-puzzle-mode__btn--active" : ""}`}
        onClick={() => onModeChange("scan")}
      >
        <span className="cp-puzzle-mode__label">SCAN</span>
        <span className="cp-puzzle-mode__hint">Reveal a room</span>
      </button>
      <button
        type="button"
        className={`cp-puzzle-mode__btn${mode === "lock" ? " cp-puzzle-mode__btn--active" : ""}`}
        onClick={() => onModeChange("lock")}
      >
        <span className="cp-puzzle-mode__label">LOCK</span>
        <span className="cp-puzzle-mode__hint">Contain infection</span>
      </button>
    </footer>
  );
}
