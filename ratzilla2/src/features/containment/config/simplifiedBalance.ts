/** Simplified arcade mode — all tunables */

export const SIMPLE_SIM = {
  tickMs: 50,
  maxCatchUpTicks: 5,
} as const;

export const SIMPLE_DOORS = {
  maxClosed: 3,
  /** Phase 4+ may temporarily drop to 2 */
  reducedMaxClosed: 2,
} as const;

export const SIMPLE_INFECTION = {
  /** Corridor progress per second — multiplied by phase */
  baseSpeed: 0.12,
  phaseSpeedMult: [1, 1.15, 1.35, 1.55, 1.85] as const,
  surgeSpeedMult: 2.2,
  surgeDurationMs: 4000,
} as const;

export const SIMPLE_PHASES = {
  phase2AtMs: 20_000,
  phase3AtMs: 45_000,
  phase4AtMs: 75_000,
  phase5AtMs: 120_000,
  firstSourceDelayMs: 5_000,
  secondSourceDelayMs: 20_000,
  thirdSourceDelayMs: 75_000,
} as const;

export const SIMPLE_PURGE = {
  chargeRatePerSecond: 0.045,
  maxCharge: 1,
  /** Clear core + rooms within this graph distance */
  clearRadius: 2,
} as const;

export const SIMPLE_HINTS = {
  hint0Corridor: "c-n-n2",
  firstCloseDelayMs: 0,
} as const;

export const SIMPLE_SCORING = {
  redirectBonus: 5,
  nearCoreSaveBonus: 25,
} as const;
