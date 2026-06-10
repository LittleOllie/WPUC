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

const extras = [
  (s) => frag(s, [[0, 2, "shape"], [1, 2, "shape"]]),
  (s) => frag(s, [[0, 1, "shape"], [1, 1, "color"]]),
  (s) => frag(s, [[1, 2, "shape"], [2, 2, "color"]]),
  (s) => frag(s, [[0, 2, "color"], [1, 2, "color"]]),
  (s) => frag(s, [[2, 0], [2, 1], [2, 2]]),
  (s) => frag(s, [[0, 0], [1, 0], [2, 0]]),
];

const bases = {
  1: (s) => [
    frag(s, [[1, 0], [2, 0]]),
    frag(s, [[0, 1], [1, 1]]),
    frag(s, [[1, 1], [2, 1]]),
    frag(s, [[0, 2], [1, 2]]),
    frag(s, [[0, 0], [0, 1], [0, 2]]),
    frag(s, [[0, 0, "color"], [1, 0, "color"]]),
  ],
};

// Use build output base for all
function defaultBase(s) {
  return [
    frag(s, [[1, 0], [2, 0]]),
    frag(s, [[0, 1], [1, 1]]),
    frag(s, [[1, 1], [2, 1]]),
    frag(s, [[0, 2], [1, 2]]),
    frag(s, [[0, 0], [0, 1], [0, 2]]),
    frag(s, [[0, 0, "color"], [1, 0, "color"]]),
  ];
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

for (const p of PUZZLES) {
  const s = p.solution;
  let frags = defaultBase(s);
  if (p.id === 8 || p.id === 10) {
    frags = [
      frag(s, [[1, 0], [2, 0]]),
      frag(s, [[0, 1], [1, 1]]),
      frag(s, [[1, 1], [2, 1]]),
      frag(s, [[0, 0], [0, 1]]),
      frag(s, [[0, 1], [0, 2]]),
      frag(s, [[0, 2, "shape"], [1, 2, "color"]]),
    ];
  }
  for (const add of extras) {
    if (frags.length >= 8) break;
    const trial = [...frags, add(s)];
    if (countGridsForFragments(trial, 2) === 1) frags = trial;
  }
  console.log(`Puzzle ${p.id}: ${frags.length} clues, count=${countGridsForFragments(frags, 2)}`);
  for (const f of frags) {
    console.log(`  frag(sol, [${posCode(s, f)}]),`);
  }
}
