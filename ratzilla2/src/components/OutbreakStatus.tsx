import { useInfectionStats } from "../hooks/useInfectionStats";

interface OutbreakStatusProps {
  className?: string;
}

export default function OutbreakStatus({ className = "" }: OutbreakStatusProps) {
  const { stats, progress, complete, available, pulsing } = useInfectionStats();

  return (
    <section
      className={`rz-outbreak ${className} ${pulsing ? "is-pulsing" : ""} ${complete ? "is-complete" : ""}`.trim()}
      aria-live="polite"
      aria-label="Global outbreak status"
    >
      <div className="rz-outbreak__scanlines" aria-hidden="true" />

      <h2 className="rz-outbreak__title">
        {complete ? "☣ OUTBREAK COMPLETE ☣" : "☣ OUTBREAK STATUS"}
      </h2>

      {!available ? (
        <p className="rz-outbreak__unavailable">Counter unavailable</p>
      ) : (
        <>
          <p className="rz-outbreak__count">
            <span className="rz-outbreak__count-value">{stats.count}</span>
            <span className="rz-outbreak__count-sep"> / </span>
            <span className="rz-outbreak__count-target">{stats.target}</span>
            <span className="rz-outbreak__count-label"> INFECTED</span>
          </p>

          <div
            className="rz-outbreak__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={stats.target}
            aria-valuenow={Math.min(stats.count, stats.target)}
            aria-label={`Outbreak progress ${Math.round(progress)} percent`}
          >
            <div
              className="rz-outbreak__bar-fill"
              style={{ width: `${complete ? 100 : progress}%` }}
            />
            <div className="rz-outbreak__bar-glow" aria-hidden="true" />
          </div>
        </>
      )}
    </section>
  );
}
