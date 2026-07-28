import { ALPHA_LAYOUT } from "../data/alphaLayout";
import { DOORS, ROOM_LABELS } from "../config/balance";
import type {
  CorridorRuntime,
  LayoutDefinition,
  RoomDefinition,
  RoomRuntime,
} from "../types";
import { axialToPixel, corridorOrientation } from "../utils/hexCoords";

export class LaboratoryGraph {
  readonly layout: LayoutDefinition;
  readonly rooms: Map<string, RoomRuntime>;
  readonly corridors: Map<string, CorridorRuntime>;

  constructor(layout: LayoutDefinition = ALPHA_LAYOUT) {
    this.layout = layout;
    this.rooms = new Map();
    this.corridors = new Map();
    this.buildFromLayout();
  }

  private buildFromLayout(): void {
    const corridorByRoom = new Map<string, string[]>();

    for (const def of this.layout.rooms) {
      const displayPos = axialToPixel(def.coord);
      const room: RoomRuntime = {
        id: def.id,
        type: def.type,
        coord: { ...def.coord },
        displayPos,
        state: "stable",
        infectionAmount: 0,
        infectionStage: "none",
        operationalHealth: 100,
        powered: true,
        visibleToScanner: true,
        temporaryProtectionUntil: 0,
        chainDensity: 0,
        connectedCorridorIds: [],
        label: def.label ?? ROOM_LABELS[def.type] ?? def.id.toUpperCase(),
      };
      this.rooms.set(def.id, room);
      corridorByRoom.set(def.id, []);
    }

    for (const def of this.layout.corridors) {
      const roomA = this.rooms.get(def.roomA);
      const roomB = this.rooms.get(def.roomB);
      if (!roomA || !roomB) continue;

      const orientation = corridorOrientation(roomA.displayPos, roomB.displayPos);
      const maxIntegrity =
        DOORS.baseMaxIntegrity + (def.id.includes("core") ? 10 : 0);

      const corridor: CorridorRuntime = {
        id: def.id,
        roomA: def.roomA,
        roomB: def.roomB,
        state: "open",
        integrity: maxIntegrity,
        maxIntegrity,
        pressure: 0,
        reinforcementLevel: 0,
        lockUntil: 0,
        breached: false,
        orientation,
      };
      this.corridors.set(def.id, corridor);
      corridorByRoom.get(def.roomA)!.push(def.id);
      corridorByRoom.get(def.roomB)!.push(def.id);
    }

    for (const [roomId, cIds] of corridorByRoom) {
      const room = this.rooms.get(roomId);
      if (room) room.connectedCorridorIds = cIds;
    }
  }

  getRoom(id: string): RoomRuntime | undefined {
    return this.rooms.get(id);
  }

  getCorridor(id: string): CorridorRuntime | undefined {
    return this.corridors.get(id);
  }

  getCorridorBetween(roomA: string, roomB: string): CorridorRuntime | undefined {
    for (const c of this.corridors.values()) {
      if (
        (c.roomA === roomA && c.roomB === roomB) ||
        (c.roomA === roomB && c.roomB === roomA)
      ) {
        return c;
      }
    }
    return undefined;
  }

  getNeighborRooms(roomId: string): RoomRuntime[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const neighbors: RoomRuntime[] = [];
    for (const cId of room.connectedCorridorIds) {
      const c = this.corridors.get(cId);
      if (!c || c.state === "destroyed") continue;
      const otherId = c.roomA === roomId ? c.roomB : c.roomA;
      const other = this.rooms.get(otherId);
      if (other && other.state !== "purged" && other.state !== "lost") {
        neighbors.push(other);
      }
    }
    return neighbors;
  }

  getOpenCorridorsFrom(roomId: string): CorridorRuntime[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.connectedCorridorIds
      .map((id) => this.corridors.get(id))
      .filter((c): c is CorridorRuntime => {
        if (!c || c.state === "destroyed") return false;
        return c.state === "open" || c.state === "breached";
      });
  }

  isRoomOperational(type: RoomRuntime["type"]): boolean {
    const room = [...this.rooms.values()].find((r) => r.type === type);
    if (!room) return false;
    return (
      room.state !== "lost" &&
      room.state !== "purged" &&
      room.infectionStage !== "collapse" &&
      room.operationalHealth > 0
    );
  }

  cloneRooms(): RoomRuntime[] {
    return [...this.rooms.values()].map((r) => ({
      ...r,
      coord: { ...r.coord },
      displayPos: { ...r.displayPos },
      connectedCorridorIds: [...r.connectedCorridorIds],
    }));
  }

  cloneCorridors(): CorridorRuntime[] {
    return [...this.corridors.values()].map((c) => ({ ...c }));
  }
}

export function getRoomDefinition(
  layout: LayoutDefinition,
  id: string,
): RoomDefinition | undefined {
  return layout.rooms.find((r) => r.id === id);
}
