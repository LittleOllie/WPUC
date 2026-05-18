import { motion } from "framer-motion";
import { ASSETS } from "../lib/assets.js";
import CloudLayer from "./CloudLayer.jsx";

/** Sky, weather tint, and clouds (characters render in SceneCharacters) */
export default function SceneBackdrop({ weather }) {
  const tint =
    weather === "night"
      ? "rgba(30, 60, 100, 0.22)"
      : weather === "rain"
        ? "rgba(120, 140, 160, 0.28)"
        : weather === "fog"
          ? "rgba(230, 238, 245, 0.35)"
          : weather === "sunset"
            ? "rgba(255, 180, 100, 0.14)"
            : "transparent";

  return (
    <motion.div
      className="pog-scene-visual pointer-events-none absolute inset-0"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      <img
        src={ASSETS.skyBg}
        alt=""
        className="pog-sky-bg"
        draggable={false}
      />

      {tint !== "transparent" && (
        <motion.div
          className="absolute inset-0 z-[5]"
          style={{ background: tint }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        />
      )}

      <CloudLayer weather={weather} />
    </motion.div>
  );
}
