import { describe, expect, it } from "vitest";
import { SimplifiedSimulation } from "../engine/SimplifiedSimulation";
import { findPathToCore, advanceFront, getOpenNeighbors } from "../engine/InfectionRouter";
import { SIMPLE_SIM, SIMPLE_PHASES } from "../config/simplifiedBalance";
import { SeededRandom } from "../utils/SeededRandom";
import { createDirectorState, updateDirector, getInfectionSpeed } from "../engine/DifficultyDirector";
import { SIMPLE_SOURCES } from "../data/simpleLayout";

describe("SimplifiedSimulation", () => {
  function makePlaying(seed = 4242): SimplifiedSimulation {
    const sim = new SimplifiedSimulation(seed);
    sim.skipHints();
    return sim;
  }

  it("closes corridor immediately on toggle", () => {
    const sim = makePlaying();
    expect(sim.toggleCorridor("c-n-n2")).toBe(true);
    const snap = sim.getSnapshot();
    expect(snap.corridors.find((c) => c.id === "c-n-n2")?.state).toBe("closed");
  });

  it("reopens corridor on second toggle", () => {
    const sim = makePlaying();
    sim.toggleCorridor("c-n-n2");
    sim.toggleCorridor("c-n-n2");
    expect(sim.getSnapshot().corridors.find((c) => c.id === "c-n-n2")?.state).toBe("open");
  });

  it("allows maximum three closed doors", () => {
    const sim = makePlaying();
    sim.toggleCorridor("c-n-n2");
    sim.toggleCorridor("c-n-ne");
    sim.toggleCorridor("c-s-sw");
    expect(sim.getSnapshot().closedDoorIds.length).toBe(3);
  });

  it("closing fourth reopens oldest", () => {
    const sim = makePlaying();
    sim.toggleCorridor("c-n-n2");
    sim.stepTicks(10);
    sim.toggleCorridor("c-n-ne");
    sim.stepTicks(10);
    sim.toggleCorridor("c-s-sw");
    sim.stepTicks(10);
    sim.toggleCorridor("c-e-e2");
    const snap = sim.getSnapshot();
    expect(snap.closedDoorIds.length).toBe(3);
    expect(snap.corridors.find((c) => c.id === "c-n-n2")?.state).toBe("open");
  });

  it("infection cannot cross closed door", () => {
    const sim = makePlaying();
    const snap = sim.getSnapshot();
    const rooms = new Map(snap.rooms.map((r) => [r.id, r]));
    const corridors = new Map(snap.corridors.map((c) => [c.id, { ...c }]));

    corridors.get("c-cn")!.state = "closed";
    const neighbors = getOpenNeighbors("core", rooms, corridors);
    expect(neighbors).not.toContain("r-n");

    const path = findPathToCore("r-n", rooms, corridors);
    expect(path === null || !path.includes("core") || path.length > 2).toBe(true);
  });

  it("infection follows open route toward core", () => {
    const sim = makePlaying();
    const snap = sim.getSnapshot();
    const rooms = new Map(snap.rooms.map((r) => [r.id, r]));
    const corridors = new Map(snap.corridors.map((c) => [c.id, c]));
    const path = findPathToCore("src-nw", rooms, corridors);
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toBe("core");
  });

  it("route recalculates after closure", () => {
    const sim = makePlaying();
    sim.stepTicks(Math.ceil(SIMPLE_PHASES.firstSourceDelayMs / SIMPLE_SIM.tickMs) + 20);
    const before = sim.getSnapshot().fronts.length;
    sim.toggleCorridor("c-n-n2");
    sim.stepTicks(5);
    const after = sim.getSnapshot();
    expect(after.redirects).toBeGreaterThan(0);
    if (before > 0) {
      expect(after.fronts[0]?.path).toBeDefined();
    }
  });

  it("purge cannot activate before charged", () => {
    const sim = makePlaying();
    expect(sim.activatePurge()).toBe(false);
  });

  it("purge clears when fully charged", () => {
    const sim = makePlaying();
    sim.toggleCorridor("c-nw-src");
    sim.toggleCorridor("c-ne-src");
    sim.toggleCorridor("c-s2-src");
    sim.stepTicks(500);
    expect(sim.getSnapshot().phase).toBe("playing");
    expect(sim.getSnapshot().purgeReady).toBe(true);
    expect(sim.activatePurge()).toBe(true);
    expect(sim.getSnapshot().purgeCharge).toBeLessThan(0.1);
  });

  it("pause stops advancement", () => {
    const sim = makePlaying();
    sim.stepTicks(10);
    const before = sim.elapsedMs;
    sim.pause();
    sim.update(performance.now() + 5000);
    expect(sim.elapsedMs).toBe(before);
  });

  it("infection reaching core ends run", () => {
    const front = {
      id: 0,
      path: ["r-n", "core"],
      segmentIndex: 0,
      progress: 0.95,
      sourceId: "src-nw",
    };
    const result = advanceFront(front, 0.1);
    expect(result.reachedCore).toBe(true);
  });

  it("same seed is deterministic for source timing", () => {
    const a = makePlaying(999);
    const b = makePlaying(999);
    a.stepTicks(100);
    b.stepTicks(100);
    expect(a.getSnapshot().activeSources).toEqual(b.getSnapshot().activeSources);
  });

  it("different seeds can differ", () => {
    const rng1 = new SeededRandom(1);
    const rng2 = new SeededRandom(2);
    expect(rng1.next()).not.toBe(rng2.next());
  });

  it("restart resets state", () => {
    const sim = makePlaying(555);
    sim.toggleCorridor("c-n-n2");
    sim.stepTicks(50);
    sim.reset(555);
    expect(sim.getSnapshot().closedDoorIds.length).toBe(0);
    expect(sim.elapsedMs).toBe(0);
  });

  it("difficulty phase advances at configured times", () => {
    let d = createDirectorState();
    d = updateDirector(d, SIMPLE_PHASES.phase2AtMs + 1, SIMPLE_SOURCES, new SeededRandom(1));
    expect(d.phase).toBeGreaterThanOrEqual(2);
  });

  it("second source activates at phase 2", () => {
    const sim = makePlaying();
    sim.stepTicks(Math.ceil(SIMPLE_PHASES.secondSourceDelayMs / SIMPLE_SIM.tickMs) + 5);
    expect(sim.getSnapshot().activeSources.length).toBeGreaterThanOrEqual(2);
  });

  it("speed increases with phase", () => {
    const d1 = createDirectorState();
    const d5 = { ...createDirectorState(), phase: 5 as const };
    expect(getInfectionSpeed(d5, 130000)).toBeGreaterThan(getInfectionSpeed(d1, 1000));
  });
});

describe("InfectionRouter", () => {
  it("advanceFront marks core breach", () => {
    const front = {
      id: 1,
      path: ["r-w", "core"],
      segmentIndex: 0,
      progress: 0.99,
      sourceId: "src-nw",
    };
    const r = advanceFront(front, 0.02);
    expect(r.reachedCore).toBe(true);
  });
});
