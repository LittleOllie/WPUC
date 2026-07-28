import { useCallback, useEffect, useRef, useState } from "react";
import { GameSimulation } from "../engine/GameSimulation";
import { createIncidentFromSeed, createNewIncident } from "../engine/IncidentGenerator";
import { BoardRenderer } from "../rendering/BoardRenderer";
import { CameraController } from "../rendering/CameraController";
import { AudioManager } from "../audio/AudioManager";
import {
  loadPersistence,
  recordBestRun,
  savePersistence,
  type ContainmentPersistedData,
} from "../persistence/storage";
import type { SimulationSnapshot } from "../types";
import GameHud from "../components/GameHud";
import AbilityBar from "../components/AbilityBar";
import PauseMenu from "../components/PauseMenu";
import GameOverPanel from "../components/GameOverPanel";
import BootSequence from "../components/BootSequence";
import DebugPanel from "../components/DebugPanel";
import SettingsPanel from "../components/SettingsPanel";
import HowToPlayPanel from "../components/HowToPlayPanel";
import IncidentBriefing from "../components/IncidentBriefing";
import TutorialOverlay from "../components/TutorialOverlay";
import ContextualGuidance from "../components/ContextualGuidance";
import SelectionDetailPanel from "../components/SelectionDetailPanel";

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface ContainmentGameProps {
  onReturn: () => void;
}

