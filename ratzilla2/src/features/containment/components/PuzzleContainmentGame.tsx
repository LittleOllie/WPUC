import { useCallback, useEffect, useRef, useState } from "react";
import { ContainmentPuzzleSimulation } from "../engine/puzzle/ContainmentPuzzleSimulation";
import { PuzzleBoardRenderer } from "../rendering/PuzzleBoardRenderer";
import { CameraController } from "../rendering/CameraController";
import { AudioManager } from "../audio/AudioManager";
import { loadPersistence, recordBestRun, savePersistence } from "../persistence/storage";
import type { PuzzleMode, PuzzleSnapshot } from "../types/puzzle";
import PuzzleHud from "./PuzzleHud";
import PuzzleCellMenu, { type CellMenuAnchor } from "./PuzzleCellMenu";
import PuzzleGameOverPanel from "./PuzzleGameOverPanel";
import PuzzleHowToPlay from "./PuzzleHowToPlay";
import PuzzlePauseMenu from "./PuzzlePauseMenu";
import PuzzleStageClear from "./PuzzleStageClear";

const HINT_TEXT = [
  "TAP A ROOM — SCAN OR LOCK",
  "NUMBERS SHOW NEARBY INFECTION",
  "TAP INFECTED ROOM — LOCK IT",
];

interface PuzzleContainmentGameProps {
  onReturn: () => void;
}

