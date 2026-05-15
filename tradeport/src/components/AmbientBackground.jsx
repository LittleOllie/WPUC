import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { getCollectionById } from "../data/collections";

const DEFAULT_GLOWS = [
  { color: "rgba(124, 92, 255, 0.12)", x: "10%", y: "20%", size: 320 },
  { color: "rgba(232, 121, 249, 0.08)", x: "80%", y: "10%", size: 280 },
  { color: "rgba(103, 232, 249, 0.06)", x: "60%", y: "70%", size: 360 },
];

export default function AmbientBackground() {
  const { pathname } = useLocation();

  const theme = useMemo(() => {
    const match = pathname.match(/^\/collection\/([^/]+)/);
    if (!match) return null;
    return getCollectionById(match[1])?.theme ?? null;
  }, [pathname]);

  const glows = theme
    ? [
        { color: `${theme.primary}22`, x: "5%", y: "15%", size: 400 },
        { color: `${theme.secondary}18`, x: "75%", y: "5%", size: 340 },
        { color: `${theme.accent}12`, x: "50%", y: "65%", size: 380 },
      ]
    : DEFAULT_GLOWS;

  const bgTint = theme
    ? `radial-gradient(ellipse 80% 50% at 50% -10%, ${theme.primary}18, transparent 55%)`
    : "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(124, 92, 255, 0.1), transparent 50%)";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ background: bgTint }}
    >
      {glows.map((g, i) => (
        <div
          key={i}
          className={`tp-particle ${i % 2 ? "tp-particle--slow" : ""}`}
          style={{
            left: g.x,
            top: g.y,
            width: g.size,
            height: g.size,
            background: g.color,
            animationDelay: `${i * 2.5}s`,
          }}
        />
      ))}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}
