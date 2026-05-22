import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { EVENT_MIN_GAP_MS, EVENT_MAX_GAP_MS } from "../lib/constants.js";

const EVENT_TYPES = [
  { id: "butterfly", weight: 3, night: false },
  { id: "bird", weight: 2, night: false },
  { id: "eyes", weight: 2, night: true },
  { id: "neighbor", weight: 2, night: false },
  { id: "walker", weight: 2, night: true },
  { id: "shooting-star", weight: 1, night: true },
  { id: "ufo", weight: 0.35, night: true },
];

function pickEvent(isNight) {
  const pool = EVENT_TYPES.filter((e) => (isNight ? e.night !== false : !e.night || e.id === "butterfly"));
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e.id;
  }
  return pool[0].id;
}

function EventSprite({ type }) {
  switch (type) {
    case "butterfly":
      return (
        <motion.span
          className="text-2xl"
          initial={{ x: "-10%", y: "40%", opacity: 0 }}
          animate={{ x: "110%", y: "35%", opacity: [0, 1, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 8, ease: "easeInOut" }}
        >
          🦋
        </motion.span>
      );
    case "bird":
      return (
        <motion.span
          className="text-xl"
          initial={{ x: "20%", y: "30%", opacity: 0, scale: 0.8 }}
          animate={{ x: "25%", y: "28%", opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: "50%" }}
          transition={{ duration: 4 }}
        >
          🐦
        </motion.span>
      );
    case "eyes":
      return (
        <motion.div
          className="flex gap-3 text-2xl"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "55%", opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 2.5 }}
        >
          <span>👀</span>
        </motion.div>
      );
    case "neighbor":
      return (
        <motion.div
          className="text-3xl"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "50%", opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 3 }}
        >
          🧑‍🌾
        </motion.div>
      );
    case "walker":
      return (
        <motion.div
          className="h-12 w-4 rounded-full bg-[#1a2e1f]/40"
          initial={{ x: "-5%", opacity: 0 }}
          animate={{ x: "105%", opacity: [0, 0.6, 0.6, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 12, ease: "linear" }}
        />
      );
    case "shooting-star":
      return (
        <motion.div
          className="absolute right-[20%] top-[15%] h-0.5 w-16 rotate-[25deg] rounded-full bg-white shadow-[0_0_8px_#fff]"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: [0, 1, 0], scaleX: [0, 1, 0.2], x: [0, 80] }}
          transition={{ duration: 1.2 }}
        />
      );
    case "ufo":
      return (
        <motion.span
          className="text-2xl"
          initial={{ x: "-10%", y: "20%", opacity: 0 }}
          animate={{ x: "110%", y: "18%", opacity: [0, 1, 1, 0] }}
          transition={{ duration: 6 }}
        >
          🛸
        </motion.span>
      );
    default:
      return null;
  }
}

export default function RandomEvents({ weather }) {
  const [event, setEvent] = useState(null);
  const isNight = weather === "night" || weather === "sunset";

  const scheduleNext = useCallback(() => {
    const gap =
      EVENT_MIN_GAP_MS + Math.random() * (EVENT_MAX_GAP_MS - EVENT_MIN_GAP_MS);
    return setTimeout(() => {
      const id = pickEvent(isNight);
      setEvent(id);
      setTimeout(() => setEvent(null), id === "walker" ? 12000 : 5000);
      scheduleNext();
    }, gap);
  }, [isNight]);

  useEffect(() => {
    const t = scheduleNext();
    return () => clearTimeout(t);
  }, [scheduleNext]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {event && (
          <motion.div
            key={event}
            className="absolute inset-0 flex items-start justify-center"
          >
            <EventSprite type={event} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
