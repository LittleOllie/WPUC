import { PUZZLES } from "../js/puzzles.js";
import { countGridsForFragments } from "../js/puzzle-solver.js";

function frag(sol, positions, defaultReveal = "full") {
  const minR = Math.min(...positions.map((p) => p[0]));
  const minC = Math.min(...positions.map((p) => p[1]));
  return {
    cells: positions.map((p) => {
      const r = p[0];
      const c = p[1];
      const reveal = p[2] ?? defaultReveal;
      const t = sol[r][c];
      return { dr: r - minR, dc: c - minC, shape: t.shape, color: t.color, reveal };
    }),
  };
}

function key(f) {
  return JSON.stringify(
    f.cells.map((c) => [c.dr, c.dc, c.shape, c.color, c.reveal]).sort(),
  );
}

/** Reference-style candidates only (no duplicate pair variants) */
function candidates(sol) {
  const list = [];
  const add = (f) => {
    const k = key(f);
    if (!list.some((x) => key(x) === k)) list.push(f);
  };

  for (let r = 0; r < 3; r++) add(frag(sol, [[r, 0], [r, 1], [r, 2]]));
  for (let c = 0; c < 3; c++) add(frag(sol, [[0, c], [1, c], [2, c]]));

  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 2; r++) {
      for (const reveal of ["full", "shape", "color"]) {
        add(frag(sol, [[r, c, reveal], [r + 1, c, reveal]]));
      }
      add(frag(sol, [[r, c, "shape"], [r + 1, c, "color"]]));
    }
  }
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      for (const reveal of ["full", "shape", "color"]) {
        add(frag(sol, [[r, c, reveal], [r, c + 1, reveal]]));
      }
    }
  }
  return list.sort((a, b) => priority(a) - priority(b));
}

function priority(f) {
  const partial = f.cells.some((c) => (c.reveal ?? "full") !== "full");
  const n = f.cells.length;
  if (partial && n === 2) return 0;
  if (n === 2) return 1;
  if (partial && n === 3) return 2;
  if (n === 3) return 3;
  return 4;
}

function fragmentToPositions(sol, f) {
  const minDr = Math.min(...f.cells.map((c) => c.dr));
  const minDc = Math.min(...f.cells.map((c) => c.dc));
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const parts = [];
      let ok = true;
      for (const cell of f.cells) {
        const r = br + (cell.dr - minDr);
        const col = bc + (cell.dc - minDc);
        if (r < 0 || r > 2 || col < 0 || col > 2) {
          ok = false;
          break;
        }
        const t = sol[r][col];
        const reveal = cell.reveal ?? "full";
        if (reveal === "color" && t.color !== cell.color) ok = false;
        else if (reveal === "shape" && t.shape !== cell.shape) ok = false;
        else if (reveal === "full" && (t.shape !== cell.shape || t.color !== cell.color)) ok = false;
        if (!ok) break;
        if (reveal === "full") parts.push(`[${r}, ${col}]`);
        else parts.push(`[${r}, ${col}, "${reveal}"]`);
      }
      if (ok && parts.length === f.cells.length) return parts;
    }
  }
  return null;
}

function buildForPuzzle(sol, targetMin = 7, targetMax = 8, buildMax = 16) {
  const pool = candidates(sol);
  const fullPool = pool.filter((f) =>
    f.cells.every((c) => (c.reveal ?? "full") === "full"),
  );
  const partialPool = pool.filter((f) =>
    f.cells.some((c) => (c.reveal ?? "full") !== "full"),
  );

  const selected = [];
  let count = countGridsForFragments([], 2);

  // Phase 1: anchor with full rows/cols/pairs until unique
  while (count > 1 && selected.length < buildMax) {
    let best = null;
    let bestCount = Infinity;
    const search = count > 2 ? fullPool : [...fullPool, ...partialPool];
    for (const cand of search) {
      if (selected.some((s) => key(s) === key(cand))) continue;
      const n = countGridsForFragments([...selected, cand], 2);
      if (n > 0 && n < bestCount) {
        bestCount = n;
        best = cand;
      }
    }
    if (!best) break;
    selected.push(best);
    count = countGridsForFragments(selected, 2);
  }

  // Phase 2: add partial clues (shape-only, color-only, mixed) until 7–8 total
  const partialTypes = (f) => {
    const reveals = f.cells.map((c) => c.reveal ?? "full");
    if (reveals.every((r) => r === "shape")) return "shape";
    if (reveals.every((r) => r === "color")) return "color";
    if (reveals.includes("shape") && reveals.includes("color")) return "mixed";
    return "other";
  };
  const haveType = (t) =>
    selected.some((s) => partialTypes(s) === t);

  for (const cand of partialPool) {
    if (selected.length >= targetMax) break;
    if (selected.some((s) => key(s) === key(cand))) continue;
    if (countGridsForFragments([...selected, cand], 2) !== 1) continue;
    const t = partialTypes(cand);
    if (selected.length < targetMin || !haveType(t) || t === "mixed") {
      selected.push(cand);
    }
  }

  for (const cand of partialPool) {
    if (selected.length >= targetMax) break;
    if (selected.some((s) => key(s) === key(cand))) continue;
    if (countGridsForFragments([...selected, cand], 2) === 1) {
      selected.push(cand);
    }
  }

  // Prune redundant clues (keep at least targetMin)
  let changed = true;
  while (changed && selected.length > targetMin) {
    changed = false;
    for (let i = 0; i < selected.length; i++) {
      const trial = selected.filter((_, j) => j !== i);
      if (countGridsForFragments(trial, 2) === 1) {
        selected.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  return { selected, count: countGridsForFragments(selected, 2) };
}

for (const p of PUZZLES) {
  const { selected, count } = buildForPuzzle(p.solution, 6, 8);
  console.log(`\n// Puzzle ${p.id} — ${selected.length} clues, ${count} solution(s)`);
  for (const f of selected) {
    const pos = fragmentToPositions(p.solution, f);
    console.log(`      frag(sol, [${pos?.join(", ")}]),`);
  }
}
