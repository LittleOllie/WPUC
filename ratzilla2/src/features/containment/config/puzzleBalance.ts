/** Minesweeper-style containment puzzle — tunables */

import type { PuzzleStageConfig } from "../types/puzzle";
import type { AxialCoord } from "../types";

export const PUZZLE_SIM = {
  tickMs: 50,
  maxCatchUpTicks: 5,
} as const;

export const PUZZLE_LOCKS = {
  revealsPerLock: 2,
  maxStored: 6,
  stageCarryCap: 3,
} as const;

/** Stages 8+ use this for full zero-region flood */
export const PUZZLE_FULL_BURST = 999;

export const PUZZLE_OUTBREAK = {
  scanPenaltyMs: 3000,
  bonusSpreadOnScan: 0,
} as const;

export const PUZZLE_SCORING = {
  safeReveal: 25,
  correctLock: 150,
  stageComplete: 500,
  spreadTimeBonus: 2,
  deductionStreak: 15,
  infectedScanPenalty: 80,
  wrongLockPenalty: 40,
  coreExposurePenalty: 200,
} as const;

export const PUZZLE_HINTS = {
  tutorialCellId: "0,-2",
  tutorialLockCellId: null as string | null,
} as const;

/** Outer ring bumps (6 cells around a radius-2 core) */
const RING3_FULL: AxialCoord[] = [
  { q: 3, r: 0 },
  { q: 0, r: 3 },
  { q: -3, r: 3 },
  { q: -3, r: 0 },
  { q: 0, r: -3 },
  { q: 3, r: -3 },
];

/** East wing extension */
const RING3_EAST: AxialCoord[] = [
  { q: 3, r: 0 },
  { q: 3, r: -1 },
  { q: 3, r: -2 },
];

/** North / south arms */
const RING3_POLES: AxialCoord[] = [
  { q: 0, r: 3 },
  { q: 0, r: -3 },
  { q: 1, r: 2 },
  { q: -1, r: -2 },
];

/** Trim point cells on a radius-3 disk for a softer silhouette */
const TRIM_R3_TIPS: AxialCoord[] = [
  { q: 3, r: 0 },
  { q: -3, r: 0 },
  { q: 0, r: 3 },
  { q: 0, r: -3 },
  { q: 3, r: -3 },
  { q: -3, r: 3 },
];

/** Flatten one face on radius 3 (east side missing) */
const TRIM_R3_EAST_FACE: AxialCoord[] = [
  { q: 3, r: 0 },
  { q: 3, r: -1 },
  { q: 3, r: -2 },
  { q: 3, r: -3 },
  { q: 2, r: 1 },
];

/** Diagonal trim on compact radius-2 boards */
const TRIM_R2_DIAG: AxialCoord[] = [
  { q: 2, r: -2 },
  { q: -2, r: 2 },
  { q: 2, r: 0 },
];

type StageDef = Omit<PuzzleStageConfig, "stage">;

const STAGE_DEFS: StageDef[] = [
  {
    radius: 2,
    extraRingCoords: [...RING3_FULL],
    omitCoords: [],
    infectionCount: 4,
    spreadIntervalMs: 35_000,
    spreadGraceMs: 55_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 4,
    minInfectionSeparation: 2,
  },
  {
    radius: 2,
    extraRingCoords: [],
    omitCoords: [...TRIM_R2_DIAG],
    infectionCount: 4,
    spreadIntervalMs: 32_000,
    spreadGraceMs: 48_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 4,
    minInfectionSeparation: 2,
  },
  {
    radius: 2,
    extraRingCoords: [...RING3_EAST],
    omitCoords: [],
    infectionCount: 4,
    spreadIntervalMs: 30_000,
    spreadGraceMs: 42_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 5,
    minInfectionSeparation: 2,
  },
  {
    radius: 2,
    extraRingCoords: [...RING3_POLES],
    omitCoords: [{ q: -2, r: 0 }],
    infectionCount: 5,
    spreadIntervalMs: 28_000,
    spreadGraceMs: 36_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 5,
    minInfectionSeparation: 2,
  },
  {
    radius: 3,
    extraRingCoords: [],
    omitCoords: [...TRIM_R3_TIPS],
    infectionCount: 5,
    spreadIntervalMs: 26_000,
    spreadGraceMs: 30_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 5,
    minInfectionSeparation: 2,
  },
  {
    radius: 3,
    extraRingCoords: [],
    omitCoords: [],
    infectionCount: 6,
    spreadIntervalMs: 24_000,
    spreadGraceMs: 24_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 6,
    minInfectionSeparation: 2,
  },
  {
    radius: 3,
    extraRingCoords: [...RING3_POLES],
    omitCoords: [...TRIM_R3_EAST_FACE],
    infectionCount: 6,
    spreadIntervalMs: 22_000,
    spreadGraceMs: 18_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: 8,
    minInfectionSeparation: 2,
  },
  {
    radius: 3,
    extraRingCoords: [...RING3_EAST],
    omitCoords: [{ q: -3, r: 0 }, { q: -3, r: 1 }, { q: -2, r: 2 }],
    infectionCount: 7,
    spreadIntervalMs: 18_000,
    spreadGraceMs: 12_000,
    startLocks: 2,
    carryLockCap: 2,
    revealBurstMax: PUZZLE_FULL_BURST,
    minInfectionSeparation: 2,
  },
];

export const PUZZLE_STAGES = STAGE_DEFS.map((def, i) => ({
  stage: i + 1,
  ...def,
}));

export function getStageConfig(stage: number): PuzzleStageConfig {
  const idx = Math.min(stage - 1, PUZZLE_STAGES.length - 1);
  const cfg = PUZZLE_STAGES[idx]!;
  return {
    ...cfg,
    extraRingCoords: [...cfg.extraRingCoords],
    omitCoords: [...cfg.omitCoords],
  };
}
