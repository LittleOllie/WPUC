interface PuzzleHowToPlayProps {
  onClose: () => void;
}

export default function PuzzleHowToPlay({ onClose }: PuzzleHowToPlayProps) {
  return (
    <div className="cp-overlay">
      <div className="cp-panel cp-panel--howto">
        <h2>HOW TO PLAY</h2>
        <ul className="cp-simple-howto-list">
          <li>Tap a room — a small menu appears beside it.</li>
          <li>Choose Scan, Lock, or Unlock from the popup beside the room.</li>
          <li>Scanning infection turns adjacent revealed rooms red.</li>
          <li>Right-click a room to lock quickly on desktop.</li>
          <li>Keep infection away from the Core.</li>
        </ul>
        <button type="button" className="cp-panel__btn" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
