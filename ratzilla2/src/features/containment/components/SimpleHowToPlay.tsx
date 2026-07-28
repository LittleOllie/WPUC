interface SimpleHowToPlayProps {
  onClose: () => void;
}

export default function SimpleHowToPlay({ onClose }: SimpleHowToPlayProps) {
  return (
    <div className="cp-overlay" role="dialog" aria-label="How to play">
      <div className="cp-panel cp-panel--howto">
        <h2>HOW TO PLAY</h2>
        <ul className="cp-simple-howto-list">
          <li>Tap corridors to close doors.</li>
          <li>Only three doors can remain closed.</li>
          <li>Infection reroutes around blocked paths.</li>
          <li>Stop it reaching the Core.</li>
          <li>Use Purge when fully charged.</li>
        </ul>
        <button type="button" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
