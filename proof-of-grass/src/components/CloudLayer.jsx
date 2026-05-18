import { CLOUDS } from "../lib/assets.js";

const CLOUD_LANES_IMMERSIVE = [
  { src: 0, top: 8, width: 420, duration: 320, delay: -60 },
  { src: 1, top: 20, width: 480, duration: 380, delay: -180 },
  { src: 2, top: 12, width: 400, duration: 350, delay: -240 },
  { src: 0, top: 28, width: 450, duration: 400, delay: -120 },
];

const CLOUD_LANES_PORTRAIT = [
  { src: 1, top: 10, width: 240, duration: 480, delay: -90 },
  { src: 2, top: 24, width: 220, duration: 560, delay: -320 },
];

export default function CloudLayer({ weather, portrait = true }) {
  const isNight = weather === "night";
  const isRain = weather === "rain";
  const lanes = portrait ? CLOUD_LANES_PORTRAIT : CLOUD_LANES_IMMERSIVE;

  return (
    <div className="pog-cloud-layer absolute inset-0 overflow-hidden" aria-hidden>
      {lanes.map((lane, i) => (
        <div
          key={i}
          className="pog-cloud-wrap"
          style={{
            top: `${lane.top}%`,
            width: portrait ? `min(${lane.width}px, 68%)` : lane.width,
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
            className="pog-cloud pog-touch-guard"
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      ))}
    </div>
  );
}
