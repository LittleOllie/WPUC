import { SIMPLE_LAYOUT, SIMPLE_SOURCES } from "../data/simpleLayout";
import {
  SIMPLE_SIM,
  SIMPLE_PURGE,
  SIMPLE_HINTS,
  SIMPLE_SCORING,
} from "../config/simplifiedBalance";
import type {
  SimpleCorridor,
  SimpleRoom,
  InfectionFront,
  SimpleSnapshot,
  SimplePhase,
  SimpleHint,
  SimpleEvent,
} from "../types/simplified";
import { axialToPixel } from "../utils/hexCoords";
import { SeededRandom, formatIncidentLabel } from "../utils/SeededRandom";
import { SimulationClock } from "./SimulationClock";
import {
  advanceFront,
  findPathToCore,
  recalculateAllFronts,
} from "./InfectionRouter";
import {
  createDirectorState,
  updateDirector,
  getInfectionSpeed,
  type DirectorState,
} from "./DifficultyDirector";

export class SimplifiedSimulation {
  private rng: SeededRandom;
  private clock = new SimulationClock(SIMPLE_SIM.tickMs);
  private rooms = new Map<string, SimpleRoom>();
  private corridors = new Map<string, SimpleCorridor>();
  private fronts: InfectionFront[] = [];
  private closedOrder: string[] = [];
  private director: DirectorState = createDirectorState();
  private events: SimpleEvent[] = [];
  private frontIdCounter = 0;
  private purgeCharge = 0;
  private hint: SimpleHint = 0;
  private message: string | null = "PROTECT THE CORE";
  private messageUntil = 0;
  private oldestReleasedId: string | null = null;
  private highlightCorridorId: string | null = SIMPLE_HINTS.hint0Corridor;
  private redirects = 0;
  private nearCoreSaves = 0;
  private announcedSources = new Set<string>();

  tick = 0;
  elapsedMs = 0;
  phase: SimplePhase = "playing";
  seed: number;
  seedLabel: string;
  coreBreached = false;

  constructor(seed?: number) {
    this.seed = seed ?? (((Date.now() ^ 0x5eed) >>> 0) || 1);
    this.seedLabel = formatIncidentLabel(this.seed);
    this.rng = new SeededRandom(this.seed);
    this.buildGraph();
  }

  private buildGraph(): void {
    for (const def of SIMPLE_LAYOUT.rooms) {
      this.rooms.set(def.id, {
        id: def.id,
        coord: { ...def.coord },
        displayPos: axialToPixel(def.coord),
        state: SIMPLE_SOURCES.includes(def.id as (typeof SIMPLE_SOURCES)[number])
          ? "source"
          : "clean",
        isCore: def.id === "core",
      });
    }
    for (const def of SIMPLE_LAYOUT.corridors) {
      this.corridors.set(def.id, {
        id: def.id,
        roomA: def.roomA,
        roomB: def.roomB,
        state: "open",
        closedAt: 0,
      });
    }
  }

  reset(seed?: number): void {
    this.seed = seed ?? this.seed;
    this.seedLabel = formatIncidentLabel(this.seed);
    this.rng = new SeededRandom(this.seed);
    this.clock.reset();
    this.rooms.clear();
    this.corridors.clear();
    this.fronts = [];
    this.closedOrder = [];
    this.director = createDirectorState();
    this.events = [];
    this.frontIdCounter = 0;
    this.purgeCharge = 0;
    this.hint = 0;
    this.message = "PROTECT THE CORE";
    this.messageUntil = 0;
    this.oldestReleasedId = null;
    this.highlightCorridorId = SIMPLE_HINTS.hint0Corridor;
    this.redirects = 0;
    this.nearCoreSaves = 0;
    this.announcedSources.clear();
    this.tick = 0;
    this.elapsedMs = 0;
    this.phase = "playing";
    this.coreBreached = false;
    this.buildGraph();
  }

