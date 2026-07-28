import type { LayoutDefinition, MutationId, RoomType } from "../types";
import { ALPHA_LAYOUT } from "../data/alphaLayout";
import { axialDistance } from "../utils/hexCoords";

const REQUIRED_ROOM_TYPES: RoomType[] = [
  "containment_core",
  "power_generator",
  "serum_synthesis",
  "scanner_array",
  "security_control",
  "maintenance",
  "ventilation",
];

export interface LayoutValidationResult {
  valid: boolean;
  errors: string[];
}

function buildAdjacency(layout: LayoutDefinition): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const room of layout.rooms) {
    adj.set(room.id, new Set());
  }
  for (const corridor of layout.corridors) {
    if (!adj.has(corridor.roomA) || !adj.has(corridor.roomB)) {
      continue;
    }
    adj.get(corridor.roomA)!.add(corridor.roomB);
    adj.get(corridor.roomB)!.add(corridor.roomA);
  }
  return adj;
}

function countRoutesToCore(
  layout: LayoutDefinition,
  startRoomId: string,
): number {
  const adj = buildAdjacency(layout);
  const core = layout.rooms.find((r) => r.type === "containment_core");
  if (!core) return 0;

  const visited = new Set<string>();
  const queue = [startRoomId];
  let routes = 0;

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === core.id) {
      routes += 1;
      continue;
    }
    for (const n of adj.get(id) ?? []) {
      if (!visited.has(n)) queue.push(n);
    }
  }
  return routes > 0 ? 1 : 0;
}

export function validateLayout(
  layout: LayoutDefinition,
  infectionStartRoomId?: string,
): LayoutValidationResult {
  const errors: string[] = [];
  const roomIds = new Set<string>();
  const corridorIds = new Set<string>();

  for (const room of layout.rooms) {
    if (roomIds.has(room.id)) {
      errors.push(`Duplicate room id: ${room.id}`);
    }
    roomIds.add(room.id);
  }

  for (const type of REQUIRED_ROOM_TYPES) {
    const count = layout.rooms.filter((r) => r.type === type).length;
    if (count !== 1) {
      errors.push(`Expected exactly one ${type}, found ${count}`);
    }
  }

  if (layout.rooms.length < 19 || layout.rooms.length > 31) {
    errors.push(`Room count ${layout.rooms.length} outside 19–31 range`);
  }

  for (const corridor of layout.corridors) {
    if (corridorIds.has(corridor.id)) {
      errors.push(`Duplicate corridor id: ${corridor.id}`);
    }
    corridorIds.add(corridor.id);
    if (!roomIds.has(corridor.roomA)) {
      errors.push(`Corridor ${corridor.id} references unknown room ${corridor.roomA}`);
    }
    if (!roomIds.has(corridor.roomB)) {
      errors.push(`Corridor ${corridor.id} references unknown room ${corridor.roomB}`);
    }
    if (corridor.roomA === corridor.roomB) {
      errors.push(`Corridor ${corridor.id} connects room to itself`);
    }
  }

  const adj = buildAdjacency(layout);
  const core = layout.rooms.find((r) => r.type === "containment_core");
  if (core) {
    const coreNeighbors = adj.get(core.id)?.size ?? 0;
    if (coreNeighbors < 2) {
      errors.push("Core must have at least two connections");
    }

    const visited = new Set<string>();
    const stack = [core.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const n of adj.get(id) ?? []) {
        if (!visited.has(n)) stack.push(n);
      }
    }
    if (visited.size !== layout.rooms.length) {
      errors.push("Not all rooms are connected to the graph");
    }

    let approachRoutes = 0;
    for (const n of adj.get(core.id) ?? []) {
      approachRoutes += countRoutesToCore(layout, n);
    }
    if (approachRoutes < 2) {
      errors.push("Core must have multiple approach routes");
    }
  }

  const startId =
    infectionStartRoomId ??
    layout.infectionStartCandidates?.[0] ??
    layout.rooms.find((r) => r.type === "standard_lab")?.id;

  if (startId && core) {
    const startRoom = layout.rooms.find((r) => r.id === startId);
    if (startRoom) {
      const dist = axialDistance(startRoom.coord, core.coord);
      if (dist < 3) {
        errors.push(
          `Infection start ${startId} too close to core (distance ${dist})`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertLayoutValid(layout: LayoutDefinition = ALPHA_LAYOUT): void {
  const result = validateLayout(layout);
  if (!result.valid) {
    throw new Error(`Invalid layout: ${result.errors.join("; ")}`);
  }
}

export const ALL_MUTATIONS: MutationId[] = [
  "corrosive_response",
  "dormant_carriers",
  "airborne",
];
