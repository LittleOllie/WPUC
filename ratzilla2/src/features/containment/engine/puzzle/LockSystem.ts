import { PUZZLE_LOCKS } from "../../config/puzzleBalance";

export class LockSystem {
  locks: number;
  maxLocks: number;
  revealsPerLock: number;
  safeRevealsTowardLock: number;

  constructor(startLocks: number, maxLocks = PUZZLE_LOCKS.maxStored) {
    this.locks = startLocks;
    this.maxLocks = maxLocks;
    this.revealsPerLock = PUZZLE_LOCKS.revealsPerLock;
    this.safeRevealsTowardLock = 0;
  }

  canLock(): boolean {
    return this.locks > 0;
  }

  applyLock(): boolean {
    if (this.locks <= 0) return false;
    this.locks -= 1;
    return true;
  }

  refundLock(): boolean {
    if (this.locks >= this.maxLocks) return false;
    this.locks += 1;
    return true;
  }

  onSafeReveal(): boolean {
    this.safeRevealsTowardLock += 1;
    if (this.safeRevealsTowardLock >= this.revealsPerLock && this.locks < this.maxLocks) {
      this.locks += 1;
      this.safeRevealsTowardLock = 0;
      return true;
    }
    return false;
  }

  carryToNextStage(current: number, cap: number): number {
    return Math.min(current, cap);
  }
}

export function isInfectionContained(
  cell: { isInfected: boolean; state: string },
): boolean {
  return cell.isInfected && cell.state === "locked";
}

export function isActiveInfection(
  cell: { isInfected: boolean; state: string },
): boolean {
  return cell.isInfected && cell.state !== "locked";
}
