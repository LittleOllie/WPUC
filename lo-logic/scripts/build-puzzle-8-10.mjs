import { PUZZLES } from "../js/puzzles.js";
import { findGridsForFragments } from "../js/puzzle-solver.js";

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

function gridsEqual(a, b) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (a[r][c].shape !== b[r][c].shape || a[r][c].color !== b[r][c].color) return false;
    }
  }
  return true;
}

function candidates(sol) {
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
  for (let c = 0; c < 3; c++) add(frag(sol, [[0, c], [1, c], [2, c]]));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) add(frag(sol, [[r, c]]));
  }
  return list;
}

function pinsCorrect(frags, sol) {
  const m = findGridsForFragments(frags);
  return m.length === 1 && gridsEqual(m[0], sol);
}

function build(sol) {
  const pool = candidates(sol);
  const selected = [];

  while (!pinsCorrect(selected, sol) && selected.length < 16) {
    let best = null;
    let bestCount = Infinity;
    for (const cand of pool) {
      if (selected.some((s) => key(s) === key(cand))) continue;
      const m = findGridsForFragments([...selected, cand]);
      const hasCorrect = m.some((g) => gridsEqual(g, sol));
      if (!hasCorrect) continue;
      if (m.length > 0 && m.length < bestCount) {
        bestCount = m.length;
        best = cand;
      }
    }
    if (!best) break;
    selected.push(best);
  }

  if (!pinsCorrect(selected, sol)) {
    for (const cand of pool) {
      if (selected.some((s) => key(s) === key(cand))) continue;
      const m = findGridsForFragments([...selected, cand]);
      if (m.length === 1 && gridsEqual(m[0], sol)) {
        selected.push(cand);
        break;
      }
    }
  }

  return selected;
}

function posCode(sol, f) {
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
        else if (reveal === "full" && (t.shape !== cell.shape || t.color !== cell.color))
          ok = false;
        if (!ok) break;
        parts.push(
          reveal === "full" ? `[${r}, ${col}]` : `[${r}, ${col}, "${reveal}"]`,
        );
      }
      if (ok && parts.length === f.cells.length) return parts.join(", ");
    }
  }
  return "?";
}

for (const id of [8, 10]) {
  const p = PUZZLES.find((x) => x.id === id);
  const selected = build(p.solution);
  console.log(
    `Puzzle ${id}: ${selected.length} clues, ok=${pinsCorrect(selected, p.solution)}`,
  );
  for (const f of selected) {
    console.log(`  frag(sol, [${posCode(p.solution, f)}]),`);
  }
}
