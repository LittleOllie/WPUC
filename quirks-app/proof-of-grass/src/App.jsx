import { motion } from "framer-motion";
import GrassTimer from "./components/GrassTimer.jsx";
import LayeredGrass from "./components/LayeredGrass.jsx";
import PogLogo from "./components/PogLogo.jsx";
import SceneBackdrop from "./components/SceneBackdrop.jsx";
import { useDayWeather } from "./hooks/useDayWeather.js";
import { useGrassMoveTimer } from "./hooks/useGrassMoveTimer.js";
import { SKY_BLUE } from "./lib/assets.js";

/**
 * Proof of Grass — grass interaction is the product.
 * UI kept minimal; atmosphere + tactile lawn are the focus.
 */
export default function App() {
  const { weather } = useDayWeather();
  const wind = weather === "rain" ? 1.15 : weather === "night" ? 0.55 : 0.85;
  const { formatted, moving, setMoving } = useGrassMoveTimer();

  return (
    <motion.div
      className="relative h-[100dvh] w-full overflow-hidden"
      style={{ backgroundColor: SKY_BLUE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      <SceneBackdrop weather={weather} />

      <LayeredGrass wind={wind} onGrassMovingChange={setMoving} />

      <PogLogo />

      <motion.div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex justify-center px-4 pt-5 sm:pt-7">
        <GrassTimer formatted={formatted} moving={moving} />
      </motion.div>
    </motion.div>
  );
}
