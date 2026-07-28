import {
  ABILITIES,
  CORE,
  DOORS,
  INFECTION,
  MUTATIONS,
  RESOURCES,
  RUN_FLOW,
  SCORING,
  SIM,
} from "../config/balance";
import type {
  ActiveMutation,
  Cooldowns,
  FailureReason,
  GameMessage,
  GamePhase,
  IncidentConfig,
  MutationId,
  Resources,
  RoomRuntime,
  SimulationEvent,
  SimulationSnapshot,
} from "../types";
import { SeededRandom } from "../utils/SeededRandom";
import {
  createIncidentFromSeed,
  getMutationDescription,
  getMutationSchedule,
} from "./IncidentGenerator";
import { LaboratoryGraph } from "./LaboratoryGraph";
import { assertLayoutValid } from "./layoutValidation";
import { SimulationClock } from "./SimulationClock";
import { TutorialSystem } from "./TutorialSystem";

let messageCounter = 0;

function makeMessage(
  text: string,
  kind: GameMessage["kind"],
  now: number,
  durationMs = 5000,
): GameMessage {
  messageCounter += 1;
  return {
    id: `msg-${messageCounter}`,
    text,
    kind,
    expiresAt: now + durationMs,
  };
}

function initialResources(): Resources {
  return {
    power: RESOURCES.initialPower,
    serum: RESOURCES.initialSerum,
    engineering: RESOURCES.initialEngineering,
    purgeCharges: RESOURCES.initialPurge,
  };
}

function initialCooldowns(): Cooldowns {
  return {
    serum: 0,
    reinforce: 0,
    purge: 0,
    lockdown: 0,
    doorAction: 0,
  };
}

function isInfectedRoom(room: RoomRuntime): boolean {
  return (
    room.infectionAmount > 0 ||
    room.infectionStage === "incubation" ||
    room.infectionStage === "active_contamination" ||
    room.infectionStage === "critical_mass"
  );
}

function isSpreadable(room: RoomRuntime): boolean {
  return (
    room.infectionStage === "active_contamination" ||
    room.infectionStage === "critical_mass"
  );
}

