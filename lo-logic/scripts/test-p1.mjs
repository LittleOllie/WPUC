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

const vPair = (s, r1, c, r2, reveal) =>
  frag(s, [
    [r1, c, reveal],
    [r2, c, reveal],
  ]);
const vMix = (s, r1, r2, c) =>
  frag(s, [
    [r1, c, "shape"],
    [r2, c, "color"],
  ]);

for (const p of PUZZLES.slice(0, 1)) {
  const sol = p.solution;
  const frags = [
    frag(sol, [[0, 0], [0, 1], [0, 2]]),
    frag(sol, [[0, 0], [1, 0], [2, 0]]),
    frag(sol, [[1, 0], [1, 1], [1, 2]]),
    frag(sol, [[2, 0], [2, 1], [2, 2]]),
    vPair(sol, 0, 0, 1, "color"),
    vPair(sol, 0, 2, 1, "shape"),
    vMix(sol, 0, 1, 1),
    vMix(sol, 1, 2, 2),
  ];
  console.log("Puzzle", p.id, countGridsForFragments(frags, 5));
}
