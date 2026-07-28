import { SIMPLE_PHASES, SIMPLE_INFECTION, SIMPLE_DOORS } from "../config/simplifiedBalance";
import type { DifficultyPhase } from "../types/simplified";

export interface DirectorState {
  phase: DifficultyPhase;
  activeSources: string[];
  maxClosedDoors: number;
  surgeUntil: number;
  doorFailureCorridorId: string | null;
  doorFailureAt: number;
}

export function createDirectorState(): DirectorState {
  return {
    phase: 1,
    activeSources: [],
    maxClosedDoors: SIMPLE_DOORS.maxClosed,
    surgeUntil: 0,
    doorFailureCorridorId: null,
    doorFailureAt: 0,
  };
}

export function updateDirector(
  state: DirectorState,
  elapsedMs: number,
  allSources: readonly string[],
  rng: { next: () => number },
): DirectorState {
  const next = { ...state };

  if (elapsedMs >= SIMPLE_PHASES.phase5AtMs) next.phase = 5;
  else if (elapsedMs >= SIMPLE_PHASES.phase4AtMs) next.phase = 4;
  else if (elapsedMs >= SIMPLE_PHASES.phase3AtMs) next.phase = 3;
  else if (elapsedMs >= SIMPLE_PHASES.phase2AtMs) next.phase = 2;
  else next.phase = 1;

  const sources: string[] = [];
  if (elapsedMs >= SIMPLE_PHASES.firstSourceDelayMs) sources.push(allSources[0]!);
  if (elapsedMs >= SIMPLE_PHASES.secondSourceDelayMs && allSources[1]) {
    sources.push(allSources[1]);
  }
  if (elapsedMs >= SIMPLE_PHASES.thirdSourceDelayMs && allSources[2]) {
    sources.push(allSources[2]);
  }
  next.activeSources = sources;

  next.maxClosedDoors = SIMPLE_DOORS.maxClosed;

  if (next.surgeUntil > 0 && elapsedMs > next.surgeUntil) {
    next.surgeUntil = 0;
  }

  if (next.phase >= 3 && next.surgeUntil === 0 && rng.next() < 0.0015) {
    next.surgeUntil = elapsedMs + SIMPLE_INFECTION.surgeDurationMs;
  }

  return next;
}

export function getInfectionSpeed(director: DirectorState, elapsedMs: number): number {
  let speed = SIMPLE_INFECTION.baseSpeed * SIMPLE_INFECTION.phaseSpeedMult[director.phase - 1];
  if (director.surgeUntil > elapsedMs) {
    speed *= SIMPLE_INFECTION.surgeSpeedMult;
  }
  return speed;
}
