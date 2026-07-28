import type { SimulationSnapshot } from "../types";
import { corridorDisplayId, ROOM_TYPE_NAMES } from "../config/balance";

export interface GuidanceMessage {
  text: string;
  priority: number;
}

export function getContextualGuidance(
  snapshot: SimulationSnapshot,
  now: number,
  tutorialActive: boolean,
  tutorialHighlightSeal: boolean,
  tutorialHighlightSerum: boolean,
): GuidanceMessage {
  if (snapshot.phase !== "playing") {
    return { text: "PROTECT THE CORE", priority: 99 };
  }

  if (now < snapshot.lockdownUntil) {
    const remaining = ((snapshot.lockdownUntil - now) / 1000).toFixed(1);
    return { text: `LOCKDOWN ACTIVE: ${remaining}s`, priority: 10 };
  }

  if (snapshot.coreIntegrity <= 25) {
    return { text: "CORE CRITICAL — CONTAIN INFECTION NOW", priority: 1 };
  }

  if (snapshot.coreIntegrity <= 50) {
    const coreNeighbors = snapshot.rooms.filter(
      (r) =>
        r.id !== "core" &&
        (r.state === "infected" || r.state === "critical") &&
        snapshot.corridors.some(
          (c) =>
            (c.roomA === "core" || c.roomB === "core") &&
            (c.roomA === r.id || c.roomB === r.id) &&
            (c.state === "open" || c.state === "breached"),
        ),
    );
    if (coreNeighbors.length > 0) {
      return { text: "INFECTION APPROACHING CONTAINMENT CORE", priority: 2 };
    }
  }

  const criticalDoor = snapshot.corridors
    .filter((c) => c.state === "sealed")
    .sort((a, b) => a.integrity - b.integrity)[0];

  if (criticalDoor && criticalDoor.integrity <= 30) {
    return {
      text: `BULKHEAD ${corridorDisplayId(criticalDoor.id)} AT ${Math.round(criticalDoor.integrity)}% — REINFORCE`,
      priority: 3,
    };
  }

  if (criticalDoor && criticalDoor.integrity <= 55 && criticalDoor.pressure > 20) {
    return {
      text: `PRESSURE BUILDING ON ${corridorDisplayId(criticalDoor.id)}`,
      priority: 4,
    };
  }

  for (const type of ["power_generator", "serum_synthesis", "scanner_array"] as const) {
    const room = snapshot.rooms.find((r) => r.type === type);
    if (room && (room.state === "infected" || room.state === "critical")) {
      return {
        text: `INFECTION THREATENING ${ROOM_TYPE_NAMES[type]?.toUpperCase() ?? type}`,
        priority: 5,
      };
    }
  }

  if (tutorialActive && tutorialHighlightSeal) {
    return { text: "PRESS SEAL / OPEN TO BLOCK SPREAD", priority: 6 };
  }

  if (tutorialActive && tutorialHighlightSerum) {
    return { text: "SELECT INFECTED ROOM → DEPLOY SERUM", priority: 6 };
  }

  if (snapshot.selectedCorridorId) {
    const c = snapshot.corridors.find((x) => x.id === snapshot.selectedCorridorId);
    if (c?.state === "sealed") {
      return { text: "SEALED — TAP REINFORCE OR REOPEN", priority: 7 };
    }
    if (c?.state === "open" || c?.state === "breached") {
      return { text: "OPEN — TAP SEAL / OPEN TO BLOCK SPREAD", priority: 7 };
    }
  }

  if (snapshot.selectedRoomId) {
    const room = snapshot.rooms.find((r) => r.id === snapshot.selectedRoomId);
    if (room && (room.state === "infected" || room.state === "critical" || room.state === "incubating")) {
      return { text: "INFECTED ROOM — DEPLOY SERUM", priority: 7 };
    }
  }

  const exposed = snapshot.rooms.filter((r) => r.state === "exposed" || r.state === "incubating");
  if (exposed.length > 0) {
    return { text: "ANOMALY DETECTED — SEAL CORRIDORS OR DEPLOY SERUM", priority: 8 };
  }

  return { text: "PROTECT THE CONTAINMENT CORE", priority: 99 };
}
