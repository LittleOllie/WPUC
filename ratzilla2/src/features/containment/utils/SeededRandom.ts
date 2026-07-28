/** Deterministic seeded PRNG — never use Math.random in simulation */

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    // Mulberry32
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("SeededRandom.pick: empty array");
    }
    return items[this.int(0, items.length - 1)]!;
  }

  shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }

  fork(salt: number): SeededRandom {
    const mixed = (this.state ^ (salt * 2654435761)) >>> 0;
    return new SeededRandom(mixed || 1);
  }
}

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function formatIncidentLabel(seed: number): string {
  const partA = (seed % 9000) + 1000;
  const partB = ((seed >>> 8) % 26) + 10;
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const suffix = letters[seed % letters.length]!;
  const suffix2 = letters[(seed >>> 4) % letters.length]!;
  return `Z26-${partA}-${partB}${suffix}${suffix2}`;
}
