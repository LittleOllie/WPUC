import type { PuzzleCell } from "../../types/puzzle";

export function countAdjacentInfections(
  cellId: string,
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
): number {
  const neighbors = adjacency.get(cellId) ?? [];
  return neighbors.filter((nid) => cells.get(nid)?.isInfected).length;
}

export function computeClue(
  cellId: string,
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
): number {
  return countAdjacentInfections(cellId, cells, adjacency);
}

export function refreshClues(
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
  pulse = true,
): string[] {
  const updated: string[] = [];
  for (const cell of cells.values()) {
    if (cell.state !== "revealed") continue;
    const next = computeClue(cell.id, cells, adjacency);
    if (cell.clue !== next) {
      cell.clue = next;
      cell.cluePulse = pulse;
      updated.push(cell.id);
    }
  }
  return updated;
}

/**
 * Reveal safe cells from a scan. Zero-clue cells ripple into neighbors,
 * capped at revealBurstMax so one tap opens a small pocket — not the whole board.
 */
export function revealSafeCell(
  cellId: string,
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
  revealBurstMax = 1,
): string[] {
  const burstCap = Math.max(1, revealBurstMax);
  const revealed: string[] = [];
  const queue = [cellId];
  const visited = new Set<string>();

  while (queue.length > 0 && revealed.length < burstCap) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const cell = cells.get(id);
    if (!cell || cell.isCore || cell.state === "locked") continue;
    if (cell.isInfected) continue;
    if (cell.state === "revealed") continue;

    cell.state = "revealed";
    cell.clue = computeClue(id, cells, adjacency);
    cell.cluePulse = false;
    revealed.push(id);

    if (cell.clue !== 0 || revealed.length >= burstCap) continue;

    for (const nid of adjacency.get(id) ?? []) {
      if (revealed.length + queue.length >= burstCap) break;
      const neighbor = cells.get(nid);
      if (!neighbor || neighbor.isCore) continue;
      if (neighbor.state !== "hidden" || neighbor.isInfected) continue;
      if (!visited.has(nid)) queue.push(nid);
    }
  }

  return revealed;
}

export function markInfectedVisible(cell: PuzzleCell): void {
  cell.state = "infected";
  cell.clue = null;
}

/** When infection is scanned, adjacent already-revealed rooms are contaminated. */
export function contaminateAdjacentRevealed(
  sourceId: string,
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
): string[] {
  const contaminated: string[] = [];
  for (const nid of adjacency.get(sourceId) ?? []) {
    const neighbor = cells.get(nid);
    if (!neighbor || neighbor.isCore) continue;
    if (neighbor.state !== "revealed") continue;
    if (neighbor.isInfected) continue;
    neighbor.isInfected = true;
    markInfectedVisible(neighbor);
    contaminated.push(nid);
  }
  return contaminated;
}