export default function PuzzleContainmentGame({ onReturn }: PuzzleContainmentGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ContainmentPuzzleSimulation | null>(null);
  const rendererRef = useRef<PuzzleBoardRenderer | null>(null);
  const cameraRef = useRef(new CameraController());
  const audioRef = useRef(new AudioManager());
  const rafRef = useRef<number>(0);
  const recordedRef = useRef(false);
  const lastStageRef = useRef(0);

  const [snapshot, setSnapshot] = useState<PuzzleSnapshot | null>(null);
  const [persisted, setPersisted] = useState(loadPersistence);
  const [showPause, setShowPause] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [cellMenuAnchor, setCellMenuAnchor] = useState<CellMenuAnchor | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedCellId(null);
    setCellMenuAnchor(null);
  }, []);

  const anchorForCell = useCallback((cellId: string): CellMenuAnchor | null => {
    const wrap = boardWrapRef.current;
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const sim = simRef.current;
    if (!wrap || !canvas || !renderer || !sim) return null;

    const canvasRect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const pos = renderer.cellCanvasPosition(
      cellId,
      sim.getSnapshot(),
      cameraRef.current.state,
      canvasRect.width,
      canvasRect.height,
    );
    if (!pos) return null;

    return {
      x: canvasRect.left - wrapRect.left + pos.x,
      y: canvasRect.top - wrapRect.top + pos.y,
    };
  }, []);

  const openCellMenu = useCallback(
    (cellId: string) => {
      const anchor = anchorForCell(cellId);
      if (!anchor) return;
      setSelectedCellId(cellId);
      setCellMenuAnchor(anchor);
    },
    [anchorForCell],
  );

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.stage !== lastStageRef.current) {
      lastStageRef.current = snapshot.stage;
      clearSelection();
    }
  }, [snapshot?.stage, clearSelection]);

  useEffect(() => {
    if (snapshot?.hint !== 2) return;
    const target = snapshot.cells.find((c) => c.highlight);
    if (target) openCellMenu(target.id);
  }, [snapshot?.hint, snapshot?.stage, openCellMenu]);

  const startGame = useCallback((seed?: number) => {
    lastStageRef.current = 0;
    clearSelection();
    const p = loadPersistence();
    const gameSeed =
      seed ??
      (((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0) || 1);
    const sim = new ContainmentPuzzleSimulation(gameSeed);
    if (p.tutorialComplete) sim.skipHints();
    simRef.current = sim;
    recordedRef.current = false;
    setSnapshot(sim.getSnapshot());
    setShowPause(false);
  }, [clearSelection]);

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
      rendererRef.current = new PuzzleBoardRenderer(canvas);
    } catch {
      return;
    }
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent && rendererRef.current) {
        rendererRef.current.resize(parent.clientWidth, parent.clientHeight);
      }
      if (selectedCellId) {
        const anchor = anchorForCell(selectedCellId);
        if (anchor) setCellMenuAnchor(anchor);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [anchorForCell, selectedCellId]);

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

      if (sim && !sim.isPaused() && sim.phase === "playing") {
        sim.update(now);
        for (const ev of sim.drainEvents()) {
          if (ev.type === "safe_reveal") audioRef.current.play("confirm", 0.4);
          if (ev.type === "infected_reveal" || ev.type === "outbreak") {
            audioRef.current.play("door_stress", 0.7);
          }
          if (ev.type === "lock_applied") audioRef.current.play("door_seal");
          if (ev.type === "lock_removed") audioRef.current.play("confirm", 0.35);
          if (ev.type === "spread") {
            renderer?.noteSpread(ev.fromId, ev.toId);
            audioRef.current.play("mutation", 0.5);
          }
          if (ev.type === "core_exposure") audioRef.current.play("door_stress", 0.6);
          if (ev.type === "core_breach") audioRef.current.play("game_over");
          if (ev.type === "stage_clear") audioRef.current.play("serum", 0.6);
        }
      }

      if (sim) {
        const snap = sim.getSnapshot();
        setSnapshot(snap);

        if (snap.phase === "game_over" && !recordedRef.current) {
          recordedRef.current = true;
          const updated = recordBestRun(sim.computeScore(), snap.elapsedMs, snap.seed);
          setPersisted(updated);
          if (snap.hint < 3) savePersistence({ tutorialComplete: true });
        }

        if (renderer) {
          renderer.render(snap, cameraRef.current.state, selectedCellId);
          sim.clearCluePulses();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [selectedCellId]);

  useEffect(() => {
    if (snapshot?.phase !== "stage_clear") return;
    const t = window.setTimeout(() => {
      simRef.current?.advanceStage();
      clearSelection();
    }, 1400);
    return () => window.clearTimeout(t);
  }, [snapshot?.phase, snapshot?.stage, clearSelection]);

  const actOnCell = (cellId: string, mode: PuzzleMode) => {
    audioRef.current.unlock();
    const sim = simRef.current;
    if (!sim || sim.phase !== "playing") return false;
    return sim.actOnCell(cellId, mode);
  };

  const lockCell = (cellId: string) => {
    if (actOnCell(cellId, "lock")) {
      clearSelection();
      return true;
    }
    return false;
  };

  const unlockCell = (cellId: string) => {
    if (actOnCell(cellId, "unlock")) {
      clearSelection();
      return true;
    }
    return false;
  };

  const scanCell = (cellId: string) => {
    if (actOnCell(cellId, "scan")) {
      clearSelection();
      return true;
    }
    return false;
  };

  const hitTestAt = (clientX: number, clientY: number): string | null => {
    const sim = simRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!sim || !renderer || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return renderer.hitTestCell(
      sim.getSnapshot(),
      cameraRef.current.state,
      rect.width,
      rect.height,
      clientX - rect.left,
      clientY - rect.top,
    );
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".cp-cell-menu")) return;
    if (!(e.target as HTMLElement).closest("canvas")) return;
    cameraRef.current.beginPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    cameraRef.current.movePointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".cp-cell-menu")) return;

    const wasTap = cameraRef.current.endPointer();
    if (!wasTap) return;

    const sim = simRef.current;
    if (!sim || sim.phase !== "playing") return;

    const cellId = hitTestAt(e.clientX, e.clientY);
    if (!cellId) {
      clearSelection();
      return;
    }

    if (e.button === 2) {
      lockCell(cellId);
      return;
    }

    const cell = sim.getSnapshot().cells.find((c) => c.id === cellId);
    if (!cell || cell.isCore) return;

    if (selectedCellId === cellId) {
      clearSelection();
      return;
    }

    openCellMenu(cellId);
  };

  const snap = snapshot;
  const selectedCell =
    snap && selectedCellId
      ? snap.cells.find((c) => c.id === selectedCellId) ?? null
      : null;
  const hintText =
    snap && snap.hint < 3 ? HINT_TEXT[snap.hint] : snap?.message ?? "PROTECT THE CORE";

  return (
    <div className="cp-game cp-game--puzzle">
      {snap && snap.phase !== "game_over" && (
        <PuzzleHud
          stage={snap.stage}
          score={snap.score}
          locks={snap.locks}
          spreadCountdownMs={snap.spreadCountdownMs}
          message={hintText}
          bestScore={persisted.bestScore}
          onPause={() => {
            simRef.current?.pause();
            setShowPause(true);
          }}
          onHowToPlay={() => setShowHowToPlay(true)}
          onReturn={onReturn}
        />
      )}

      <div
        ref={boardWrapRef}
        className="cp-board-wrap cp-board-wrap--puzzle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          className="cp-board-canvas"
          aria-label="Containment hex board — tap a room for scan or lock"
        />
        {snap?.phase === "playing" && selectedCell && cellMenuAnchor && (
          <PuzzleCellMenu
            anchor={cellMenuAnchor}
            wrapRef={boardWrapRef}
            selectedCell={selectedCell}
            locks={snap.locks}
            maxLocks={snap.maxLocks}
            onScan={() => selectedCellId && scanCell(selectedCellId)}
            onLock={() => selectedCellId && lockCell(selectedCellId)}
            onUnlock={() => selectedCellId && unlockCell(selectedCellId)}
          />
        )}
        <div className="cp-board-controls">
          <button type="button" onClick={() => cameraRef.current.recenter()} aria-label="Recenter">
            ⊕
          </button>
        </div>
      </div>

      {snap?.phase === "stage_clear" && (
        <PuzzleStageClear stage={snap.stage} score={snap.score} />
      )}

      {showPause && (
        <PuzzlePauseMenu
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

      {showHowToPlay && <PuzzleHowToPlay onClose={() => setShowHowToPlay(false)} />}

      {snap?.phase === "game_over" && (
        <PuzzleGameOverPanel
          stage={snap.stage}
          score={snap.score}
          bestScore={persisted.bestScore}
          onTryAgain={() => startGame(snap.seed)}
          onNewIncident={() => startGame()}
          onReturn={onReturn}
        />
      )}
    </div>
  );
}
