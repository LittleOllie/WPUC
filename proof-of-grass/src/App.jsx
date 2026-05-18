import { useRef } from "react";
import { motion } from "framer-motion";
import GrassTimer from "./components/GrassTimer.jsx";
import LayeredGrass from "./components/LayeredGrass.jsx";
import PogLogo from "./components/PogLogo.jsx";
import SceneBackdrop from "./components/SceneBackdrop.jsx";
import SceneCharacters from "./components/SceneCharacters.jsx";
import { useDayWeather } from "./hooks/useDayWeather.js";
import { useGrassMoveTimer } from "./hooks/useGrassMoveTimer.js";
import { useMobileLayout } from "./hooks/useMobileLayout.js";
import { useSceneTouchGuard } from "./hooks/useSceneTouchGuard.js";
import { SKY_BLUE } from "./lib/assets.js";

/**
 * Proof of Grass — grass interaction is the product.
 * UI kept minimal; atmosphere + tactile lawn are the focus.
 */
export default function App() {
  const appRef = useRef(null);
  const mobile = useMobileLayout();
  const { weather } = useDayWeather();
  const wind = weather === "rain" ? 1.15 : weather === "night" ? 0.55 : 0.85;
  const { formatted, moving, setMoving } = useGrassMoveTimer();
  useSceneTouchGuard(appRef);

  return (
    <motion.div
      ref={appRef}
      className={`pog-app relative h-[100dvh] w-full overflow-hidden${mobile ? " pog-app--mobile" : " pog-app--desktop"}`}
      style={{ backgroundColor: SKY_BLUE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      <SceneBackdrop weather={weather} />

      <LayeredGrass wind={wind} onGrassMovingChange={setMoving} mobile={mobile} />

      <SceneCharacters />

      <header className="pog-top-bar" aria-label="Proof of Grass">
        <PogLogo />
        <motion.div className="pog-timer-slot">
          <GrassTimer formatted={formatted} moving={moving} />
        </motion.div>
      </header>
    </motion.div>
  );
}