  drainEvents(): SimpleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  getSnapshot(): SimpleSnapshot {
    return {
      tick: this.tick,
      elapsedMs: this.elapsedMs,
      phase: this.phase,
      seed: this.seed,
      seedLabel: this.seedLabel,
      rooms: [...this.rooms.values()].map((r) => ({ ...r, coord: { ...r.coord }, displayPos: { ...r.displayPos } })),
      corridors: [...this.corridors.values()].map((c) => ({ ...c })),
      fronts: this.fronts.map((f) => ({ ...f, path: [...f.path] })),
      closedDoorIds: [...this.closedOrder],
      maxClosedDoors: this.director.maxClosedDoors,
      purgeCharge: this.purgeCharge,
      purgeReady: this.purgeCharge >= SIMPLE_PURGE.maxCharge,
      coreBreached: this.coreBreached,
      hint: this.hint,
      message: this.message,
      messageUntil: this.messageUntil,
      difficultyPhase: this.director.phase,
      activeSources: [...this.director.activeSources],
      redirects: this.redirects,
      nearCoreSaves: this.nearCoreSaves,
      oldestReleasedId: this.oldestReleasedId,
      highlightCorridorId: this.highlightCorridorId,
      doorFailureCorridorId: this.director.doorFailureCorridorId,
      doorFailureCountdown: Math.max(0, this.director.doorFailureAt - this.elapsedMs),
    };
  }

  pause(): void {
    if (this.phase === "playing") this.phase = "paused";
  }

  resume(): void {
    if (this.phase === "paused") {
      this.phase = "playing";
      this.clock.reset();
    }
  }

  isPaused(): boolean {
    return this.phase === "paused";
  }

  /** Tap corridor — immediate toggle */
  toggleCorridor(corridorId: string): boolean {
    if (this.phase !== "playing") return false;

    const corridor = this.corridors.get(corridorId);
    if (!corridor) return false;

    if (corridor.state === "open") {
      return this.closeCorridor(corridorId);
    }
    return this.openCorridor(corridorId);
  }

  private closeCorridor(corridorId: string): boolean {
    const corridor = this.corridors.get(corridorId)!;
    corridor.state = "closed";
    corridor.closedAt = this.elapsedMs;

    if (!this.closedOrder.includes(corridorId)) {
      this.closedOrder.push(corridorId);
    }

    while (this.closedOrder.length > this.director.maxClosedDoors) {
      const oldest = this.closedOrder.shift()!;
      this.openCorridor(oldest, true);
      this.oldestReleasedId = oldest;
      this.setMessage("OLDEST DOOR RELEASED", 2500);
      this.events.push({ type: "oldest_released", corridorId: oldest });
    }

    this.events.push({ type: "door_closed", corridorId });
    this.redirects += 1;
    this.fronts = recalculateAllFronts(this.fronts, this.rooms, this.corridors);

    if (this.hint === 0) {
      this.hint = 1;
      this.setMessage("THE INFECTION WILL FIND ANOTHER PATH", 4000);
      this.highlightCorridorId = null;
    } else if (this.hint === 1) {
      this.hint = 2;
      this.setMessage("ONLY THREE DOORS CAN STAY CLOSED", 4000);
    }

    return true;
  }

  private openCorridor(corridorId: string, fromAutoRelease = false): boolean {
    const corridor = this.corridors.get(corridorId);
    if (!corridor || corridor.state === "open") return false;

    corridor.state = "open";
    this.closedOrder = this.closedOrder.filter((id) => id !== corridorId);
    if (!fromAutoRelease) {
      this.events.push({ type: "door_opened", corridorId });
    }
    this.fronts = recalculateAllFronts(this.fronts, this.rooms, this.corridors);
    return true;
  }

  activatePurge(): boolean {
    if (this.phase !== "playing") return false;
    if (this.purgeCharge < SIMPLE_PURGE.maxCharge) return false;

    this.purgeCharge = 0;
    this.events.push({ type: "purge" });

    const core = this.rooms.get("core");
    if (core) core.state = "clean";

    for (const room of this.rooms.values()) {
      if (room.isCore) continue;
      if (room.state === "infected") {
        const dist = graphDistance(room.id, "core", this.rooms, this.corridors);
        if (dist <= SIMPLE_PURGE.clearRadius) {
          room.state = room.id.startsWith("src-") ? "source" : "clean";
        }
      }
    }

    this.fronts = this.fronts.filter((f) => {
      const roomId = f.path[f.segmentIndex];
      if (!roomId) return true;
      const dist = graphDistance(roomId, "core", this.rooms, this.corridors);
      return dist > SIMPLE_PURGE.clearRadius;
    });

    this.nearCoreSaves += 1;
    this.setMessage("PURGE COMPLETE", 2000);
    return true;
  }

