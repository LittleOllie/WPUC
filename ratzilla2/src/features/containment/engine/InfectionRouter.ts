import type { SimpleCorridor, SimpleRoom, InfectionFront } from "../types/simplified";

export function isCorridorOpen(c: SimpleCorridor): boolean {
  return c.state === "open";
}

export function getCorridorBetween(
  corridors: Map<string, SimpleCorridor>,
  roomA: string,
  roomB: string,
): SimpleCorridor | undefined {
  for (const c of corridors.values()) {
    if (
      (c.roomA === roomA && c.roomB === roomB) ||
      (c.roomA === roomB && c.roomB === roomA)
    ) {
      return c;
    }
  }
  return undefined;
}

export function getOpenNeighbors(
  roomId: string,
  rooms: Map<string, SimpleRoom>,
  corridors: Map<string, SimpleCorridor>,
): string[] {
  const neighbors: string[] = [];
  for (const c of corridors.values()) {
    if (!isCorridorOpen(c)) continue;
    const other = c.roomA === roomId ? c.roomB : c.roomB === roomId ? c.roomA : null;
    if (other && rooms.has(other)) neighbors.push(other);
  }
  return neighbors;
}

/** BFS shortest path from start to core through open corridors only */
export function findPathToCore(
  startRoomId: string,
  rooms: Map<string, SimpleRoom>,
  corridors: Map<string, SimpleCorridor>,
  coreId = "core",
): string[] | null {
  if (startRoomId === coreId) return [coreId];

  const queue: string[] = [startRoomId];
  const visited = new Set<string>([startRoomId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === coreId) {
      const path: string[] = [coreId];
      let node: string | undefined = coreId;
      while (node && node !== startRoomId) {
        const p = parent.get(node);
        if (p) path.unshift(p);
        node = p;
      }
      return path;
    }

    for (const next of getOpenNeighbors(current, rooms, corridors)) {
      if (visited.has(next)) continue;
      visited.add(next);
      parent.set(next, current);
      queue.push(next);
    }
  }

  return null;
}

export function recalculateFrontPath(
  front: InfectionFront,
  rooms: Map<string, SimpleRoom>,
  corridors: Map<string, SimpleCorridor>,
): InfectionFront {
  const currentRoom =
    front.segmentIndex < front.path.length
      ? front.path[front.segmentIndex]!
      : front.path[front.path.length - 1]!;

  const newPath = findPathToCore(currentRoom, rooms, corridors);
  if (!newPath || newPath.length < 2) {
    return { ...front, path: newPath ?? [currentRoom], segmentIndex: 0, progress: 0 };
  }

  return {
    ...front,
    path: newPath,
    segmentIndex: 0,
    progress: front.progress,
  };
}

export function recalculateAllFronts(
  fronts: InfectionFront[],
  rooms: Map<string, SimpleRoom>,
  corridors: Map<string, SimpleCorridor>,
): InfectionFront[] {
  return fronts.map((f) => recalculateFrontPath(f, rooms, corridors));
}

export function advanceFront(
  front: InfectionFront,
  deltaProgress: number,
): { front: InfectionFront; reachedCore: boolean; enteredRoom: string | null } {
  let { segmentIndex, progress, path } = front;
  let remaining = deltaProgress;
  let reachedCore = false;
  let enteredRoom: string | null = null;

  while (remaining > 0 && segmentIndex < path.length - 1) {
    const needed = 1 - progress;
    if (remaining < needed) {
      progress += remaining;
      remaining = 0;
      break;
    }

    remaining -= needed;
    progress = 0;
    segmentIndex += 1;
    enteredRoom = path[segmentIndex] ?? null;

    if (enteredRoom === "core") {
      reachedCore = true;
      break;
    }
  }

  return {
    front: { ...front, path, segmentIndex, progress },
    reachedCore,
    enteredRoom,
  };
}

export function getFrontPosition(
  front: InfectionFront,
  rooms: Map<string, SimpleRoom>,
): { from: { x: number; y: number }; to: { x: number; y: number }; t: number } | null {
  if (front.segmentIndex >= front.path.length - 1) return null;
  const fromRoom = rooms.get(front.path[front.segmentIndex]!);
  const toRoom = rooms.get(front.path[front.segmentIndex + 1]!);
  if (!fromRoom || !toRoom) return null;
  return {
    from: fromRoom.displayPos,
    to: toRoom.displayPos,
    t: front.progress,
  };
}
