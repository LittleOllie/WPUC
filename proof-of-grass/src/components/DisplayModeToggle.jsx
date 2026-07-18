export default function DisplayModeToggle({
  immersive,
  onSelectPortrait,
  onSelectImmersive,
}) {
  return (
    <div className="labs-game-actions-row pog-mode-actions" role="group" aria-label="Display mode">
      <button
        type="button"
        className={`home-btn pog-btn pog-btn--blue${!immersive ? " pog-btn--selected" : ""}`}
        aria-pressed={!immersive}
        onClick={onSelectPortrait}
      >
        Pocket
      </button>
      <button
        type="button"
        className={`home-btn pog-btn pog-btn--yellow${immersive ? " pog-btn--selected" : ""}`}
        aria-pressed={immersive}
        onClick={onSelectImmersive}
      >
        Ultra Grass 🌱
      </button>
    </div>
  );
}
