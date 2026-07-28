import { describe, expect, it } from "vitest";
import { SeededRandom, formatIncidentLabel, hashStringToSeed } from "../utils/SeededRandom";
import { axialDistance, axialToPixel } from "../utils/hexCoords";
import { ALPHA_LAYOUT } from "../data/alphaLayout";
import { validateLayout, assertLayoutValid } from "../engine/layoutValidation";
import { LaboratoryGraph } from "../engine/LaboratoryGraph";
import { GameSimulation } from "../engine/GameSimulation";
import { createIncidentFromSeed } from "../engine/IncidentGenerator";
import { RESOURCES, SIM } from "../config/balance";

describe("SeededRandom", () => {
  it("produces consistent sequences for same seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("formats incident labels", () => {
    expect(formatIncidentLabel(1842)).toMatch(/^Z26-\d+-/);
  });

  it("hashes strings deterministically", () => {
    expect(hashStringToSeed("test")).toBe(hashStringToSeed("test"));
  });
});

describe("hexCoords", () => {
  it("computes axial distance", () => {
    expect(axialDistance({ q: 0, r: 0 }, { q: 3, r: -1 })).toBe(3);
  });

  it("converts axial to pixel", () => {
    const p = axialToPixel({ q: 0, r: 0 });
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });
});

describe("layout validation", () => {
  it("validates alpha layout", () => {
    const result = validateLayout(ALPHA_LAYOUT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects duplicate corridors", () => {
    const bad = {
      ...ALPHA_LAYOUT,
      corridors: [
        ...ALPHA_LAYOUT.corridors,
        { id: "c-core-n", roomA: "core", roomB: "lab-n" },
      ],
    };
    expect(validateLayout(bad).valid).toBe(false);
  });

  it("assertLayoutValid does not throw for alpha", () => {
    expect(() => assertLayoutValid()).not.toThrow();
  });
});

describe("LaboratoryGraph", () => {
  it("creates rooms and corridors", () => {
    const graph = new LaboratoryGraph();
    expect(graph.rooms.size).toBe(25);
    expect(graph.corridors.size).toBeGreaterThan(20);
  });

  it("finds corridor between rooms", () => {
    const graph = new LaboratoryGraph();
    const c = graph.getCorridorBetween("core", "lab-n");
    expect(c).toBeDefined();
    expect(c!.roomA === "core" || c!.roomB === "core").toBe(true);
  });
});

describe("incident generation", () => {
  it("same seed produces same incident", () => {
    const a = createIncidentFromSeed(9999);
    const b = createIncidentFromSeed(9999);
    expect(a.infectionStartRoomId).toBe(b.infectionStartRoomId);
    expect(a.behaviourProfile).toBe(b.behaviourProfile);
    expect(a.mutationOrder).toEqual(b.mutationOrder);
  });

  it("different seeds can differ", () => {
    const incidents = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
        (s) => createIncidentFromSeed(s).infectionStartRoomId,
      ),
    );
    expect(incidents.size).toBeGreaterThan(1);
  });
});