function clampResource(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export class GameSimulation {
  private graph: LaboratoryGraph;
  private rng: SeededRandom;
  private clock = new SimulationClock();
  private events: SimulationEvent[] = [];
  private spreadTimer = 0;
  private incubationTimer = 0;
  private firstAnomalyTriggered = false;
  private tutorialSystem: TutorialSystem;
  private secondFrontTriggered = false;
  private recentBreachCorridorId: string | null = null;
  private recentBreachUntil = 0;
  private recentSpreadRoomId: string | null = null;
  private recentSpreadUntil = 0;
  private infectionRoomsCleared = 0;
  private mutationsEndured = 0;
  private purgesUsed = 0;
  private airborneBypassCooldown = 0;

  tick = 0;
  elapsedMs = 0;
  phase: GamePhase = "boot";
  incident: IncidentConfig;
  resources: Resources = initialResources();
  cooldowns: Cooldowns = initialCooldowns();
  coreIntegrity: number = CORE.maxIntegrity;
  facilityIntegrity: number = CORE.facilityIntegrity;
  activeMutations: ActiveMutation[] = [];
  lockdownUntil = 0;
  score = 0;
  failureReason: FailureReason | null = null;
  selectedRoomId: string | null = null;
  selectedCorridorId: string | null = null;
  tutorialStep = 0;
  firstAnomalyAt = 0;
  messages: GameMessage[] = [];
  mutationSchedule: { id: MutationId; atMs: number }[] = [];
  nextMutationIndex = 0;
  bootCompleteAt = 0;
  introCompleteAt = 0;

  constructor(incident?: IncidentConfig) {
    assertLayoutValid();
    this.incident = incident ?? createIncidentFromSeed(1842);
    this.rng = new SeededRandom(this.incident.seed);
    this.graph = new LaboratoryGraph();
    this.mutationSchedule = getMutationSchedule(this.incident);
    this.tutorialSystem = new TutorialSystem(this.incident.tutorialMode);
  }

  reset(incident: IncidentConfig): void {
    this.incident = incident;
    this.rng = new SeededRandom(incident.seed);
    this.graph = new LaboratoryGraph();
    this.clock.reset();
    this.events = [];
    this.spreadTimer = 0;
    this.incubationTimer = 0;
    this.firstAnomalyTriggered = false;
    this.tutorialSystem.reset();
    this.secondFrontTriggered = false;
    this.recentBreachCorridorId = null;
    this.recentSpreadRoomId = null;
    this.infectionRoomsCleared = 0;
    this.mutationsEndured = 0;
    this.purgesUsed = 0;
    this.airborneBypassCooldown = 0;
    this.tick = 0;
    this.elapsedMs = 0;
    this.phase = "boot";
    this.resources = initialResources();
    this.cooldowns = initialCooldowns();
    this.coreIntegrity = CORE.maxIntegrity;
    this.facilityIntegrity = CORE.facilityIntegrity;
    this.activeMutations = [];
    this.lockdownUntil = 0;
    this.score = 0;
    this.failureReason = null;
    this.selectedRoomId = null;
    this.selectedCorridorId = null;
    this.tutorialStep = 0;
    this.firstAnomalyAt = 0;
    this.messages = [];
    this.mutationSchedule = getMutationSchedule(incident);
    this.nextMutationIndex = 0;
    this.bootCompleteAt = 0;
    this.introCompleteAt = 0;
    this.tutorialSystem = new TutorialSystem(incident.tutorialMode);
  }

  /** Test / debug: advance simulation by fixed ticks without wall clock. */
  stepTicks(count: number, now = performance.now()): void {
    for (let i = 0; i < count; i += 1) {
      this.simulationTick(SIM.tickMs, now + i * SIM.tickMs);
    }
  }

  getGraph(): LaboratoryGraph {
    return this.graph;
  }

  drainEvents(): SimulationEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  getSnapshot(): SimulationSnapshot {
    return {
      tick: this.tick,
      elapsedMs: this.elapsedMs,
      phase: this.phase,
      rooms: this.graph.cloneRooms(),
      corridors: this.graph.cloneCorridors(),
      resources: { ...this.resources },
      cooldowns: { ...this.cooldowns },
      coreIntegrity: this.coreIntegrity,
      facilityIntegrity: this.facilityIntegrity,
      activeMutations: this.activeMutations.map((m) => ({ ...m })),
      lockdownUntil: this.lockdownUntil,
      score: this.computeScore(),
      infectionRoomsCleared: this.infectionRoomsCleared,
      bulkheadsRemaining: [...this.graph.corridors.values()].filter(
        (c) => c.state === "sealed" && c.integrity > 0,
      ).length,
      failureReason: this.failureReason,
      incident: { ...this.incident },
      selectedRoomId: this.selectedRoomId,
      selectedCorridorId: this.selectedCorridorId,
      tutorialStep: this.tutorialSystem.step,
      firstAnomalyAt: this.firstAnomalyAt,
      messages: [...this.messages],
      tutorial: this.incident.tutorialMode
        ? {
            ...this.tutorialSystem.getStepInfo(),
            active: this.tutorialSystem.isActive(),
          }
        : null,
      tutorialHighlights: this.incident.tutorialMode
        ? this.tutorialSystem.getHighlights(
            this.selectedRoomId,
            this.selectedCorridorId,
            [...this.graph.corridors.values()],
          )
        : null,
      recentBreachCorridorId: this.recentBreachCorridorId,
      recentSpreadRoomId: this.recentSpreadRoomId,
    };
  }

  startBoot(now: number): void {
    this.phase = "boot";
    this.bootCompleteAt = now + RUN_FLOW.bootDurationMs;
    this.introCompleteAt = now + RUN_FLOW.bootDurationMs + RUN_FLOW.introDurationMs;
    this.messages = [
      makeMessage("BLACKWATER LABORATORY", "info", now, 6000),
    ];
  }

  dismissBriefing(): void {
    if (this.phase === "briefing") {
      this.phase = "playing";
      this.clock.reset();
    }
  }

  skipTutorialMode(): void {
    this.tutorialSystem.skip();
  }

  skipToPlaying(now: number): void {
    this.phase = "playing";
    this.bootCompleteAt = now;
    this.introCompleteAt = now;
    this.clock.reset();
  }

  dismissBriefingForTest(): void {
    this.phase = "playing";
    this.clock.reset();
  }

  update(now: number): void {
    if (this.phase === "game_over") return;

    if (this.phase === "boot" && now >= this.bootCompleteAt) {
      this.phase = "intro";
      this.messages.push(
        makeMessage("REMOTE CONTAINMENT INTERFACE", "info", now, 6000),
        makeMessage("AUTHENTICATION ACCEPTED", "info", now, 6000),
        makeMessage("INCIDENT Z-26 DETECTED", "warning", now, 8000),
      );
    }

    if (this.phase === "intro" && now >= this.introCompleteAt) {
      if (this.incident.tutorialMode) {
        this.phase = "playing";
        this.clock.reset();
      } else {
        this.phase = "briefing";
      }
    }

    if (this.phase !== "playing") return;

    const paused = false;
    const ticks = this.clock.advance(now, paused);
    for (let i = 0; i < ticks; i += 1) {
      this.simulationTick(SIM.tickMs, now);
    }

    this.messages = this.messages.filter((m) => m.expiresAt > now);
    this.score = this.computeScore();
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

  selectRoom(roomId: string | null): void {
    this.selectedRoomId = roomId;
    if (roomId) {
      this.selectedCorridorId = null;
      if (this.incident.tutorialMode) {
        this.tutorialSystem.onRoomSelected(roomId);
      }
    }
  }

  selectCorridor(corridorId: string | null): boolean {
    if (corridorId && this.incident.tutorialMode) {
      const allowed = this.tutorialSystem.onCorridorSelected(corridorId);
      if (!allowed) return false;
    }
    this.selectedCorridorId = corridorId;
    if (corridorId) this.selectedRoomId = null;
    return true;
  }

  getTutorialCorridorHint(): string | null {
    if (!this.incident.tutorialMode || !this.tutorialSystem.isActive()) {
      return null;
    }
    const h = this.tutorialSystem.getHighlights(
      this.selectedRoomId,
      this.selectedCorridorId,
      [...this.graph.corridors.values()],
    );
    return h.pulseCorridor ? h.corridorId : null;
  }

  getTutorialRoomHint(): string | null {
    if (!this.incident.tutorialMode || !this.tutorialSystem.isActive()) {
      return null;
    }
    const h = this.tutorialSystem.getHighlights(
      this.selectedRoomId,
      this.selectedCorridorId,
      [...this.graph.corridors.values()],
    );
    return h.pulseRoom ? h.roomId : null;
  }

  toggleDoor(corridorId: string, now: number): boolean {
    if (this.phase !== "playing") return false;
    if (this.cooldowns.doorAction > this.elapsedMs) return false;

    const corridor = this.graph.getCorridor(corridorId);
    if (!corridor || corridor.state === "destroyed") return false;

    if (corridor.state === "open" || corridor.state === "breached") {
      if (this.resources.power < DOORS.sealPowerCost) {
        this.messages.push(makeMessage("INSUFFICIENT POWER", "warning", now));
        return false;
      }
      this.resources.power -= DOORS.sealPowerCost;
      corridor.state = "sealed";
      corridor.breached = false;
      this.cooldowns.doorAction = this.elapsedMs + DOORS.doorActionCooldownMs;
      this.events.push({ type: "door_sealed", corridorId });
      if (this.incident.tutorialMode) {
        this.tutorialSystem.onDoorSealed(corridorId);
      }
      return true;
    }

    if (corridor.state === "sealed") {
      corridor.state = "open";
      corridor.pressure = Math.max(0, corridor.pressure * 0.5);
      this.cooldowns.doorAction = this.elapsedMs + DOORS.doorActionCooldownMs;
      this.events.push({ type: "door_reopened", corridorId });
      return true;
    }

    return false;
  }

  deploySerum(roomId: string, now: number): boolean {
    if (this.phase !== "playing") return false;
    if (this.cooldowns.serum > this.elapsedMs) return false;

    const room = this.graph.getRoom(roomId);
    if (!room || room.state === "lost" || room.state === "purged") return false;
    if (!isInfectedRoom(room)) return false;
    if (this.resources.serum < 1) {
      this.messages.push(makeMessage("INSUFFICIENT SERUM", "warning", now));
      return false;
    }

    this.resources.serum -= 1;
    const chainBonus = room.chainDensity * 0.15;
    room.infectionAmount = Math.max(
      0,
      room.infectionAmount - INFECTION.serumReduction - chainBonus,
    );
    room.chainDensity = Math.max(0, room.chainDensity - 0.6);
    room.temporaryProtectionUntil = now + INFECTION.serumProtectionMs;

    if (room.infectionAmount <= 0.05) {
      room.infectionAmount = 0;
      room.infectionStage = "none";
      room.state = "protected";
      this.infectionRoomsCleared += 1;
    } else if (room.infectionAmount < INFECTION.criticalThreshold) {
      room.infectionStage = "active_contamination";
      room.state = "infected";
    }

    this.cooldowns.serum = this.elapsedMs + INFECTION.serumCooldownMs;
    this.events.push({ type: "serum_deployed", roomId });
    if (this.incident.tutorialMode) {
      this.tutorialSystem.onSerumDeployed(roomId);
    }
    return true;
  }

  reinforce(corridorId: string, now: number): boolean {
    if (this.phase !== "playing") return false;
    if (this.cooldowns.reinforce > this.elapsedMs) return false;

    const corridor = this.graph.getCorridor(corridorId);
    if (!corridor || corridor.state !== "sealed") return false;
    if (this.resources.engineering < DOORS.reinforceCost) {
      this.messages.push(makeMessage("INSUFFICIENT ENGINEERING", "warning", now));
      return false;
    }

    this.resources.engineering -= DOORS.reinforceCost;
    corridor.reinforcementLevel += 1;
    corridor.integrity = Math.min(
      corridor.maxIntegrity + DOORS.reinforceMaxBonus,
      corridor.integrity + DOORS.reinforceAmount,
    );
    corridor.maxIntegrity = Math.min(
      DOORS.baseMaxIntegrity + DOORS.reinforceMaxBonus + corridor.reinforcementLevel * 5,
      corridor.maxIntegrity + 5,
    );
    this.cooldowns.reinforce = this.elapsedMs + ABILITIES.reinforceDurationMs;
    if (this.incident.tutorialMode) {
      this.tutorialSystem.onReinforced(corridorId);
    }
    return true;
  }

  emergencyPurge(roomId: string, now: number): boolean {
    if (this.phase !== "playing") return false;
    if (this.cooldowns.purge > this.elapsedMs) return false;
    if (this.resources.purgeCharges < 1) {
      this.messages.push(makeMessage("NO PURGE CHARGES", "warning", now));
      return false;
    }

    const room = this.graph.getRoom(roomId);
    if (!room || room.type === "containment_core") return false;
    if (room.state === "purged" || room.state === "lost") return false;

    this.resources.purgeCharges -= 1;
    this.purgesUsed += 1;
    room.state = "purged";
    room.infectionAmount = 0;
    room.infectionStage = "none";
    room.chainDensity = 0;

    for (const cId of room.connectedCorridorIds) {
      const c = this.graph.getCorridor(cId);
      if (c) {
        c.state = "destroyed";
        c.integrity = 0;
      }
    }

    this.cooldowns.purge = this.elapsedMs + 3000;
    this.events.push({ type: "room_purged", roomId });
    this.messages.push(makeMessage(`SECTOR ${room.label} PURGED`, "warning", now));
    return true;
  }

  facilityLockdown(now: number): boolean {
    if (this.phase !== "playing") return false;
    if (this.cooldowns.lockdown > this.elapsedMs) return false;
    if (this.resources.power < ABILITIES.lockdownPowerCost) {
      this.messages.push(makeMessage("INSUFFICIENT POWER", "warning", now));
      return false;
    }

    this.resources.power -= ABILITIES.lockdownPowerCost;
    this.lockdownUntil = now + ABILITIES.lockdownDurationMs;
    this.cooldowns.lockdown = this.elapsedMs + ABILITIES.lockdownCooldownMs;
    this.events.push({ type: "lockdown_start" });
    this.messages.push(makeMessage("FACILITY LOCKDOWN ACTIVE", "info", now, 6000));
    return true;
  }

  hasMutation(id: MutationId): boolean {
    return this.activeMutations.some((m) => m.id === id);
  }

  private simulationTick(dtMs: number, now: number): void {
    if (this.phase !== "playing") return;

    this.tick += 1;
    this.elapsedMs += dtMs;

    this.updateResources(dtMs);
    this.updateCooldowns(dtMs);
    this.triggerFirstAnomaly(now);
    this.triggerSecondFront(now);
    if (this.incident.tutorialMode) {
      const startRoom = this.graph.getRoom(this.incident.infectionStartRoomId);
      this.tutorialSystem.tick(
        this.elapsedMs - this.firstAnomalyAt,
        [...this.graph.corridors.values()],
        startRoom,
      );
    }
    this.updateInfection(dtMs, now);
    this.updatePressure(dtMs, now);
    this.checkMutations(now);
    this.updateCoreDamage(dtMs);
    this.checkGameOver(now);
  }

  private updateResources(dtMs: number): void {
    const factor = dtMs / 1000;
    const powerOp = this.graph.isRoomOperational("power_generator");
    const serumOp = this.graph.isRoomOperational("serum_synthesis");
    const maintOp = this.graph.isRoomOperational("maintenance");

    const powerRoom = [...this.graph.rooms.values()].find(
      (r) => r.type === "power_generator",
    );
    const powerInfected = powerRoom ? isInfectedRoom(powerRoom) : false;

    let powerRate: number = RESOURCES.powerRegenEmergency;
    if (powerOp) {
      powerRate = powerInfected
        ? RESOURCES.powerRegenReduced
        : RESOURCES.powerRegenNormal;
    }

    const serumRate: number = serumOp
      ? RESOURCES.serumRegenNormal
      : RESOURCES.serumRegenReduced;
    const engRate: number = maintOp
      ? RESOURCES.engineeringRegenNormal
      : RESOURCES.engineeringRegenReduced;

    this.resources.power = clampResource(
      this.resources.power + powerRate * factor * 100,
      RESOURCES.powerMax,
    );
    this.resources.serum = clampResource(
      this.resources.serum + serumRate * factor * 100,
      RESOURCES.serumMax,
    );
    this.resources.engineering = clampResource(
      this.resources.engineering + engRate * factor * 100,
      RESOURCES.engineeringMax,
    );

    this.updateRoomPower();
  }

  private updateRoomPower(): void {
    const powerOp = this.graph.isRoomOperational("power_generator");
    for (const room of this.graph.rooms.values()) {
      if (room.state === "purged" || room.state === "lost") {
        room.powered = false;
        continue;
      }
      room.powered = powerOp || room.type === "containment_core";
      if (!room.powered && room.state === "stable") {
        room.state = "offline";
      } else if (room.powered && room.state === "offline") {
        room.state = "stable";
      }
    }
  }

  private updateCooldowns(_dtMs: number): void {
    /* cooldowns stored as absolute elapsedMs thresholds — checked at action time */
  }

  private triggerFirstAnomaly(now: number): void {
    if (this.firstAnomalyTriggered) return;

    const delay = this.incident.tutorialMode
      ? INFECTION.tutorialFirstAnomalyMs
      : INFECTION.firstAnomalyDelayMs;

    if (this.elapsedMs < delay) return;

    this.firstAnomalyTriggered = true;
    this.firstAnomalyAt = this.elapsedMs;

    const startRoom = this.graph.getRoom(this.incident.infectionStartRoomId);
    if (!startRoom) return;

    startRoom.state = "incubating";
    startRoom.infectionStage = "incubation";
    startRoom.infectionAmount = 0.28;
    startRoom.visibleToScanner = true;
    startRoom.chainDensity = 0.15;

    this.incubationTimer = this.incident.tutorialMode
      ? INFECTION.exposureToIncubationMs * 2
      : INFECTION.exposureToIncubationMs;

    this.messages.push(
      makeMessage("ANOMALY DETECTED", "warning", now, 6000),
      makeMessage(startRoom.label.toUpperCase(), "warning", now, 6000),
    );
  }

  private triggerSecondFront(now: number): void {
    if (this.secondFrontTriggered || this.incident.tutorialMode) return;

    const delay = INFECTION.secondFrontDelayMs;
    if (this.elapsedMs < delay) return;

    this.secondFrontTriggered = true;
    const candidates = [...this.graph.rooms.values()].filter(
      (r) =>
        r.type === "standard_lab" &&
        r.id !== this.incident.infectionStartRoomId &&
        r.infectionAmount < 0.05 &&
        r.state !== "purged" &&
        r.state !== "lost",
    );
    if (candidates.length === 0) return;

    const target = this.rng.pick(candidates);
    target.state = "exposed";
    target.infectionStage = "exposure";
    target.infectionAmount = 0.12;
    target.visibleToScanner = true;
    this.messages.push(
      makeMessage("SECONDARY ANOMALY", "warning", now, 5000),
      makeMessage(target.label.toUpperCase(), "warning", now, 5000),
    );
  }

  private updateInfection(dtMs: number, now: number): void {
    const scannerOp = this.graph.isRoomOperational("scanner_array");
    const lockdownActive = now < this.lockdownUntil;

    if (this.incubationTimer > 0) {
      this.incubationTimer -= dtMs;
      if (this.incubationTimer <= 0) {
        const startRoom = this.graph.getRoom(this.incident.infectionStartRoomId);
        if (startRoom && startRoom.infectionStage === "exposure") {
          startRoom.infectionStage = "incubation";
          startRoom.state = "incubating";
          startRoom.infectionAmount = 0.15;
          if (this.hasMutation("dormant_carriers") && !scannerOp) {
            startRoom.visibleToScanner = this.rng.next() > MUTATIONS.dormantObscureChance;
          }
        }
      }
    }

    for (const room of this.graph.rooms.values()) {
      if (room.state === "purged" || room.state === "lost") continue;
      if (room.temporaryProtectionUntil > now && room.infectionAmount <= 0) {
        room.state = "protected";
      }

      if (room.infectionStage === "incubation") {
        room.infectionAmount += INFECTION.incubationGrowthRate * (dtMs / 16);
        if (room.infectionAmount >= 0.35) {
          room.infectionStage = "active_contamination";
          room.state = "infected";
          this.events.push({ type: "room_infected", roomId: room.id });
        }
      }

      if (isSpreadable(room)) {
        room.infectionAmount += INFECTION.activeGrowthRate * (dtMs / 16);
        room.chainDensity = Math.min(
          1,
          room.chainDensity + INFECTION.chainGrowthRate * (dtMs / 1000),
        );

        if (room.infectionAmount >= INFECTION.criticalThreshold) {
          room.infectionStage = "critical_mass";
          room.state = "critical";
        }

        if (room.infectionAmount >= INFECTION.collapseThreshold) {
          room.infectionStage = "collapse";
          room.state = "lost";
          this.events.push({ type: "room_lost", roomId: room.id });
          this.burstPressureFromRoom(room);
        }
      }

      if (!scannerOp && room.state === "exposed") {
        room.visibleToScanner = false;
      } else if (scannerOp) {
        room.visibleToScanner = true;
      }

      if (
        this.hasMutation("dormant_carriers") &&
        room.infectionStage === "incubation" &&
        !scannerOp
      ) {
        room.visibleToScanner = this.rng.next() > MUTATIONS.dormantObscureChance;
      }
    }

    const spreadInterval =
      INFECTION.spreadIntervalMs *
      (this.incident.tutorialMode
        ? this.tutorialSystem.getSpreadIntervalMultiplier()
        : 1);

    this.spreadTimer += dtMs;
    if (this.spreadTimer >= spreadInterval) {
      this.spreadTimer = 0;
      if (!lockdownActive && !this.tutorialSystem.shouldBlockSpread()) {
        this.spreadInfection(now);
      }
    }

    if (this.recentBreachUntil > 0 && this.elapsedMs > this.recentBreachUntil) {
      this.recentBreachCorridorId = null;
    }
    if (this.recentSpreadUntil > 0 && this.elapsedMs > this.recentSpreadUntil) {
      this.recentSpreadRoomId = null;
    }

    if (this.airborneBypassCooldown > 0) {
      this.airborneBypassCooldown -= dtMs;
    }
  }

  private spreadInfection(now: number): void {
    const infected = [...this.graph.rooms.values()].filter(isSpreadable);
    if (infected.length === 0) return;

    const profile = this.incident.behaviourProfile;
    const sorted = [...infected].sort((a, b) => {
      if (profile === "predatory") {
        const core = this.graph.getRoom("core");
        if (core) {
          return (
            this.distToCore(b) - this.distToCore(a) ||
            b.infectionAmount - a.infectionAmount
          );
        }
      }
      if (profile === "burrowing") {
        return a.infectionAmount - b.infectionAmount;
      }
      return b.infectionAmount - a.infectionAmount;
    });

    for (const source of sorted) {
      const neighbors = this.getSpreadTargets(source, now);
      for (const target of neighbors) {
        if (target.infectionStage === "none" || target.infectionAmount < 0.1) {
          target.infectionStage = "exposure";
          target.state = "exposed";
          target.infectionAmount = Math.max(
            target.infectionAmount,
            INFECTION.spreadAmount * source.infectionAmount,
          );
          target.visibleToScanner =
            this.graph.isRoomOperational("scanner_array");
          this.recentSpreadRoomId = target.id;
          this.recentSpreadUntil = this.elapsedMs + 1200;
        } else {
          target.infectionAmount = Math.min(
            1,
            target.infectionAmount + INFECTION.spreadAmount * 0.5,
          );
        }
      }
    }
  }

  private getSpreadTargets(source: RoomRuntime, now: number): RoomRuntime[] {
    const targets: RoomRuntime[] = [];
    const ventOp = this.graph.isRoomOperational("ventilation");

    for (const cId of source.connectedCorridorIds) {
      const corridor = this.graph.getCorridor(cId);
      if (!corridor || corridor.state === "destroyed") continue;

      const otherId = corridor.roomA === source.id ? corridor.roomB : corridor.roomA;
      const target = this.graph.getRoom(otherId);
      if (!target || target.state === "purged" || target.state === "lost") continue;
      if (target.temporaryProtectionUntil > now) continue;

      if (corridor.state === "open" || corridor.state === "breached") {
        targets.push(target);
        continue;
      }

      if (corridor.state === "sealed" && this.hasMutation("airborne")) {
        if (this.airborneBypassCooldown > 0) continue;
        if (source.infectionAmount < MUTATIONS.airborneThreshold) continue;

        const reduction = ventOp ? MUTATIONS.airborneVentilationReduction : 0;
        if (this.rng.next() > 0.15 + reduction) {
          targets.push(target);
          this.airborneBypassCooldown = 8000;
          this.messages.push(
            makeMessage("AIRBORNE BYPASS — SEALED ROUTE", "warning", now, 4000),
          );
        }
      }
    }

    return targets;
  }

  private distToCore(room: RoomRuntime): number {
    const core = this.graph.getRoom("core");
    if (!core) return 999;
    return Math.abs(room.coord.q - core.coord.q) + Math.abs(room.coord.r - core.coord.r);
  }

  private burstPressureFromRoom(room: RoomRuntime): void {
    for (const cId of room.connectedCorridorIds) {
      const c = this.graph.getCorridor(cId);
      if (!c || c.state === "destroyed") continue;
      c.pressure += DOORS.breachSpreadBurst * 100;
    }
  }

  private updatePressure(dtMs: number, now: number): void {
    const securityOp = this.graph.isRoomOperational("security_control");
    const corrosive = this.hasMutation("corrosive_response");
    const lockdownActive = now < this.lockdownUntil;
    const pressureMult = lockdownActive ? ABILITIES.lockdownPressureMultiplier : 1;

    const pressureTutorialMult = this.tutorialSystem.getPressureMultiplier();

    for (const corridor of this.graph.corridors.values()) {
      if (corridor.state !== "sealed") {
        corridor.pressure = Math.max(0, corridor.pressure - 0.5 * (dtMs / 1000));
        continue;
      }

      const roomA = this.graph.getRoom(corridor.roomA);
      const roomB = this.graph.getRoom(corridor.roomB);
      let pressureSource = 0;

      if (roomA && isInfectedRoom(roomA)) {
        pressureSource += roomA.infectionAmount * INFECTION.pressureContribution;
      }
      if (roomB && isInfectedRoom(roomB)) {
        pressureSource += roomB.infectionAmount * INFECTION.pressureContribution;
      }

      if (pressureSource <= 0) {
        corridor.pressure = Math.max(0, corridor.pressure - 0.3 * (dtMs / 1000));
        continue;
      }

      let buildRate = DOORS.pressureBuildRate;
      if (this.incident.behaviourProfile === "burrowing") buildRate *= 1.4;
      if (corrosive) buildRate *= DOORS.corrosiveDecayMultiplier;

      corridor.pressure +=
        pressureSource * buildRate * pressureMult * pressureTutorialMult * (dtMs / 1000) * 100;

      let decayRate = DOORS.integrityDecayRate;
      if (corrosive) decayRate *= DOORS.corrosiveDecayMultiplier;
      if (securityOp) decayRate *= 0.75;

      const pressureFactor = corridor.pressure / 100;
      if (pressureFactor > 0.1) {
        corridor.integrity -= decayRate * pressureFactor * (dtMs / 1000) * 10;
      }

      if (corridor.integrity <= 0 && !corridor.breached) {
        corridor.breached = true;
        corridor.state = "breached";
        corridor.integrity = 0;
        this.events.push({ type: "door_breach", corridorId: corridor.id });
        this.recentBreachCorridorId = corridor.id;
        this.recentBreachUntil = this.elapsedMs + 1500;
        this.messages.push(
          makeMessage(`BULKHEAD ${corridor.id.toUpperCase()} BREACHED`, "warning", now, 6000),
        );
      }
    }
  }

  private checkMutations(now: number): void {
    while (
      this.nextMutationIndex < this.mutationSchedule.length &&
      this.elapsedMs >= this.mutationSchedule[this.nextMutationIndex]!.atMs
    ) {
      const entry = this.mutationSchedule[this.nextMutationIndex]!;
      this.activeMutations.push({
        id: entry.id,
        activatedAt: this.elapsedMs,
        announced: true,
      });
      this.mutationsEndured += 1;
      this.events.push({ type: "mutation", mutationId: entry.id });
      const desc = getMutationDescription(entry.id);
      this.messages.push(
        makeMessage("MUTATION DETECTED", "mutation", now, 6000),
        makeMessage(desc.title, "mutation", now, 8000),
        makeMessage(desc.body, "mutation", now, 8000),
      );
      this.nextMutationIndex += 1;
    }
  }

  private updateCoreDamage(dtMs: number): void {
    const core = this.graph.getRoom("core");
    if (!core) return;

    let damage = 0;
    for (const neighbor of this.graph.getNeighborRooms("core")) {
      if (isInfectedRoom(neighbor)) {
        damage += neighbor.infectionAmount * INFECTION.coreDamageRate * (dtMs / 1000);
      }
    }

    if (core.infectionAmount > 0) {
      damage += core.infectionAmount * INFECTION.coreDamageRate * 2 * (dtMs / 1000);
    }

    this.coreIntegrity = Math.max(0, this.coreIntegrity - damage * 100);

    if (core.infectionAmount > 0.3) {
      core.state = "critical";
    }
  }

  private checkGameOver(now: number): void {
    if (this.coreIntegrity <= 0) {
      this.endGame("core_lost", now);
      return;
    }

    const core = this.graph.getRoom("core");
    if (core && core.infectionStage === "collapse") {
      this.endGame("core_lost", now);
    }
  }

  private endGame(reason: FailureReason, now: number): void {
    this.phase = "game_over";
    this.failureReason = reason;
    this.events.push({ type: "game_over", reason });
    this.messages.push(
      makeMessage("CONTAINMENT FAILURE", "warning", now, 30000),
      makeMessage("SITE CONNECTION LOST", "warning", now, 30000),
    );
  }

  computeScore(): number {
    const timeScore = Math.floor(this.elapsedMs / 1000) * SCORING.timeMultiplier;
    const coreBonus = Math.floor(this.coreIntegrity * SCORING.coreIntegrityBonus / 100);
    const systems = [
      "power_generator",
      "serum_synthesis",
      "scanner_array",
      "security_control",
    ].filter((t) => this.graph.isRoomOperational(t as RoomRuntime["type"])).length;
    const systemBonus = systems * SCORING.systemBonus;
    const clearBonus = this.infectionRoomsCleared * SCORING.infectionClearBonus;
    const bulkheads = [...this.graph.corridors.values()].filter(
      (c) => c.state === "sealed" && c.integrity > 20,
    ).length;
    const bulkBonus = bulkheads * SCORING.bulkheadBonus;
    const purgePenalty = this.purgesUsed * SCORING.purgePenalty;

    return Math.max(
      0,
      timeScore + coreBonus + systemBonus + clearBonus + bulkBonus - purgePenalty,
    );
  }

  /** Debug helpers — dev only */
  debugAddInfection(roomId: string, amount: number): void {
    const room = this.graph.getRoom(roomId);
    if (!room) return;
    room.infectionAmount = Math.min(1, room.infectionAmount + amount);
    room.infectionStage = "active_contamination";
    room.state = "infected";
  }

  debugClearRoom(roomId: string): void {
    const room = this.graph.getRoom(roomId);
    if (!room) return;
    room.infectionAmount = 0;
    room.infectionStage = "none";
    room.state = "stable";
    room.chainDensity = 0;
  }

  debugDamageDoor(corridorId: string): void {
    const c = this.graph.getCorridor(corridorId);
    if (!c) return;
    c.integrity = Math.max(0, c.integrity - 30);
  }

  debugAddResources(): void {
    this.resources.power = RESOURCES.powerMax;
    this.resources.serum = RESOURCES.serumMax;
    this.resources.engineering = RESOURCES.engineeringMax;
  }

  debugTriggerMutation(id: MutationId): void {
    if (!this.activeMutations.some((m) => m.id === id)) {
      this.activeMutations.push({
        id,
        activatedAt: this.elapsedMs,
        announced: true,
      });
    }
  }

  debugForceGameOver(): void {
    this.coreIntegrity = 0;
    this.endGame("core_lost", performance.now());
  }
}
