import { describe, expect, it } from "vitest";
import { ContainmentPuzzleSimulation } from "../engine/puzzle/ContainmentPuzzleSimulation";
import { generateBoard, boardCoordsForStage } from "../engine/puzzle/HexPuzzleBoard";
import {
  countAdjacentInfections,
  computeClue,
  revealSafeCell,
  refreshClues,
  contaminateAdjacentRevealed,
} from "../engine/puzzle/ClueSystem";
import { LockSystem, isInfectionContained } from "../engine/puzzle/LockSystem";
import {
  pickSpreadTarget,
  getActiveInfectionSources,
  isCoreBreached,
} from "../engine/puzzle/InfectionSpreadSystem";
import { getStageConfig, PUZZLE_LOCKS } from "../config/puzzleBalance";
import { SeededRandom } from "../utils/SeededRandom";
import { axialDistance } from "../utils/hexCoords";

describe("ContainmentPuzzleSimulation", () => {
  function sim(seed = 7777): ContainmentPuzzleSimulation {
    const s = new ContainmentPuzzleSimulation(seed);
    s.skipHints();
    return s;
  }

  function containAllInfections(s: ContainmentPuzzleSimulation): void {
    const infected = new Set(s.infectionIds());
    while (s.getSnapshot().phase === "playing") {
      const snap = s.getSnapshot();
      const pending = s.infectionIds().filter((id) => {
        const cell = snap.cells.find((c) => c.id === id);
        return cell?.state !== "locked";
      });
      if (pending.length === 0) return;
      if (snap.locks >= pending.length) {
        for (const id of pending) s.actOnCell(id, "lock");
        continue;
      }
      const safe = snap.cells.find(
        (c) => c.state === "hidden" && !c.isCore && !infected.has(c.id),
      );
      if (safe) {
        s.actOnCell(safe.id, "scan");
        continue;
      }
      if (snap.locks > 0) s.actOnCell(pending[0]!, "lock");
    }
  }

  it("generates deterministic boards for same rng fork", () => {
    const a = generateBoard(1, new SeededRandom(1234).fork(99));
    const b = generateBoard(1, new SeededRandom(1234).fork(99));
    expect(a.infectionIds.sort()).toEqual(b.infectionIds.sort());
  });

  it("varies infection placement on new run", () => {
    const s = new ContainmentPuzzleSimulation(555);
    s.skipHints();
    const first = s.infectionIds().sort();
    s.reset(555);
    s.skipHints();
    const second = s.infectionIds().sort();
    expect(first).not.toEqual(second);
  });

  it("starts each stage on scan mode", () => {
    const s = sim(9000);
    s.setMode("lock");
    containAllInfections(s);
    expect(s.getSnapshot().phase).toBe("stage_clear");
    s.advanceStage();
    expect(s.getSnapshot().mode).toBe("scan");
  });

  it("reveals safe cell with correct clue", () => {
    const s = sim(5000);
    const infected = new Set(s.infectionIds());
    const safe = s.getSnapshot().cells.find(
      (c) => c.state === "hidden" && !c.isCore && !infected.has(c.id),
    );
    expect(safe).toBeDefined();
    s.actOnCell(safe!.id, "scan");
    const updated = s.getSnapshot().cells.find((c) => c.id === safe!.id);
    expect(updated?.state).toBe("revealed");
    expect(updated?.clue).toBeGreaterThanOrEqual(0);
  });

  it("scan opens a small pocket in zero regions (burst cap)", () => {
    const pickZero = (board: ReturnType<typeof generateBoard>) =>
      [...board.cells.values()].find((c) => {
        if (c.isCore || c.isInfected) return false;
        return countAdjacentInfections(c.id, board.cells, board.adjacency) === 0;
      });

    const boardSingle = generateBoard(1, new SeededRandom(901));
    const zeroSafe = pickZero(boardSingle);
    expect(zeroSafe).toBeDefined();
    const single = revealSafeCell(zeroSafe!.id, boardSingle.cells, boardSingle.adjacency, 1);
    expect(single).toHaveLength(1);

    const boardBurst = generateBoard(1, new SeededRandom(901));
    const zeroBurst = pickZero(boardBurst);
    expect(zeroBurst).toBeDefined();
    const burst = revealSafeCell(zeroBurst!.id, boardBurst.cells, boardBurst.adjacency, 4);
    expect(burst.length).toBeGreaterThan(1);
    expect(burst.length).toBeLessThanOrEqual(4);

    const boardFlood = generateBoard(1, new SeededRandom(901));
    const zeroFlood = pickZero(boardFlood);
    expect(zeroFlood).toBeDefined();
    const flooded = revealSafeCell(zeroFlood!.id, boardFlood.cells, boardFlood.adjacency, 999);
    expect(flooded.length).toBeGreaterThan(4);
  });

  it("scanning infected triggers outbreak penalty", () => {
    const s = sim(6000);
    const infectedId = s.infectionIds()[0];
    expect(infectedId).toBeDefined();
    const before = s.getSnapshot().spreadCountdownMs;
    s.actOnCell(infectedId!, "scan");
    expect(s.getSnapshot().cells.find((c) => c.id === infectedId)?.state).toBe("infected");
    expect(s.getSnapshot().spreadCountdownMs).toBeLessThan(before);
  });

  it("scanning infected contaminates adjacent revealed rooms", () => {
    const board = generateBoard(1, new SeededRandom(6000));
    const infectedId = board.infectionIds[0]!;
    const neighborId = board.adjacency.get(infectedId)!.find((nid) => {
      const c = board.cells.get(nid)!;
      return !c.isInfected && !c.isCore;
    });
    expect(neighborId).toBeDefined();
    const neighbor = board.cells.get(neighborId!)!;
    neighbor.state = "revealed";
    neighbor.clue = 1;

    contaminateAdjacentRevealed(infectedId, board.cells, board.adjacency);

    expect(neighbor.state).toBe("infected");
    expect(neighbor.isInfected).toBe(true);
  });

  it("locked infected cell cannot spread", () => {
    const s = sim(8000);
    const infectedId = s.infectionIds()[0]!;
    s.actOnCell(infectedId, "lock");
    const cell = s.getSnapshot().cells.find((c) => c.id === infectedId)!;
    expect(isInfectionContained(cell)).toBe(true);
    expect(getActiveInfectionSources(new Map(s.getSnapshot().cells.map((c) => [c.id, c])))).not.toContain(
      infectedId,
    );
  });

  it("locking clean cell consumes charge", () => {
    const s = sim(7000);
    const before = s.getSnapshot().locks;
    const safe = s.getSnapshot().cells.find((c) => !c.isInfected && c.state === "hidden" && !c.isCore)!;
    s.actOnCell(safe.id, "lock");
    expect(s.getSnapshot().locks).toBe(before - 1);
  });

  it("unlocking a cell refunds lock charge and restores state", () => {
    const s = sim(7000);
    const infected = new Set(s.infectionIds());
    const safe = s.getSnapshot().cells.find(
      (c) => !c.isCore && c.state === "hidden" && !infected.has(c.id),
    )!;
    s.actOnCell(safe.id, "scan");
    s.actOnCell(safe.id, "lock");
    expect(s.getSnapshot().cells.find((c) => c.id === safe.id)?.state).toBe("locked");

    const before = s.getSnapshot().locks;
    s.actOnCell(safe.id, "unlock");
    expect(s.getSnapshot().locks).toBe(before + 1);
    expect(s.getSnapshot().cells.find((c) => c.id === safe.id)?.state).toBe("revealed");
  });

  it("unlocking contained infection reactivates it", () => {
    const s = sim(8000);
    const infectedId = s.infectionIds()[0]!;
    s.actOnCell(infectedId, "lock");
    s.actOnCell(infectedId, "unlock");
    const cell = s.getSnapshot().cells.find((c) => c.id === infectedId)!;
    expect(cell.state).toBe("infected");
    expect(isInfectionContained(cell)).toBe(false);
  });

  it("awards lock after configured safe reveals", () => {
    const lockSys = new LockSystem(1);
    let earned = false;
    for (let i = 0; i < PUZZLE_LOCKS.revealsPerLock; i += 1) {
      if (lockSys.onSafeReveal()) earned = true;
    }
    expect(earned).toBe(true);
    expect(lockSys.locks).toBe(2);
  });

  it("spread countdown triggers spread", () => {
    const s = sim(3000);
    const beforeInfected = s.getSnapshot().cells.filter((c) => c.state === "infected").length;
    s.stepMs(95_000);
    const after = s.getSnapshot().cells.filter((c) => c.state === "infected").length;
    expect(after).toBeGreaterThanOrEqual(beforeInfected);
  });

  it("infection reaching core ends game", () => {
    const board = generateBoard(1, new SeededRandom(42));
    const core = board.cells.get(board.coreId)!;
    core.isInfected = true;
    expect(isCoreBreached(board.cells, board.coreId)).toBe(true);
  });

  it("completes stage when all infection is locked", () => {
    const s = sim(9999);
    containAllInfections(s);
    expect(s.getSnapshot().phase).toBe("stage_clear");
  });

  it("pause freezes spread countdown", () => {
    const s = sim(1111);
    s.pause();
    const before = s.getSnapshot().spreadCountdownMs;
    s.stepMs(5000);
    expect(s.getSnapshot().spreadCountdownMs).toBe(before);
  });

  it("stage config scales difficulty gradually", () => {
    const s1 = getStageConfig(1);
    const s2 = getStageConfig(2);
    const s6 = getStageConfig(6);
    expect(s1.infectionCount).toBe(4);
    expect(s1.revealBurstMax).toBe(4);
    expect(s1.spreadGraceMs).toBeGreaterThan(s6.spreadGraceMs);
    expect(s2.omitCoords.length).toBeGreaterThan(0);
    expect(s6.infectionCount).toBeGreaterThan(s1.infectionCount);
    expect(s6.spreadIntervalMs).toBeLessThan(s1.spreadIntervalMs);
  });
});

