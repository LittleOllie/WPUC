import type { AxialCoord, Vec2 } from "../types";

export type PuzzlePhase = "playing" | "paused" | "stage_clear" | "game_over";

export type PuzzleCellState =
  | "hidden"
  | "revealed"
  | "infected"
  | "locked"
  | "core";

export type PuzzleMode = "scan" | "lock" | "unlock";

export type PuzzleHint = 0 | 1 | 2 | 3;

export interface PuzzleCell {
  id: string;
  coord: AxialCoord;
  displayPos: Vec2;
  isCore: boolean;
  /** Ground truth — hidden until scan/spread/stage end */
  isInfected: boolean;
  state: PuzzleCellState;
  clue: number | null;
  cluePulse: boolean;
  highlight: boolean;
  /** State before locking — used when unlocking */
  lockedFrom?: Exclude<PuzzleCellState, "locked" | "core">;
}

export interface PuzzleStageConfig {
  stage: number;
  radius: number;
  /** Cells added outside the base hex disk */
  extraRingCoords: AxialCoord[];
  /** Cells removed from the base shape (creates varied layouts) */
  omitCoords: AxialCoord[];
  infectionCount: number;
  spreadIntervalMs: number;
  /** Extra time before the first spread on stage start */
  spreadGraceMs: number;
  startLocks: number;
  carryLockCap: number;
  /** Max safe cells one scan can reveal (zero-region ripple cap) */
  revealBurstMax: number;
  /** Min axial distance between infection placements */
  minInfectionSeparation: number;
}

export interface PuzzleSnapshot {
  tick: number;
  elapsedMs: number;
  phase: PuzzlePhase;
  seed: number;
  seedLabel: string;
  stage: number;
  score: number;
  cells: PuzzleCell[];
  locks: number;
  maxLocks: number;
  safeRevealsTowardLock: number;
  revealsPerLock: number;
  spreadCountdownMs: number;
  spreadIntervalMs: number;
  coreExposed: boolean;
  message: string | null;
  hint: PuzzleHint;
  mode: PuzzleMode;
  containedCount: number;
  infectionCount: number;
  stageClearAt: number;
}

export type PuzzleEvent =
  | { type: "safe_reveal"; cellId: string }
  | { type: "infected_reveal"; cellId: string }
  | { type: "lock_applied"; cellId: string }
  | { type: "lock_removed"; cellId: string }
  | { type: "spread"; fromId: string; toId: string }
  | { type: "clue_update"; cellId: string }
  | { type: "core_exposure" }
  | { type: "core_breach" }
  | { type: "stage_clear"; stage: number }
  | { type: "outbreak" };
