import { motion } from "framer-motion";
import { ASSETS } from "../lib/assets.js";

/** Subtle corner mark — doesn't compete with the timer */
export default function PogLogo({ className = "" }) {
  return (
    <motion.img
      src={ASSETS.logo}
      alt="Proof of Grass"
      className={`pog-logo${className ? ` ${className}` : ""}`}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
