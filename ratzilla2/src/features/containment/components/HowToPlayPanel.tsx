interface HowToPlayPanelProps {
  onClose: () => void;
}

export default function HowToPlayPanel({ onClose }: HowToPlayPanelProps) {
  return (
    <div className="cp-overlay" role="dialog" aria-label="How to play">
      <div className="cp-panel cp-panel--howto">
        <h2>HOW TO PLAY</h2>

        <section>
          <h3>YOUR GOAL</h3>
          <p>Protect the Containment Core for as long as possible.</p>
        </section>

        <div className="cp-howto-diagram" aria-hidden="true">
          <div className="cp-howto-row">
            <span className="cp-howto-node cp-howto-node--clean">LAB</span>
            <span className="cp-howto-line cp-howto-line--open">——</span>
            <span className="cp-howto-node cp-howto-node--infected">INF</span>
          </div>
          <p className="cp-howto-caption">Open corridor — infection spreads</p>
          <div className="cp-howto-row">
            <span className="cp-howto-node cp-howto-node--clean">LAB</span>
            <span className="cp-howto-line cp-howto-line--sealed">▮▮</span>
            <span className="cp-howto-node cp-howto-node--infected">INF</span>
          </div>
          <p className="cp-howto-caption">Sealed bulkhead — blocks spread, builds pressure</p>
        </div>

        <section>
          <h3>THE INFECTION</h3>
          <p>Infection spreads between connected rooms through open corridors.</p>
        </section>
        <section>
          <h3>BULKHEADS</h3>
          <p>Select a corridor and seal it to block normal infection spread.</p>
        </section>
        <section>
          <h3>PRESSURE</h3>
          <p>
            Infection trapped behind a sealed bulkhead creates pressure. Reinforce
            the door or reduce nearby infection before it breaches.
          </p>
        </section>
        <section>
          <h3>SERUM</h3>
          <p>Select an infected room and use Serum to reduce the infection.</p>
        </section>
        <section>
          <h3>REINFORCE</h3>
          <p>Select a sealed bulkhead and reinforce it to restore integrity.</p>
        </section>
        <section>
          <h3>PURGE</h3>
          <p>Permanently destroy one room and its infection. Hold to confirm.</p>
        </section>
        <section>
          <h3>LOCKDOWN</h3>
          <p>Temporarily stop corridor spread. Infection still grows inside rooms.</p>
        </section>
        <section>
          <h3>LOSS CONDITION</h3>
          <p>The run ends when the Containment Core is destroyed.</p>
        </section>

        <button type="button" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
