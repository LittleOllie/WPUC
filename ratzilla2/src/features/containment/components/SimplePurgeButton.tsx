interface SimplePurgeButtonProps {
  charge: number;
  ready: boolean;
  onActivate: () => void;
}

export default function SimplePurgeButton({ charge, ready, onActivate }: SimplePurgeButtonProps) {
  const pct = Math.round(charge * 100);

  return (
    <footer className="cp-simple-purge">
      <button
        type="button"
        className={`cp-simple-purge__btn${ready ? " cp-simple-purge__btn--ready" : ""}`}
        onClick={onActivate}
        disabled={!ready}
      >
        <span className="cp-simple-purge__label">PURGE</span>
        <span className="cp-simple-purge__hint">Clear infection near Core</span>
        <span className="cp-simple-purge__meter" aria-hidden="true">
          <span className="cp-simple-purge__fill" style={{ height: `${pct}%` }} />
        </span>
        <span className="cp-simple-purge__pct">{ready ? "READY" : `${pct}%`}</span>
      </button>
    </footer>
  );
}
