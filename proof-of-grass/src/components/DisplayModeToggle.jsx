import { motion } from "framer-motion";

export default function DisplayModeToggle({
  immersive,
  onSelectPortrait,
  onSelectImmersive,
}) {
  return (
    <motion.div
      className="pog-mode-switch"
      role="group"
      aria-label="Display mode"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.45 }}
    >
      <motion.div
        className="pog-mode-switch__thumb"
        aria-hidden
        initial={false}
        animate={{ x: immersive ? "100%" : "0%" }}
        transition={{ type: "spring", stiffness: 480, damping: 34 }}
      />
      <button
        type="button"
        className="pog-mode-switch__option"
        aria-pressed={!immersive}
        onClick={onSelectPortrait}
      >
        Pocket
      </button>
      <button
        type="button"
        className="pog-mode-switch__option"
        aria-pressed={immersive}
        onClick={onSelectImmersive}
      >
        Ultra Grass 🌱
      </button>
    </motion.div>
  );
}