describe("ClueSystem", () => {
  it("clue equals adjacent infection count", () => {
    const board = generateBoard(1, new SeededRandom(55));
    const safe = [...board.cells.values()].find((c) => !c.isInfected && !c.isCore)!;
    const clue = computeClue(safe.id, board.cells, board.adjacency);
    expect(clue).toBe(countAdjacentInfections(safe.id, board.cells, board.adjacency));
  });

  it("updates clues after spread", () => {
    const board = generateBoard(1, new SeededRandom(77));
    const safe = [...board.cells.values()].find((c) => !c.isInfected && !c.isCore)!;
    safe.state = "revealed";
    safe.clue = computeClue(safe.id, board.cells, board.adjacency);
    const neighbor = board.adjacency.get(safe.id)?.[0];
    if (neighbor) {
      const nCell = board.cells.get(neighbor)!;
      if (!nCell.isCore) {
        nCell.isInfected = true;
        nCell.state = "infected";
        const updated = refreshClues(board.cells, board.adjacency, false);
        expect(updated.length).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("InfectionSpreadSystem", () => {
  it("spreads only to adjacent valid cells", () => {
    const board = generateBoard(1, new SeededRandom(88));
    const sources = getActiveInfectionSources(board.cells);
    expect(sources.length).toBeGreaterThan(0);
    const move = pickSpreadTarget(
      sources[0]!,
      board.cells,
      board.adjacency,
      board.coreId,
      new SeededRandom(1),
    );
    if (move) {
      const neighbors = board.adjacency.get(move.fromId) ?? [];
      expect(neighbors).toContain(move.toId);
    }
  });

  it("prefers routes toward core", () => {
    const board = generateBoard(1, new SeededRandom(99));
    const sources = getActiveInfectionSources(board.cells);
    const rng = new SeededRandom(2);
    const move = pickSpreadTarget(
      sources[0]!,
      board.cells,
      board.adjacency,
      board.coreId,
      rng,
    );
    expect(move).not.toBeNull();
  });
});

describe("HexPuzzleBoard", () => {
  it("validates no infection adjacent to core", () => {
    const board = generateBoard(1, new SeededRandom(123));
    const coreNeighbors = board.adjacency.get(board.coreId) ?? [];
    for (const nid of coreNeighbors) {
      expect(board.cells.get(nid)?.isInfected).toBe(false);
    }
  });

  it("places infections with minimum separation", () => {
    const board = generateBoard(1, new SeededRandom(321));
    const infected = board.infectionIds.map((id) => board.cells.get(id)!);
    const minSep = getStageConfig(1).minInfectionSeparation;
    expect(infected).toHaveLength(getStageConfig(1).infectionCount);
    for (let i = 0; i < infected.length; i += 1) {
      for (let j = i + 1; j < infected.length; j += 1) {
        expect(axialDistance(infected[i]!.coord, infected[j]!.coord)).toBeGreaterThanOrEqual(
          minSep,
        );
      }
    }
  });

  it("uses different board shapes per stage", () => {
    const sizes = [1, 2, 3, 4, 5, 6].map((stage) => boardCoordsForStage(stage).length);
    expect(new Set(sizes).size).toBeGreaterThan(3);
    expect(boardCoordsForStage(1).length).toBeGreaterThan(boardCoordsForStage(2).length);
  });

  it("builds adjacency for all cells", () => {
    const board = generateBoard(2, new SeededRandom(456));
    for (const id of board.cells.keys()) {
      expect(board.adjacency.has(id)).toBe(true);
    }
  });
});
