interface ProtocolManualProps {
  onClose: () => void;
}

export default function ProtocolManual({ onClose }: ProtocolManualProps) {
  return (
    <div className="cp-overlay" role="dialog" aria-label="Protocol manual">
      <div className="cp-panel cp-panel--manual">
        <h2>PROTOCOL MANUAL</h2>
        <section>
          <h3>OBJECTIVE</h3>
          <p>
            Contain Infection Z-26. You cannot destroy it — redirect, isolate,
            and slow spread while protecting the Containment Core.
          </p>
        </section>
        <section>
          <h3>PRIMARY ACTION</h3>
          <p>
            Tap corridors to seal or reopen bulkheads. Sealed doors block spread
            but accumulate pressure until they breach.
          </p>
        </section>
        <section>
          <h3>ABILITIES</h3>
          <ul>
            <li>SERUM — cleanse infected rooms</li>
            <li>REINFORCE — restore sealed door integrity</li>
            <li>PURGE — sacrifice a room (hold to confirm)</li>
            <li>LOCKDOWN — freeze corridor spread briefly</li>
          </ul>
        </section>
        <section>
          <h3>CRITICAL SYSTEMS</h3>
          <ul>
            <li>PWR — power regeneration</li>
            <li>SER — serum production</li>
            <li>SCN — scanner warnings</li>
            <li>SEC — door durability</li>
            <li>VNT — airborne resistance</li>
          </ul>
        </section>
        <button type="button" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
