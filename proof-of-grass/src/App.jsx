import { useRef } from "react";
import { motion } from "framer-motion";
import DisplayModeToggle from "./components/DisplayModeToggle.jsx";
import GrassTimer from "./components/GrassTimer.jsx";
import LayeredGrass from "./components/LayeredGrass.jsx";
import PogLogo from "./components/PogLogo.jsx";
import SceneBackdrop from "./components/SceneBackdrop.jsx";
import ShellAmbience from "./components/ShellAmbience.jsx";
import { useDayWeather } from "./hooks/useDayWeather.js";
import { useDisplayMode } from "./hooks/useDisplayMode.js";
import { useGrassMoveTimer } from "./hooks/useGrassMoveTimer.js";
import { useSceneTouchGuard } from "./hooks/useSceneTouchGuard.js";
import { SKY_BLUE } from "./lib/assets.js";

/**
 * Proof of Grass — portrait pocket game by default; optional immersive desktop mode.
 */
export default function App() {
  const appRef = useRef(null);
  const { immersive, portrait, toggle } = useDisplayMode();
  const { weather } = useDayWeather();
  const wind = weather === "rain" ? 1.15 : weather === "night" ? 0.55 : 0.85;
  const { formatted, moving, setMoving } = useGrassMoveTimer();
  useSceneTouchGuard(appRef, portrait);

  const modeClass = immersive ? "pog-app--immersive" : "pog-app--portrait";

  return (
    <div
      className={`pog-shell${immersive ? " pog-shell--immersive" : ""}`}
    >
      <div className="pog-shell__backdrop" aria-hidden />
      {!immersive && <ShellAmbience />}

      <div className="pog-frame">
        <motion.div
          ref={appRef}
          className={`pog-app ${modeClass}`}
          style={{ backgroundColor: SKY_BLUE }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <SceneBackdrop weather={weather} portrait={portrait} />

          <LayeredGrass
            key={immersive ? "immersive" : "portrait"}
            wind={wind}
            onGrassMovingChange={setMoving}
            portrait={portrait}
          />

          <header className="pog-top-bar" aria-label="Proof of Grass">
            <PogLogo />
            <motion.div className="pog-top-bar__stack">
              <motion.div className="pog-timer-slot">
                <GrassTimer formatted={formatted} moving={moving} />
              </motion.div>
              <DisplayModeToggle immersive={immersive} onToggle={toggle} />
            </motion.div>
          </header>
        </motion.div>
      </div>
    </div>
  );
}
