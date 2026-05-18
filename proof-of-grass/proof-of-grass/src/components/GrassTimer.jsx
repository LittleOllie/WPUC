import { motion } from "framer-motion";

export default function GrassTimer({ formatted, moving }) {
  return (
    <motion.div
      className={`lo-timer${moving ? " lo-timer--active" : ""}`}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="lo-timer__label">Grass time</p>
      <p className="lo-timer__value tabular-nums">{formatted}</p>
      <p className="lo-timer__hint">Touch grass. Be happy.</p>
    </motion.div>
  );
}
