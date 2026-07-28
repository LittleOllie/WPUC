import { useCallback, useEffect, useRef, useState } from "react";
import { SimplifiedSimulation } from "../engine/SimplifiedSimulation";
import { SimpleBoardRenderer } from "../rendering/SimpleBoardRenderer";
import { CameraController } from "../rendering/CameraController";
import { AudioManager } from "../audio/AudioManager";
import { loadPersistence, recordBestRun, savePersistence } from "../persistence/storage";
import type { SimpleSnapshot } from "../types/simplified";
import SimpleHud from "./SimpleHud";
import SimplePurgeButton from "./SimplePurgeButton";
import SimpleGameOverPanel from "./SimpleGameOverPanel";
import SimpleHowToPlay from "./SimpleHowToPlay";
import SimplePauseMenu from "./SimplePauseMenu";
import SettingsPanel from "./SettingsPanel";

const HINT_TEXT = [
  "TAP A CORRIDOR TO CLOSE THE DOOR",
  "THE INFECTION WILL FIND ANOTHER PATH",
  "ONLY THREE DOORS CAN STAY CLOSED",
];

interface SimpleContainmentGameProps {
  onReturn: () => void;
}

export default function SimpleContainmentGame({ onReturn }: SimpleContainmentGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<SimplifiedSimulation | null>(null);
  const rendererRef = useRef<SimpleBoardRenderer | null>(null);
  const cameraRef = useRef(new CameraController());
  const audioRef = useRef(new AudioManager());
  const rafRef = useRef<number>(0);

  const [snapshot, setSnapshot] = useState<SimpleSnapshot | null>(null);
  const [persisted, setPersisted] = useState(loadPersistence);
  const [showPause, setShowPause] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const recordedRef = useRef(false);

  const startGame = useCallback((seed?: number) => {
    const p = loadPersistence();
    const sim = new SimplifiedSimulation(seed ?? p.lastSeed ?? undefined);
    if (p.tutorialComplete) sim.skipHints();
    simRef.current = sim;
    recordedRef.current = false;
    setSnapshot(sim.getSnapshot());
    setShowPause(false);
  }, []);

  useEffect(() => {
    startGame();
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current.dispose();
    };
  }, [startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new SimpleBoardRenderer(canvas);
    } catch {
      return;
    }
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent && rendererRef.current) {
        rendererRef.current.resize(parent.clientWidth, parent.clientHeight);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(persisted.reducedMotion);
    audioRef.current.setMuted(persisted.muted);
  }, [persisted.reducedMotion, persisted.muted]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && persisted.autoPauseOnHide) {
        simRef.current?.pause();
        setShowPause(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [persisted.autoPauseOnHide]);

  useEffect(() => {
    const loop = (now: number) => {
      const sim = simRef.current;
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;

      if (sim && !sim.isPaused() && sim.phase !== "game_over") {
        sim.update(now);
        for (const ev of sim.drainEvents()) {
          if (ev.type === "door_closed") audioRef.current.play("door_seal");
          if (ev.type === "door_opened" || ev.type === "oldest_released") {
            audioRef.current.play("door_open");
          }
          if (ev.type === "new_source") audioRef.current.play("mutation", 0.6);
          if (ev.type === "purge") audioRef.current.play("serum");
          if (ev.type === "core_breach") audioRef.current.play("game_over");
          if (ev.type === "surge") audioRef.current.play("door_stress", 0.5);
        }
      }

      if (sim) {
        const snap = sim.getSnapshot();
        setSnapshot(snap);

        if (snap.phase === "game_over" && !recordedRef.current) {
          recordedRef.current = true;
          const updated = recordBestRun(sim.computeScore(), snap.elapsedMs, snap.seed);
          setPersisted(updated);
          if (snap.hint < 3) {
            savePersistence({ tutorialComplete: true });
          }
        }

        if (renderer && canvas && snap.phase !== "game_over") {
          renderer.render(snap, cameraRef.current.state);
        } else if (renderer && canvas) {
          renderer.render(snap, cameraRef.current.state);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleTap = (e: React.PointerEvent) => {
    audioRef.current.unlock();

    const sim = simRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!sim || !renderer || !canvas || sim.phase !== "playing") return;

    const rect = canvas.getBoundingClientRect();
    const corridorId = renderer.hitTestCorridor(
      sim.getSnapshot(),
      cameraRef.current.state,
      rect.width,
      rect.height,
      e.clientX - rect.left,
      e.clientY - rect.top,
    );

    if (corridorId) {
      sim.toggleCorridor(corridorId);
    }
  };

  const handleBoardPointerDown = (e: React.PointerEvent) => {
    if (!(e.target as HTMLElement).closest("canvas")) return;
    cameraRef.current.beginPointer(e.clientX, e.clientY);
  };

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    cameraRef.current.movePointer(e.clientX, e.clientY);
  };

  const handleBoardPointerUp = (e: React.PointerEvent) => {
    const wasTap = cameraRef.current.endPointer();
    if (wasTap && (e.target as HTMLElement).closest("canvas")) {
      handleTap(e);
    }
  };

  const snap = snapshot;
  const hintText =
    snap && snap.hint < 3 ? HINT_TEXT[snap.hint] : snap?.message ?? "PROTECT THE CORE";

  return (
    <div className="cp-game cp-game--simple">
      {snap && snap.phase !== "game_over" && (
        <SimpleHud
          elapsedMs={snap.elapsedMs}
          closedCount={snap.closedDoorIds.length}
          maxClosed={snap.maxClosedDoors}
          bestTimeMs={persisted.bestTimeMs}
          message={hintText}
          onPause={() => {
            simRef.current?.pause();
            setShowPause(true);
          }}
          onHowToPlay={() => setShowHowToPlay(true)}
          onReturn={onReturn}
        />
      )}

      <div
        className="cp-board-wrap cp-board-wrap--simple"
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        onPointerCancel={handleBoardPointerUp}
        onPointerLeave={handleBoardPointerUp}
      >
        <canvas
          ref={canvasRef}
          className="cp-board-canvas"
          aria-label="Containment board — tap corridors to close doors"
        />
        <div className="cp-board-controls">
          <button type="button" onClick={() => cameraRef.current.recenter()} aria-label="Recenter">
            ⊕
          </button>
        </div>
      </div>

      {snap && snap.phase === "playing" && (
        <SimplePurgeButton
          charge={snap.purgeCharge}
          ready={snap.purgeReady}
          onActivate={() => simRef.current?.activatePurge()}
        />
      )}

      {showPause && (
        <SimplePauseMenu
          onResume={() => {
            simRef.current?.resume();
            setShowPause(false);
          }}
          onTryAgain={() => startGame(simRef.current?.seed)}
          onNewIncident={() => startGame()}
          onHowToPlay={() => setShowHowToPlay(true)}
          onReturn={onReturn}
        />
      )}

      {showHowToPlay && <SimpleHowToPlay onClose={() => setShowHowToPlay(false)} />}

      {showSettings && (
        <SettingsPanel
          settings={persisted}
          onChange={(patch) => {
            savePersistence(patch);
            setPersisted(loadPersistence());
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {snap?.phase === "game_over" && (
        <SimpleGameOverPanel
          elapsedMs={snap.elapsedMs}
          bestTimeMs={persisted.bestTimeMs}
          onTryAgain={() => startGame(snap.seed)}
          onNewIncident={() => startGame()}
          onReturn={onReturn}
        />
      )}
    </div>
  );
}
