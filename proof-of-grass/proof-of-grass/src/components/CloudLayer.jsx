import { CLOUDS } from "../lib/assets.js";

/** Few large clouds — slow drift right → left, staggered lanes */
const CLOUD_LANES = [
  { src: 0, top: 8, width: 420, duration: 320, delay: -60 },
  { src: 1, top: 20, width: 480, duration: 380, delay: -180 },
  { src: 2, top: 12, width: 400, duration: 350, delay: -240 },
  { src: 0, top: 28, width: 450, duration: 400, delay: -120 },
];

/** WebP clouds drift slowly right → left */
export default function CloudLayer({ weather }) {
  const isNight = weather === "night";
  const isRain = weather === "rain";

  return (
    <div className="pog-cloud-layer absolute inset-0 overflow-hidden" aria-hidden>
      {CLOUD_LANES.map((lane, i) => (
        <div
          key={i}
          className="pog-cloud-wrap"
          style={{
            top: `${lane.top}%`,
            width: lane.width,
            animationDuration: `${lane.duration}s`,
            animationDelay: `${lane.delay}s`,
            filter: isNight
              ? "brightness(0.85) saturate(0.9)"
              : isRain
                ? "brightness(0.95) saturate(0.95)"
                : undefined,
          }}
        >
          <img
            src={CLOUDS[lane.src]}
            alt=""
            draggable={false}
            className="pog-cloud"
          />
        </div>
      ))}
    </div>
  );
}
