import { motion } from "framer-motion";

export default function DisplayModeToggle({ immersive, onToggle }) {
  return (
    <motion.button
      type="button"
      className="pog-mode-toggle"
      onClick={onToggle}
      aria-pressed={immersive}
      aria-label={
        immersive
          ? "Switch to pocket portrait mode"
          : "Switch to fullscreen desktop mode"
      }
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.45 }}
      whileTap={{ scale: 0.96 }}
    >
      {immersive ? "Pocket Mode" : "Ultra Grass Mode 🌱"}
    </motion.button>
  );
}
