import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import DisplayModeToggle from "./components/DisplayModeToggle.jsx";
import GrassTimer from "./components/GrassTimer.jsx";
import LayeredGrass from "./components/LayeredGrass.jsx";
import SceneBackdrop from "./components/SceneBackdrop.jsx";
import { useDayWeather } from "./hooks/useDayWeather.js";
import { useDisplayMode } from "./hooks/useDisplayMode.js";
import { useGrassMoveTimer } from "./hooks/useGrassMoveTimer.js";
import { useSceneTouchGuard } from "./hooks/useSceneTouchGuard.js";
import { SKY_BLUE } from "./lib/assets.js";

/**
 * Proof of Grass — Games Lab card + frosted stage (Pocket / Ultra Grass modes).
 */
export default function App() {
  const appRef = useRef(null);
  const { immersive, portrait, setPortrait, setImmersive } = useDisplayMode();
  const { weather } = useDayWeather();
  const wind = weather === "rain" ? 1.15 : weather === "night" ? 0.55 : 0.85;
  const { formatted, moving, setMoving } = useGrassMoveTimer();
  useSceneTouchGuard(appRef, portrait);

  useEffect(() => {
    import("../../scripts/labs-game-switcher.js").then((mod) => {
      mod.initLabsGameSwitcher();
    });
  }, []);

  const modeClass = immersive ? "pog-app--immersive" : "pog-app--portrait";

  return (
    <>
      <div className="lo-playground__world" aria-hidden="true">
        <img
          className="lo-playground__bg"
          src="../webpageassets/labplayground.jpg"
          alt=""
          width="1535"
          height="1024"
          decoding="async"
          fetchPriority="high"
        />
        <div className="lo-playground__dim" />
      </div>

      <main className="lo-playground__content">
        <div className="lo-playground__shell pog__shell labs-game-shell">
          <div className="lo-playground__brand">
            <a href="../index.html#labs" aria-label="Little Ollie World Labs">
              <img
                src="../webpageassets/logo-nav.webp"
                className="lo-playground__logo"
                alt="Little Ollie"
                width="220"
                height="64"
                decoding="async"
              />
            </a>
          </div>

          <div className="lo-playground__card pog__card labs-game-card">
            <header className="labs-game-head pog__head">
              <p className="lo-playground__eyebrow">Games Lab</p>
              <h1 className="lo-playground__title labs-game-head__title">
                Proof of <span className="lo-playground__title-accent">Grass</span> 🌱
              </h1>
              <p className="lo-playground__lead labs-game-head__lead pog__lead">
                Touch grass. Track your recovery time.
              </p>
            </header>

            <div className="labs-game-card__stage-grow">
              <div className="pog__slot labs-game-slot">
                <div
                  className={`pog-frame labs-game-stage${immersive ? " pog-frame--immersive" : ""}`}
                >
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

                    <header className="pog-top-bar" aria-label="Grass timer">
                      <motion.div className="pog-top-bar__stack">
                        <motion.div className="pog-timer-slot">
                          <GrassTimer formatted={formatted} moving={moving} />
                        </motion.div>
                      </motion.div>
                    </header>
                  </motion.div>
                </div>
              </div>
            </div>

            <div className="pog__actions labs-game-actions">
              <DisplayModeToggle
                immersive={immersive}
                onSelectPortrait={setPortrait}
                onSelectImmersive={setImmersive}
              />
              <a
                href="../links/"
                className="labs-back-to-hub labs-back-to-hub--block labs-back-to-hub--green"
              >
                ← Back to Games Lab
              </a>
            </div>
          </div>

          <p className="lo-playground__foot">Little Ollie Labs • The Playground</p>
        </div>
      </main>
    </>
  );
}
