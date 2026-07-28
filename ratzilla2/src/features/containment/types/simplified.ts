/** Types for simplified arcade containment mode */

import type { AxialCoord, Vec2 } from "./index";

export type SimplePhase = "playing" | "paused" | "game_over";

export type SimpleDoorState = "open" | "closed";

export type SimpleRoomState = "clean" | "infected" | "source";

export interface SimpleRoom {
  id: string;
  coord: AxialCoord;
  displayPos: Vec2;
  state: SimpleRoomState;
  isCore: boolean;
}

export interface SimpleCorridor {
  id: string;
  roomA: string;
  roomB: string;
  state: SimpleDoorState;
  closedAt: number;
}

export interface InfectionFront {
  id: number;
  path: string[];
  segmentIndex: number;
  progress: number;
  sourceId: string;
}

export type DifficultyPhase = 1 | 2 | 3 | 4 | 5;

export type SimpleHint = 0 | 1 | 2 | 3;

export interface SimpleSnapshot {
  tick: number;
  elapsedMs: number;
  phase: SimplePhase;
  seed: number;
  seedLabel: string;
  rooms: SimpleRoom[];
  corridors: SimpleCorridor[];
  fronts: InfectionFront[];
  closedDoorIds: string[];
  maxClosedDoors: number;
  purgeCharge: number;
  purgeReady: boolean;
  coreBreached: boolean;
  hint: SimpleHint;
  message: string | null;
  messageUntil: number;
  difficultyPhase: DifficultyPhase;
  activeSources: string[];
  redirects: number;
  nearCoreSaves: number;
  oldestReleasedId: string | null;
  highlightCorridorId: string | null;
  doorFailureCorridorId: string | null;
  doorFailureCountdown: number;
}

export type SimpleEvent =
  | { type: "door_closed"; corridorId: string }
  | { type: "door_opened"; corridorId: string }
  | { type: "oldest_released"; corridorId: string }
  | { type: "purge" }
  | { type: "core_breach" }
  | { type: "new_source"; roomId: string }
  | { type: "surge" };