describe("GameSimulation", () => {
  function makePlayingSim(seed = 7777): GameSimulation {
    const sim = new GameSimulation(createIncidentFromSeed(seed));
    sim.skipToPlaying(0);
    return sim;
  }

  it("infection cannot cross sealed corridor", () => {
    const sim = makePlayingSim();
    const startId = sim.incident.infectionStartRoomId;
    sim.debugAddInfection(startId, 0.9);

    const graph = sim.getGraph();
    const start = graph.getRoom(startId)!;
    const corridor = graph.getCorridor(start.connectedCorridorIds[0]!)!;
    corridor.state = "sealed";

    for (let i = 0; i < 50; i += 1) {
      sim.update(performance.now() + i * SIM.tickMs);
    }

    const neighborId = corridor.roomA === startId ? corridor.roomB : corridor.roomA;
    const neighbor = graph.getRoom(neighborId)!;
    expect(neighbor.infectionAmount).toBeLessThan(0.05);
  });

  it("infection can cross open corridor", () => {
    const sim = makePlayingSim();
    const startId = sim.incident.infectionStartRoomId;
    sim.debugAddInfection(startId, 0.95);
    const graph = sim.getGraph();
    const start = graph.getRoom(startId)!;

    for (const cId of start.connectedCorridorIds) {
      const c = graph.getCorridor(cId)!;
      c.state = "open";
    }

    sim.stepTicks(500);

    const neighbors = graph.getNeighborRooms(startId);
    const spread = neighbors.some((n) => n.infectionAmount > 0.05);
    expect(spread).toBe(true);
  });

  it("pressure builds on sealed corridors", () => {
    const sim = makePlayingSim();
    const startId = sim.incident.infectionStartRoomId;
    sim.debugAddInfection(startId, 0.8);
    const graph = sim.getGraph();
    const start = graph.getRoom(startId)!;
    const corridor = graph.getCorridor(start.connectedCorridorIds[0]!)!;
    corridor.state = "sealed";
    const initialPressure = corridor.pressure;

    for (let i = 0; i < 100; i += 1) {
      sim.update(performance.now() + i * SIM.tickMs);
    }

    expect(corridor.pressure).toBeGreaterThan(initialPressure);
  });

  it("reinforced doors have higher integrity", () => {
    const sim = makePlayingSim();
    sim.resources.engineering = RESOURCES.engineeringMax;
    const corridor = sim.getGraph().corridors.values().next().value!;
    corridor.state = "sealed";
    const before = corridor.integrity;
    sim.reinforce(corridor.id, performance.now());
    expect(corridor.integrity).toBeGreaterThan(before);
  });

  it("serum reduces infection", () => {
    const sim = makePlayingSim();
    const room = sim.getGraph().getRoom(sim.incident.infectionStartRoomId)!;
    sim.debugAddInfection(room.id, 0.7);
    sim.resources.serum = 5;
    sim.deploySerum(room.id, performance.now());
    expect(room.infectionAmount).toBeLessThan(0.7);
  });

  it("purge removes room from play", () => {
    const sim = makePlayingSim();
    const room = sim.getGraph().getRoom("lab-sacrifice")!;
    sim.emergencyPurge(room.id, performance.now());
    expect(room.state).toBe("purged");
    for (const cId of room.connectedCorridorIds) {
      expect(sim.getGraph().getCorridor(cId)!.state).toBe("destroyed");
    }
  });

  it("lockdown stops corridor spread temporarily", () => {
    const sim = makePlayingSim();
    sim.resources.power = RESOURCES.powerMax;
    const startId = sim.incident.infectionStartRoomId;
    sim.debugAddInfection(startId, 0.95);
    sim.facilityLockdown(performance.now());

    const graph = sim.getGraph();
    const start = graph.getRoom(startId)!;
    for (const cId of start.connectedCorridorIds) {
      graph.getCorridor(cId)!.state = "open";
    }

    for (let i = 0; i < 30; i += 1) {
      sim.update(performance.now() + i * SIM.tickMs);
    }

    const neighbors = graph.getNeighborRooms(startId);
    const spread = neighbors.filter((n) => n.infectionAmount > 0.1);
    expect(spread.length).toBeLessThan(neighbors.length);
  });

  it("core failure ends the run", () => {
    const sim = makePlayingSim();
    sim.debugForceGameOver();
    expect(sim.phase).toBe("game_over");
    expect(sim.failureReason).toBe("core_lost");
  });

  it("resources never exceed maximums", () => {
    const sim = makePlayingSim();
    sim.debugAddResources();
    for (let i = 0; i < 500; i += 1) {
      sim.update(performance.now() + i * SIM.tickMs);
    }
    expect(sim.resources.power).toBeLessThanOrEqual(RESOURCES.powerMax);
    expect(sim.resources.serum).toBeLessThanOrEqual(RESOURCES.serumMax);
    expect(sim.resources.engineering).toBeLessThanOrEqual(RESOURCES.engineeringMax);
  });

  it("resources do not become negative", () => {
    const sim = makePlayingSim();
    sim.resources.power = 0;
    sim.resources.serum = 0;
    sim.toggleDoor("c-core-n", performance.now());
    expect(sim.resources.power).toBeGreaterThanOrEqual(0);
  });

  it("pause stops simulation advancement", () => {
    const sim = makePlayingSim();
    const before = sim.elapsedMs;
    sim.pause();
    for (let i = 0; i < 20; i += 1) {
      sim.update(performance.now() + i * 1000);
    }
    expect(sim.elapsedMs).toBe(before);
  });
});