  skipHints(): void {
    this.hint = 3;
    this.highlightCorridorId = null;
  }

  update(now: number): void {
    if (this.phase === "game_over") return;
    if (this.phase !== "playing") return;

    const ticks = this.clock.advance(now, false);
    for (let i = 0; i < ticks; i += 1) {
      this.simulationTick(SIMPLE_SIM.tickMs);
    }

    if (this.messageUntil > 0 && this.elapsedMs > this.messageUntil) {
      if (this.message !== "PROTECT THE CORE") {
        this.message = "PROTECT THE CORE";
      }
      this.messageUntil = 0;
    }
  }

  stepTicks(count: number): void {
    for (let i = 0; i < count; i += 1) {
      this.simulationTick(SIMPLE_SIM.tickMs);
    }
  }

  private simulationTick(dtMs: number): void {
    if (this.phase !== "playing") return;

    this.tick += 1;
    this.elapsedMs += dtMs;

    const prevSources = new Set(this.director.activeSources);
    this.director = updateDirector(this.director, this.elapsedMs, SIMPLE_SOURCES, this.rng);

    for (const src of this.director.activeSources) {
      if (!prevSources.has(src) && !this.announcedSources.has(src)) {
        this.announcedSources.add(src);
        this.events.push({ type: "new_source", roomId: src });
        this.setMessage("NEW SOURCE DETECTED", 3000);
        this.spawnFront(src);
      }
    }

    if (this.director.surgeUntil > this.elapsedMs && this.tick % 40 === 0) {
      this.events.push({ type: "surge" });
    }

    this.purgeCharge = Math.min(
      SIMPLE_PURGE.maxCharge,
      this.purgeCharge + SIMPLE_PURGE.chargeRatePerSecond * (dtMs / 1000),
    );

    if (this.hint === 2 && this.elapsedMs > 12000) {
      this.hint = 3;
    }

    const speed = getInfectionSpeed(this.director, this.elapsedMs);
    const delta = speed * (dtMs / 1000);

    const updatedFronts: InfectionFront[] = [];

    for (const front of this.fronts) {
      const result = advanceFront(front, delta);
      if (result.enteredRoom && result.enteredRoom !== "core") {
        const room = this.rooms.get(result.enteredRoom);
        if (room && room.state !== "source") room.state = "infected";
      }
      if (result.reachedCore) {
        this.coreBreached = true;
        this.phase = "game_over";
        this.events.push({ type: "core_breach" });
        return;
      }
      updatedFronts.push(result.front);
    }

    this.fronts = updatedFronts;

    if (this.director.phase >= 2 && this.tick % 120 === 0 && this.fronts.length > 0) {
      const f = this.fronts[0]!;
      const roomId = f.path[f.segmentIndex];
      if (roomId && this.rng.next() < 0.08) {
        this.spawnFront(SIMPLE_SOURCES[this.rng.int(0, this.director.activeSources.length - 1)]!);
      }
    }
  }

  private spawnFront(sourceId: string): void {
    const path = findPathToCore(sourceId, this.rooms, this.corridors);
    if (!path || path.length < 2) return;

    const room = this.rooms.get(sourceId);
    if (room) room.state = "source";

    this.fronts.push({
      id: this.frontIdCounter++,
      path,
      segmentIndex: 0,
      progress: 0,
      sourceId,
    });
  }

  private setMessage(text: string, durationMs: number): void {
    this.message = text;
    this.messageUntil = this.elapsedMs + durationMs;
  }

  computeScore(): number {
    const timeScore = Math.floor(this.elapsedMs / 1000) * 10;
    return timeScore + this.redirects * SIMPLE_SCORING.redirectBonus + this.nearCoreSaves * SIMPLE_SCORING.nearCoreSaveBonus;
  }
}

function graphDistance(
  from: string,
  to: string,
  _rooms: Map<string, SimpleRoom>,
  corridors: Map<string, SimpleCorridor>,
): number {
  if (from === to) return 0;
  const queue: { id: string; d: number }[] = [{ id: from, d: 0 }];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    for (const c of corridors.values()) {
      const other = c.roomA === id ? c.roomB : c.roomB === id ? c.roomA : null;
      if (!other || visited.has(other)) continue;
      if (other === to) return d + 1;
      visited.add(other);
      queue.push({ id: other, d: d + 1 });
    }
  }
  return 999;
}
