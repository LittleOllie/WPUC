import {
  PUZZLE_OUTBREAK,
  PUZZLE_SCORING,
  PUZZLE_HINTS,
  getStageConfig,
} from "../../config/puzzleBalance";
import type {
  PuzzleCell,
  PuzzleEvent,
  PuzzleHint,
  PuzzleMode,
  PuzzlePhase,
  PuzzleSnapshot,
} from "../../types/puzzle";
import { SeededRandom, formatIncidentLabel } from "../../utils/SeededRandom";
import { generateBoard } from "./HexPuzzleBoard";
import { revealSafeCell, refreshClues, markInfectedVisible, contaminateAdjacentRevealed, computeClue } from "./ClueSystem";
import { LockSystem, isInfectionContained } from "./LockSystem";
import {
  pickSpreadTarget,
  applySpread,
  getActiveInfectionSources,
  checkCoreExposure,
  isCoreBreached,
} from "./InfectionSpreadSystem";
import { StageDirector } from "./StageDirector";

export class ContainmentPuzzleSimulation {
  private rng: SeededRandom;
  private cells = new Map<string, PuzzleCell>();
  private adjacency = new Map<string, string[]>();
  private coreId = "0,0";
  private lockSystem: LockSystem;
  private director = new StageDirector();
  private events: PuzzleEvent[] = [];
  private spreadCountdownMs = 12_000;
  private spreadIntervalMs = 12_000;
  private coreExposed = false;
  private hint: PuzzleHint = 0;
  private mode: PuzzleMode = "scan";
  private message: string | null = "PROTECT THE CORE";
  private score = 0;
  private deductionStreak = 0;
  private stageClearAt = 0;
  private lastTimestamp: number | null = null;
  private tutorialLockTarget: string | null = null;
  /** Changes each stage/run so infection placement is not identical every time */
  private layoutSalt = 0;

  tick = 0;
  elapsedMs = 0;
  phase: PuzzlePhase = "playing";
  seed: number;
  seedLabel: string;

  constructor(seed?: number) {
    this.seed = seed ?? (((Date.now() ^ 0x5eed) >>> 0) || 1);
    this.seedLabel = formatIncidentLabel(this.seed);
    this.rng = new SeededRandom(this.seed);
    this.layoutSalt = this.rng.int(1, 2_000_000_000);
    this.lockSystem = new LockSystem(3);
    this.loadStage(1, true);
  }

