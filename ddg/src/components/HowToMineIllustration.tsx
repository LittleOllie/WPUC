import { useId } from "react";

/** Matches the underwater mine look from frappy-brew.js `drawUnderwaterMine` (body, spikes, highlight, antenna). */
export function HowToMineIllustration() {
  const gradId = useId().replace(/:/g, "");
  const r = 13;
  const spikes = 12;
  const paths: JSX.Element[] = [];
  for (let i = 0; i < spikes; i++) {
    const deg = (i / spikes) * 360;
    paths.push(
      <g key={i} transform={`rotate(${deg})`}>
        <path
          d={`M 0 ${-r * 0.92} L -3.5 ${-r * 1.62} L 3.5 ${-r * 1.62} Z`}
          fill="#5e6772"
          stroke="#14171c"
          strokeWidth={0.75}
        />
      </g>
    );
  }

  return (
    <svg
      className="howto-mine-svg"
      viewBox="-32 -32 64 64"
      width={48}
      height={48}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`howtoMineBody-${gradId}`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#95a8bd" />
          <stop offset="50%" stopColor="#4a5568" />
          <stop offset="100%" stopColor="#232830" />
        </radialGradient>
      </defs>
      <circle r={r} fill={`url(#howtoMineBody-${gradId})`} stroke="#171a20" strokeWidth={1.5} />
      {paths}
      <circle cx={-r * 0.28} cy={-r * 0.32} r={r * 0.2} fill="rgba(255,255,255,0.32)" />
      <line
        x1={0}
        y1={-r * 1.62}
        x2={0}
        y2={-r * 2.05}
        stroke="#3d4650"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
