import { motion } from "framer-motion";
import { ASSETS } from "../lib/assets.js";

/** Llama + fence — rendered above the interactive lawn */
export default function SceneCharacters() {
  return (
    <motion.div
      className="pog-scene-characters pointer-events-none absolute inset-0"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      <motion.div className="pog-llama-wrap">
        <img
          src={ASSETS.llama}
          alt=""
          className="pog-llama"
          draggable={false}
        />
      </motion.div>

      <motion.div className="pog-fence-wrap">
        <img
          src={ASSETS.fence}
          alt=""
          className="pog-fence"
          draggable={false}
        />
      </motion.div>
    </motion.div>
  );
}