  private boardRngForStage(stage: number): SeededRandom {
    let entropy = (Math.random() * 0xffffffff) >>> 0;
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      entropy ^= buf[0]!;
    }
    this.layoutSalt =
      ((this.layoutSalt + 1) ^ entropy ^ (Date.now() >>> 0) ^ this.seed ^ stage * 991) >>>
        0 || 1;
    return new SeededRandom(this.layoutSalt);
  }

  private loadStage(stage: number, fresh: boolean): void {
    this.mode = "scan";
    this.director.stage = stage;
    const cfg = getStageConfig(stage);
    const board = generateBoard(stage, this.boardRngForStage(stage));
    this.cells = board.cells;
    this.adjacency = board.adjacency;
    this.coreId = board.coreId;
    this.spreadIntervalMs = cfg.spreadIntervalMs;
    this.spreadCountdownMs = cfg.spreadIntervalMs + cfg.spreadGraceMs;

    if (fresh) {
      this.lockSystem = new LockSystem(cfg.startLocks);
    } else {
      const carried = this.lockSystem.carryToNextStage(
        this.lockSystem.locks,
        cfg.carryLockCap,
      );
      this.lockSystem = new LockSystem(Math.max(carried, cfg.startLocks));
    }

    this.coreExposed = false;
    this.stageClearAt = 0;
    this.setupTutorialHighlights();
  }

  private setupTutorialHighlights(): void {
    for (const c of this.cells.values()) c.highlight = false;
    if (this.hint >= 3) return;

    const tutorialCell = this.cells.get(PUZZLE_HINTS.tutorialCellId);
    if (tutorialCell && tutorialCell.state === "hidden" && !tutorialCell.isInfected) {
      tutorialCell.highlight = true;
      return;
    }

    const safeHidden = [...this.cells.values()].find(
      (c) => !c.isCore && c.state === "hidden" && !c.isInfected,
    );
    if (safeHidden) safeHidden.highlight = true;
  }

  reset(seed?: number): void {
    this.seed = seed ?? this.seed;
    this.seedLabel = formatIncidentLabel(this.seed);
    this.rng = new SeededRandom(this.seed);
    this.layoutSalt = this.rng.int(1, 2_000_000_000) ^ (Date.now() >>> 0);
    this.director.reset();
    this.events = [];
    this.hint = 0;
    this.mode = "scan";
    this.message = "PROTECT THE CORE";
    this.score = 0;
    this.deductionStreak = 0;
    this.tick = 0;
    this.elapsedMs = 0;
    this.phase = "playing";
    this.lastTimestamp = null;
    this.tutorialLockTarget = null;
    this.loadStage(1, true);
  }

  skipHints(): void {
    this.hint = 3;
    for (const c of this.cells.values()) c.highlight = false;
  }

  setMode(mode: PuzzleMode): void {
    this.mode = mode;
    if (this.hint === 2) {
      this.message = "LOCK THE HIGHLIGHTED INFECTION";
    }
  }

  drainEvents(): PuzzleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  pause(): void {
    if (this.phase === "playing") this.phase = "paused";
  }

  resume(): void {
    if (this.phase === "paused") {
      this.phase = "playing";
      this.lastTimestamp = null;
    }
  }

  isPaused(): boolean {
    return this.phase === "paused";
  }

  getSnapshot(): PuzzleSnapshot {
    const infectionCount = [...this.cells.values()].filter((c) => c.isInfected).length;
    const containedCount = [...this.cells.values()].filter((c) =>
      isInfectionContained(c),
    ).length;

    return {
      tick: this.tick,
      elapsedMs: this.elapsedMs,
      phase: this.phase,
      seed: this.seed,
      seedLabel: this.seedLabel,
      stage: this.director.stage,
      score: this.score,
      cells: [...this.cells.values()].map((c) => ({
        ...c,
        coord: { ...c.coord },
        displayPos: { ...c.displayPos },
        isInfected: c.state === "hidden" ? false : c.isInfected,
      })),
      locks: this.lockSystem.locks,
      maxLocks: this.lockSystem.maxLocks,
      safeRevealsTowardLock: this.lockSystem.safeRevealsTowardLock,
      revealsPerLock: this.lockSystem.revealsPerLock,
      spreadCountdownMs: Math.ceil(this.spreadCountdownMs / 1000) * 1000,
      spreadIntervalMs: this.spreadIntervalMs,
      coreExposed: this.coreExposed,
      message: this.message,
      hint: this.hint,
      mode: this.mode,
      containedCount,
      infectionCount,
      stageClearAt: this.stageClearAt,
    };
  }

  update(now: number): void {
    if (this.phase !== "playing") return;

    if (this.lastTimestamp === null) {
      this.lastTimestamp = now;
      return;
    }

    const delta = Math.min(now - this.lastTimestamp, 200);
    this.lastTimestamp = now;
    this.elapsedMs += delta;
    this.spreadCountdownMs -= delta;

    if (this.spreadCountdownMs <= 0) {
      this.runSpreadEvent();
      this.spreadCountdownMs = this.spreadIntervalMs;
    }

    this.tick += 1;
  }

  stepMs(ms: number): void {
    if (this.phase !== "playing") return;
    this.elapsedMs += ms;
    this.spreadCountdownMs -= ms;
    while (this.spreadCountdownMs <= 0) {
      this.runSpreadEvent();
      this.spreadCountdownMs += this.spreadIntervalMs;
    }
    this.tick += 1;
  }

  actOnCell(cellId: string, mode?: PuzzleMode): boolean {
    if (this.phase !== "playing") return false;
    const action = mode ?? this.mode;
    if (action === "lock") return this.lockCell(cellId);
    if (action === "unlock") return this.unlockCell(cellId);
    return this.scanCell(cellId);
  }

  scanCell(cellId: string): boolean {
    const cell = this.cells.get(cellId);
    if (!cell || cell.isCore || cell.state === "locked") return false;
    if (cell.state !== "hidden") return false;

    cell.highlight = false;

    if (cell.isInfected) {
      markInfectedVisible(cell);
      const contaminated = contaminateAdjacentRevealed(cellId, this.cells, this.adjacency);
      this.score = Math.max(0, this.score - PUZZLE_SCORING.infectedScanPenalty);
      this.deductionStreak = 0;
      this.spreadCountdownMs = Math.max(
        500,
        this.spreadCountdownMs - PUZZLE_OUTBREAK.scanPenaltyMs,
      );
      this.events.push({ type: "infected_reveal", cellId });
      for (const id of contaminated) {
        this.events.push({ type: "infected_reveal", cellId: id });
      }
      this.events.push({ type: "outbreak" });
      this.message =
        contaminated.length > 0
          ? "OUTBREAK — ADJACENT ROOMS CONTAMINATED"
          : "OUTBREAK — INFECTION REVEALED";
      refreshClues(this.cells, this.adjacency);
      this.advanceTutorialAfterScan(true);
      this.checkCoreState();
      return true;
    }

    const revealed = revealSafeCell(
      cellId,
      this.cells,
      this.adjacency,
      getStageConfig(this.director.stage).revealBurstMax,
    );
    for (const id of revealed) {
      this.events.push({ type: "safe_reveal", cellId: id });
    }
    this.score += revealed.length * PUZZLE_SCORING.safeReveal;
    this.score += Math.floor(this.spreadCountdownMs / 1000) * PUZZLE_SCORING.spreadTimeBonus;
    this.deductionStreak += 1;
    this.lockSystem.onSafeReveal();
    this.advanceTutorialAfterScan(false);
    this.checkCoreState();
    this.checkStageComplete();
    return true;
  }

  lockCell(cellId: string): boolean {
    const cell = this.cells.get(cellId);
    if (!cell || cell.isCore) return false;
    if (cell.state === "locked" || cell.state === "core") return false;
    if (!this.lockSystem.canLock()) return false;
    if (!this.lockSystem.applyLock()) return false;

    cell.lockedFrom =
      cell.state === "infected"
        ? "infected"
        : cell.state === "revealed"
          ? "revealed"
          : "hidden";
    cell.state = "locked";
    cell.highlight = false;
    cell.clue = null;
    this.events.push({ type: "lock_applied", cellId });

    if (cell.isInfected) {
      this.score += PUZZLE_SCORING.correctLock;
      this.score += this.deductionStreak * PUZZLE_SCORING.deductionStreak;
      this.deductionStreak = 0;
      this.message = "CONTAINMENT SEAL APPLIED";
    } else {
      this.score = Math.max(0, this.score - PUZZLE_SCORING.wrongLockPenalty);
      this.deductionStreak = 0;
    }

    if (this.hint === 2) this.hint = 3;

    refreshClues(this.cells, this.adjacency);
    this.checkCoreState();
    this.checkStageComplete();
    return true;
  }

  unlockCell(cellId: string): boolean {
    const cell = this.cells.get(cellId);
    if (!cell || cell.isCore || cell.state !== "locked") return false;
    if (!this.lockSystem.refundLock()) return false;

    const restore = cell.lockedFrom ?? (cell.isInfected ? "infected" : "hidden");
    if (cell.isInfected || restore === "infected") {
      cell.state = "infected";
      cell.clue = null;
    } else if (restore === "revealed") {
      cell.state = "revealed";
      cell.clue = computeClue(cellId, this.cells, this.adjacency);
      cell.cluePulse = false;
    } else {
      cell.state = "hidden";
      cell.clue = null;
    }
    cell.lockedFrom = undefined;
    cell.highlight = false;

    this.events.push({ type: "lock_removed", cellId });
    this.message = "SEAL REMOVED";

    refreshClues(this.cells, this.adjacency);
    this.checkCoreState();
    this.checkStageComplete();
    return true;
  }

  private advanceTutorialAfterScan(wasInfected: boolean): void {
    if (this.hint >= 3 || wasInfected) return;

    if (this.hint === 0) {
      this.hint = 1;
      this.message = "NUMBERS SHOW NEARBY INFECTION";
      return;
    }

    if (this.hint === 1) {
      this.hint = 2;
      this.message = "SELECT INFECTED ROOM — PRESS LOCK";
      const target = this.findTutorialLockTarget();
      if (target) {
        target.highlight = true;
        this.tutorialLockTarget = target.id;
      }
    }
  }

  private findTutorialLockTarget(): PuzzleCell | undefined {
    if (this.tutorialLockTarget) {
      const existing = this.cells.get(this.tutorialLockTarget);
      if (existing?.isInfected && existing.state !== "locked") return existing;
    }
    return [...this.cells.values()].find(
      (c) => c.isInfected && c.state !== "locked" && !c.isCore,
    );
  }

  private runSpreadEvent(): void {
    const sources = getActiveInfectionSources(this.cells);
    if (sources.length === 0) return;

    const shuffled = this.rng.shuffle([...sources]);
    for (const sourceId of shuffled) {
      const move = pickSpreadTarget(
        sourceId,
        this.cells,
        this.adjacency,
        this.coreId,
        this.rng,
      );
      if (!move) continue;

      const breachedCore = applySpread(move.fromId, move.toId, this.cells);
      this.events.push({ type: "spread", fromId: move.fromId, toId: move.toId });

      const updated = refreshClues(this.cells, this.adjacency);
      for (const id of updated) {
        this.events.push({ type: "clue_update", cellId: id });
      }

      if (breachedCore || isCoreBreached(this.cells, this.coreId)) {
        this.triggerCoreBreach();
        return;
      }
      break;
    }

    this.checkCoreState();
  }

  private checkCoreState(): void {
    if (isCoreBreached(this.cells, this.coreId)) {
      this.triggerCoreBreach();
      return;
    }

    const exposed = checkCoreExposure(this.cells, this.adjacency, this.coreId);
    if (exposed && !this.coreExposed) {
      this.coreExposed = true;
      this.score = Math.max(0, this.score - PUZZLE_SCORING.coreExposurePenalty);
      this.events.push({ type: "core_exposure" });
      this.message = "CORE EXPOSURE";
    }
  }

  private triggerCoreBreach(): void {
    this.phase = "game_over";
    this.events.push({ type: "core_breach" });
    this.message = "CONTAINMENT FAILED";
  }

  private checkStageComplete(): void {
    const allContained = [...this.cells.values()]
      .filter((c) => c.isInfected)
      .every((c) => isInfectionContained(c));

    if (!allContained) return;

    this.score += PUZZLE_SCORING.stageComplete;
    this.events.push({ type: "stage_clear", stage: this.director.stage });
    this.phase = "stage_clear";
    this.stageClearAt = this.elapsedMs;
    this.message = `STAGE ${this.director.stage} CONTAINED`;
  }

  advanceStage(): void {
    if (this.phase !== "stage_clear") return;
    this.director.advance();
    this.phase = "playing";
    this.mode = "scan";
    this.message = "PROTECT THE CORE";
    if (this.hint === 2) this.hint = 3;
    this.tutorialLockTarget = null;
    this.loadStage(this.director.stage, false);
  }

  computeScore(): number {
    return this.score;
  }

  /** Ground-truth infection ids (tests / debug) */
  infectionIds(): string[] {
    return [...this.cells.values()].filter((c) => c.isInfected).map((c) => c.id);
  }

  clearCluePulses(): void {
    for (const c of this.cells.values()) c.cluePulse = false;
  }
}
