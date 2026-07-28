import type { AxialCoord } from "../../types";
import { axialDistance, axialToPixel } from "../../utils/hexCoords";
import type { PuzzleCell } from "../../types/puzzle";
import { SeededRandom } from "../../utils/SeededRandom";
import { getStageConfig } from "../../config/puzzleBalance";

export function cellId(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

export function parseCellId(id: string): AxialCoord {
  const [q, r] = id.split(",").map(Number);
  return { q: q!, r: r! };
}

export function hexDisk(radius: number): AxialCoord[] {
  const cells: AxialCoord[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      cells.push({ q, r });
    }
  }
  return cells;
}

export function boardCoordsForStage(stage: number): AxialCoord[] {
  const cfg = getStageConfig(stage);
  const omitKeys = new Set(cfg.omitCoords.map(cellId));
  const base = hexDisk(cfg.radius).filter((coord) => !omitKeys.has(cellId(coord)));
  const keys = new Set(base.map(cellId));
  for (const extra of cfg.extraRingCoords) {
    const id = cellId(extra);
    if (omitKeys.has(id)) continue;
    if (!keys.has(id)) {
      keys.add(id);
      base.push({ ...extra });
    }
  }
  return base;
}

export function buildAdjacency(cells: Map<string, PuzzleCell>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const keys = new Set(cells.keys());

  for (const cell of cells.values()) {
    const neighbors: string[] = [];
    for (let dir = 0; dir < 6; dir += 1) {
      const d = AXIAL_NEIGHBOR_DELTA[dir]!;
      const nid = cellId({ q: cell.coord.q + d.q, r: cell.coord.r + d.r });
      if (keys.has(nid)) neighbors.push(nid);
    }
    adj.set(cell.id, neighbors);
  }
  return adj;
}

const AXIAL_NEIGHBOR_DELTA: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export interface GeneratedBoard {
  cells: Map<string, PuzzleCell>;
  adjacency: Map<string, string[]>;
  coreId: string;
  infectionIds: string[];
}

export function generateBoard(stage: number, rng: SeededRandom): GeneratedBoard {
  const cfg = getStageConfig(stage);
  const coords = boardCoordsForStage(stage);
  const coreCoord = { q: 0, r: 0 };
  const coreId = cellId(coreCoord);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const attemptRng = attempt === 0 ? rng : rng.fork(attempt + stage * 17);

    const cells = new Map<string, PuzzleCell>();
    for (const coord of coords) {
      const id = cellId(coord);
      const isCore = id === coreId;
      cells.set(id, {
        id,
        coord: { ...coord },
        displayPos: axialToPixel(coord),
        isCore,
        isInfected: false,
        state: isCore ? "core" : "hidden",
        clue: null,
        cluePulse: false,
        highlight: false,
      });
    }

    const candidates = [...cells.values()]
      .filter((c) => !c.isCore && axialDistance(c.coord, coreCoord) >= 2)
      .map((c) => c.id);

    if (candidates.length < cfg.infectionCount) continue;

    const shuffled = attemptRng.shuffle([...candidates]);
    const infectionIds: string[] = [];
    const minSep = cfg.minInfectionSeparation ?? 2;

    for (const id of shuffled) {
      if (infectionIds.length >= cfg.infectionCount) break;
      const coord = cells.get(id)!.coord;
      const tooClose = infectionIds.some((existingId) => {
        const existing = cells.get(existingId)!;
        return axialDistance(coord, existing.coord) < minSep;
      });
      if (tooClose) continue;
      infectionIds.push(id);
    }

    if (infectionIds.length < cfg.infectionCount) continue;

    for (const id of infectionIds) {
      cells.get(id)!.isInfected = true;
    }

    const adjacency = buildAdjacency(cells);
    if (!validateBoard(cells, adjacency, coreId, cfg.infectionCount, minSep)) continue;

    return { cells, adjacency, coreId, infectionIds };
  }

  throw new Error(`Failed to generate valid board for stage ${stage}`);
}

export function validateBoard(
  cells: Map<string, PuzzleCell>,
  adjacency: Map<string, string[]>,
  coreId: string,
  infectionCount: number,
  minInfectionSeparation = 2,
): boolean {
  const core = cells.get(coreId);
  if (!core) return false;

  const infected = [...cells.values()].filter((c) => c.isInfected);
  if (infected.length !== infectionCount) return false;

  for (const cell of infected) {
    if (axialDistance(cell.coord, core.coord) < 2) return false;
    const neighbors = adjacency.get(cell.id) ?? [];
    if (neighbors.includes(coreId)) return false;
  }

  for (let i = 0; i < infected.length; i += 1) {
    for (let j = i + 1; j < infected.length; j += 1) {
      if (axialDistance(infected[i]!.coord, infected[j]!.coord) < minInfectionSeparation) {
        return false;
      }
    }
  }

  const safeCandidates = [...cells.values()].filter(
    (c) => !c.isCore && !c.isInfected,
  );
  if (safeCandidates.length === 0) return false;

  const hasZeroNeighborSafe = safeCandidates.some((c) => {
    const neighbors = adjacency.get(c.id) ?? [];
    return neighbors.every((nid) => !cells.get(nid)?.isInfected);
  });
  if (!hasZeroNeighborSafe) return false;

  const playable = cells.size - 1;
  const maxLocksReasonable = 2 + Math.floor(playable / 3);
  if (infectionCount > maxLocksReasonable + 2) return false;

  return true;
}

export function graphDistanceToCore(
  fromId: string,
  coreId: string,
  adjacency: Map<string, string[]>,
): number {
  if (fromId === coreId) return 0;
  const queue: { id: string; d: number }[] = [{ id: fromId, d: 0 }];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    for (const next of adjacency.get(id) ?? []) {
      if (visited.has(next)) continue;
      if (next === coreId) return d + 1;
      visited.add(next);
      queue.push({ id: next, d: d + 1 });
    }
  }
  return 999;
}