export default function ContainmentGame({ onReturn }: ContainmentGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<GameSimulation | null>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const cameraRef = useRef(new CameraController());
  const audioRef = useRef(new AudioManager());
  const rafRef = useRef<number>(0);
  const snapshotRef = useRef<SimulationSnapshot | null>(null);
  const clockRef = useRef(performance.now());

  const [persisted, setPersisted] = useState<ContainmentPersistedData>(() =>
    loadPersistence(),
  );
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [showPause, setShowPause] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<string | null>(null);
  const [purgeHold, setPurgeHold] = useState(0);

  const initGame = useCallback((seed?: number, tutorial?: boolean) => {
    const p = loadPersistence();
    const useTutorial = tutorial ?? !p.tutorialComplete;
    const incident =
      seed !== undefined
        ? createIncidentFromSeed(seed, useTutorial)
        : createNewIncident(useTutorial);

    savePersistence({ lastSeed: incident.seed });
    const sim = new GameSimulation(incident);
    sim.startBoot(performance.now());
    simRef.current = sim;
    snapshotRef.current = sim.getSnapshot();
    setSnapshot(sim.getSnapshot());
    setShowPause(false);
  }, []);

  const completeTutorial = useCallback(() => {
    savePersistence({ tutorialComplete: true });
    setPersisted(loadPersistence());
  }, []);

  useEffect(() => {
    try {
      const p = loadPersistence();
      initGame(p.lastSeed ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Init failed");
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current.dispose();
    };
  }, [initGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      rendererRef.current = new BoardRenderer(canvas);
    } catch {
      setError("Canvas renderer unavailable");
      return;
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent || !rendererRef.current) return;
      rendererRef.current.resize(parent.clientWidth, parent.clientHeight);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(persisted.reducedMotion);
  }, [persisted.reducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSettings || showHowToPlay) {
          setShowSettings(false);
          setShowHowToPlay(false);
          return;
        }
        if (simRef.current?.phase === "playing") {
          simRef.current.pause();
          setShowPause(true);
        } else if (simRef.current?.phase === "paused") {
          simRef.current.resume();
          setShowPause(false);
        }
        simRef.current?.selectRoom(null);
        simRef.current?.selectCorridor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings, showHowToPlay]);

  useEffect(() => {
    audioRef.current.setMuted(persisted.muted);

    const onVisibility = () => {
      if (!persisted.autoPauseOnHide) return;
      if (document.hidden) {
        simRef.current?.pause();
        setShowPause(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [persisted.autoPauseOnHide, persisted.muted]);

  useEffect(() => {
    const loop = (now: number) => {
      clockRef.current = now;
      const sim = simRef.current;
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;

      const phase = sim?.phase;
      if (sim && !sim.isPaused() && phase !== "game_over" && phase !== "briefing") {
        sim.update(now);
        const events = sim.drainEvents();
        for (const ev of events) {
          if (ev.type === "door_sealed") audioRef.current.play("door_seal");
          if (ev.type === "door_reopened") audioRef.current.play("door_open");
          if (ev.type === "door_breach") audioRef.current.play("breach");
          if (ev.type === "serum_deployed") audioRef.current.play("serum");
          if (ev.type === "mutation") audioRef.current.play("mutation");
          if (ev.type === "room_purged") audioRef.current.play("purge");
          if (ev.type === "game_over") audioRef.current.play("game_over");
          if (ev.type === "lockdown_start") audioRef.current.play("lockdown");
        }

        if (sim.phase === "game_over" && snapshotRef.current?.phase !== "game_over") {
          const snap = sim.getSnapshot();
          recordBestRun(snap.score, snap.elapsedMs, snap.incident.seed);
          setPersisted(loadPersistence());
          if (snap.incident.tutorialMode) completeTutorial();
        }
      }

      if (sim && phase === "briefing") {
        sim.update(now);
      }

      if (sim) {
        const snap = sim.getSnapshot();
        snapshotRef.current = snap;
        setSnapshot(snap);

        if (renderer && canvas && snap.phase === "playing") {
          renderer.render(snap, cameraRef.current.state, {
            flashCorridorId: sim.getTutorialCorridorHint(),
            flashRoomId: sim.getTutorialRoomHint(),
            tutorialHighlights: snap.tutorialHighlights,
            reducedMotion: persisted.reducedMotion,
          });
        } else if (renderer && canvas && (snap.phase === "paused" || snap.phase === "game_over")) {
          renderer.render(snap, cameraRef.current.state, {
            flashCorridorId: null,
            flashRoomId: null,
            tutorialHighlights: snap.tutorialHighlights,
            reducedMotion: persisted.reducedMotion,
          });
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [completeTutorial, persisted.reducedMotion]);

  const unlockAudio = () => {
    audioRef.current.unlock();
    if (persisted.muted) {
      savePersistence({ muted: false });
      setPersisted(loadPersistence());
      audioRef.current.setMuted(false);
    }
  };

  const handleCanvasPointer = (e: React.PointerEvent) => {
    if (cameraRef.current.isDragging()) return;
    unlockAudio();
    const sim = simRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!sim || !renderer || !canvas || sim.phase !== "playing") return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const snap = sim.getSnapshot();

    const corridorId = renderer.hitTestCorridor(
      snap,
      cameraRef.current.state,
      rect.width,
      rect.height,
      x,
      y,
    );
    if (corridorId) {
      if (sim.selectCorridor(corridorId)) {
        audioRef.current.play("confirm", 0.5);
      }
      return;
    }

    const roomId = renderer.hitTestRoom(
      snap,
      cameraRef.current.state,
      rect.width,
      rect.height,
      x,
      y,
    );
    if (roomId) {
      sim.selectRoom(roomId);
      audioRef.current.play("confirm", 0.5);
    }
  };

  const handleRestartSame = (tutorial = false) => {
    const seed = simRef.current?.incident.seed ?? loadPersistence().lastSeed ?? 1842;
    initGame(seed, tutorial);
  };

  const handleRestartNew = (tutorial = false) => {
    initGame(undefined, tutorial);
  };

  const handleSkipTutorial = () => {
    simRef.current?.skipTutorialMode();
    completeTutorial();
  };

  const handleReplayTutorial = () => {
    savePersistence({ tutorialComplete: false });
    setPersisted(loadPersistence());
    initGame(undefined, true);
    setShowPause(false);
  };

  const handleDismissBriefing = () => {
    simRef.current?.dismissBriefing();
  };

  if (error) {
    return (
      <div className="cp-error">
        <h1>CONTAINMENT INTERFACE OFFLINE</h1>
        <p>{error}</p>
        <button type="button" onClick={() => initGame()}>
          REINITIALISE SYSTEM
        </button>
        <button type="button" onClick={onReturn}>
          RETURN TO BLACKWATER
        </button>
      </div>
    );
  }

  const snap = snapshot;
  const isBoot = snap?.phase === "boot" || snap?.phase === "intro";
  const showBriefing = snap?.phase === "briefing";

  return (
    <div className="cp-game">
      <div className="cp-a11y-status" aria-live="polite" aria-atomic="true">
        {snap &&
          `Time ${formatTime(snap.elapsedMs)}. Core ${Math.round(snap.coreIntegrity)}%.`}
      </div>

      {isBoot && snap && (
        <BootSequence
          phase={snap.phase}
          messages={snap.messages}
          onHowToPlay={() => setShowHowToPlay(true)}
        />
      )}

      {showBriefing && snap && (
        <IncidentBriefing incident={snap.incident} onDismiss={handleDismissBriefing} />
      )}

      {snap && !isBoot && !showBriefing && (
        <GameHud
          snapshot={snap}
          onPause={() => {
            simRef.current?.pause();
            setShowPause(true);
          }}
          onReturn={onReturn}
          onHowToPlay={() => setShowHowToPlay(true)}
        />
      )}

      {snap && snap.phase === "playing" && (
        <ContextualGuidance snapshot={snap} now={clockRef.current} />
      )}

      {snap?.tutorial && snap.tutorial.active && (
        <TutorialOverlay tutorial={snap.tutorial} onSkip={handleSkipTutorial} />
      )}

      <div className="cp-board-area">
        <div
          className="cp-board-wrap"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("canvas")) {
              cameraRef.current.startDrag(e.clientX, e.clientY);
            }
          }}
          onPointerMove={(e) => cameraRef.current.drag(e.clientX, e.clientY)}
          onPointerUp={() => cameraRef.current.endDrag()}
          onPointerLeave={() => cameraRef.current.endDrag()}
        >
          <canvas
            ref={canvasRef}
            className="cp-board-canvas"
            onPointerDown={handleCanvasPointer}
            aria-label="Containment laboratory board"
          />
          <div className="cp-board-controls">
            <button type="button" onClick={() => cameraRef.current.recenter()} aria-label="Recenter">
              ⊕
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current.setScale(cameraRef.current.state.scale * 1.15)}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current.setScale(cameraRef.current.state.scale * 0.87)}
              aria-label="Zoom out"
            >
              −
            </button>
          </div>
        </div>

        {snap && (snap.phase === "playing" || snap.phase === "paused") && (
          <SelectionDetailPanel snapshot={snap} />
        )}
      </div>

      {snap && snap.phase === "playing" && (
        <AbilityBar
          snapshot={snap}
          purgeTarget={purgeTarget}
          purgeHold={purgeHold}
          onSeal={() => {
            if (snap.selectedCorridorId) {
              simRef.current?.toggleDoor(snap.selectedCorridorId, performance.now());
            }
          }}
          onSerum={() => {
            if (snap.selectedRoomId) {
              simRef.current?.deploySerum(snap.selectedRoomId, performance.now());
            }
          }}
          onReinforce={() => {
            if (snap.selectedCorridorId) {
              simRef.current?.reinforce(snap.selectedCorridorId, performance.now());
            }
          }}
          onPurgeStart={setPurgeTarget}
          onPurgeHold={setPurgeHold}
          onPurgeConfirm={() => {
            if (purgeTarget) {
              simRef.current?.emergencyPurge(purgeTarget, performance.now());
              setPurgeTarget(null);
              setPurgeHold(0);
            }
          }}
          onLockdown={() => simRef.current?.facilityLockdown(performance.now())}
        />
      )}

      {showPause && snap && (
        <PauseMenu
          onResume={() => {
            simRef.current?.resume();
            setShowPause(false);
          }}
          onRestartSame={() => handleRestartSame(false)}
          onRestartNew={() => handleRestartNew(false)}
          onHowToPlay={() => setShowHowToPlay(true)}
          onReplayTutorial={handleReplayTutorial}
          onSettings={() => setShowSettings(true)}
          onReturn={onReturn}
        />
      )}

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

      {showHowToPlay && <HowToPlayPanel onClose={() => setShowHowToPlay(false)} />}

      {snap?.phase === "game_over" && (
        <GameOverPanel
          snapshot={snap}
          best={persisted}
          onRestartSame={() => handleRestartSame(false)}
          onRestartNew={() => handleRestartNew(false)}
          onReturn={onReturn}
        />
      )}

      {import.meta.env.DEV && simRef.current && <DebugPanel sim={simRef.current} />}
    </div>
  );
}
