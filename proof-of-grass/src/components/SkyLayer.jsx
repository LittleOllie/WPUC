import { motion } from "framer-motion";
import { skyGradient } from "../hooks/useDayWeather.js";

function Cloud({ delay, duration, top, scale, opacity }) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full bg-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.4)]"
      style={{
        top: `${top}%`,
        width: `${120 * scale}px`,
        height: `${48 * scale}px`,
        opacity,
        left: "-20%",
      }}
      initial={{ x: "-10vw" }}
      animate={{ x: "115vw" }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <span
        className="absolute -left-6 top-2 h-10 w-14 rounded-full bg-white/95"
        aria-hidden
      />
      <span
        className="absolute left-8 -top-3 h-12 w-16 rounded-full bg-white/95"
        aria-hidden
      />
      <span
        className="absolute right-0 top-1 h-9 w-12 rounded-full bg-white/90"
        aria-hidden
      />
    </motion.div>
  );
}

export default function SkyLayer({ weather }) {
  const isNight = weather === "night";
  const isRain = weather === "rain";

  return (
    <div
      className="relative h-full w-full overflow-hidden transition-[background] duration-[4000ms] ease-in-out"
      style={{ background: skyGradient(weather) }}
    >
      {isNight && (
        <>
          {[...Array(24)].map((_, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${(i * 41) % 100}%`,
                top: `${(i * 17) % 45}%`,
                width: 1 + (i % 3),
                height: 1 + (i % 3),
                opacity: 0.4 + (i % 5) * 0.12,
              }}
              animate={{ opacity: [0.3, 0.9, 0.3] }}
              transition={{ duration: 2 + (i % 4), repeat: Infinity }}
            />
          ))}
        </>
      )}

      {!isNight && (
        <>
          <Cloud delay={0} duration={85} top={12} scale={1.1} opacity={0.85} />
          <Cloud delay={20} duration={110} top={22} scale={0.85} opacity={0.7} />
          <Cloud delay={45} duration={95} top={8} scale={0.7} opacity={0.55} />
        </>
      )}

      {weather === "sunset" && (
        <motion.div
          className="absolute left-1/2 top-[28%] h-16 w-16 -translate-x-1/2 rounded-full bg-[#ffd166] shadow-[0_0_60px_#ffb347]"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      )}

      {isRain && (
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(165deg, transparent, transparent 4px, rgba(255,255,255,0.15) 4px, rgba(255,255,255,0.15) 5px)",
            backgroundSize: "8px 24px",
          }}
          animate={{ backgroundPositionY: ["0px", "48px"] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
        />
      )}

      {weather === "fog" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/50 to-transparent" />
      )}
    </div>
  );
}
