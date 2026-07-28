import type { PuzzleCell } from "../../types/puzzle";
import { graphDistanceToCore } from "./HexPuzzleBoard";
import { isActiveInfection } from "./LockSystem";
import { markInfectedVisible } from "./ClueSystem";

export type SpreadMove = { fromId: string; toId: string };

export function pickSpreadTarget(
  sourceId: string,
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
  coreId: string,
  rng: { next: () => number },
): SpreadMove | null {
  const source = cells.get(sourceId);
  if (!source || !isActiveInfection(source)) return null;

  const neighbors = adjacency.get(sourceId) ?? [];
  const candidates = neighbors
    .map((id) => cells.get(id))
    .filter((c): c is PuzzleCell => {
      if (!c) return false;
      if (c.isCore) return true;
      if (c.state === "locked") return false;
      if (c.isInfected && c.state === "infected") return false;
      return c.state === "hidden" || c.state === "revealed";
    });

  if (candidates.length === 0) return null;

  let bestScore = -Infinity;
  let best: PuzzleCell[] = [];

  for (const target of candidates) {
    const dist = graphDistanceToCore(target.id, coreId, adjacency);
    let score = 100 - dist * 10;
    if (target.isCore) score = 1000;
    if (target.state === "revealed") score += 5;
    if (target.state === "hidden") score += 2;
    score += rng.next() * 0.5;

    if (score > bestScore) {
      bestScore = score;
      best = [target];
    } else if (score === bestScore) {
      best.push(target);
    }
  }

  const chosen = best[Math.floor(rng.next() * best.length)]!;
  return { fromId: sourceId, toId: chosen.id };
}

export function applySpread(
  _fromId: string,
  toId: string,
  cells: Map<string, PuzzleCell>,
): boolean {
  const target = cells.get(toId);
  if (!target) return false;
  if (target.state === "locked") return false;

  if (target.isCore) {
    target.isInfected = true;
    return true;
  }

  target.isInfected = true;
  markInfectedVisible(target);
  return true;
}

export function getActiveInfectionSources(cells: Map<string, PuzzleCell>): string[] {
  return [...cells.values()]
    .filter((c) => isActiveInfection(c))
    .map((c) => c.id);
}

export function checkCoreExposure(
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
  coreId: string,
): boolean {
  const neighbors = adjacency.get(coreId) ?? [];
  return neighbors.some((nid) => {
    const n = cells.get(nid);
    return n && n.isInfected && n.state !== "locked";
  });
}

export function isCoreBreached(cells: Map<string, PuzzleCell>, coreId: string): boolean {
  const core = cells.get(coreId);
  return !!core?.isInfected;
}