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

function allCandidates(sol) {
  const list = [];
  const add = (f) => {
    const k = key(f);
    if (!list.some((x) => key(x) === k)) list.push(f);
  };

  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 2; r++) {
      for (const reveal of ["full", "shape", "color"]) {
        add(frag(sol, [[r, c, reveal], [r + 1, c, reveal]]));
      }
      add(frag(sol, [[r, c, "shape"], [r + 1, c, "color"]]));
      add(frag(sol, [[r, c, "color"], [r + 1, c, "shape"]]));
    }
  }
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      for (const reveal of ["full", "shape", "color"]) {
        add(frag(sol, [[r, c, reveal], [r, c + 1, reveal]]));
      }
    }
    add(frag(sol, [[r, 0], [r, 1], [r, 2]]));
  }
  for (let c = 0; c < 3; c++) {
    add(frag(sol, [[0, c], [1, c], [2, c]]));
  }
  return list;
}

function greedyClues(sol, minClues = 6, maxClues = 12) {
  const candidates = allCandidates(sol);
  const selected = [];
  let matchCount = countGridsForFragments([], 2);

  while (matchCount > 1 && selected.length < maxClues) {
    let best = null;
    let bestCount = Infinity;
    for (const cand of candidates) {
      if (selected.some((s) => key(s) === key(cand))) continue;
      const n = countGridsForFragments([...selected, cand], 2);
      if (n > 0 && n < bestCount) {
        bestCount = n;
        best = cand;
      }
    }
    if (!best) break;
    selected.push(best);
    matchCount = countGridsForFragments(selected, 2);
  }

  while (selected.length < minClues && matchCount === 1) {
    let added = false;
    for (const cand of candidates) {
      if (selected.some((s) => key(s) === key(cand))) continue;
      const trial = [...selected, cand];
      if (countGridsForFragments(trial, 2) === 1) {
        selected.push(cand);
        added = true;
        break;
      }
    }
    if (!added) break;
  }

  return { selected, count: countGridsForFragments(selected, 2) };
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

for (const p of PUZZLES) {
  const sol = p.solution;
  const { selected, count } = greedyClues(sol, 6, 9);
  console.log(`\n// Puzzle ${p.id} (${p.difficulty}) — ${selected.length} clues → ${count} solution(s)`);
  for (const f of selected) {
    const pos = fragmentToPositions(sol, f);
    console.log(`      frag(sol, [${pos?.join(", ") ?? "?"}]),`);
  }
}
