import { SIM } from "../config/balance";

export class SimulationClock {
  private accumulator = 0;
  private lastTimestamp: number | null = null;
  readonly tickMs: number;

  constructor(tickMs = SIM.tickMs) {
    this.tickMs = tickMs;
  }

  reset(): void {
    this.accumulator = 0;
    this.lastTimestamp = null;
  }

  /** Returns number of fixed ticks to process (0 if paused). */
  advance(now: number, paused: boolean): number {
    if (paused) {
      this.lastTimestamp = now;
      return 0;
    }

    if (this.lastTimestamp === null) {
      this.lastTimestamp = now;
      return 0;
    }

    const delta = now - this.lastTimestamp;
    this.lastTimestamp = now;
    this.accumulator += delta;

    let ticks = 0;
    while (this.accumulator >= this.tickMs && ticks < SIM.maxCatchUpTicks) {
      this.accumulator -= this.tickMs;
      ticks += 1;
    }
    return ticks;
  }

  get interpolationAlpha(): number {
    return Math.min(1, this.accumulator / this.tickMs);
  }
}
