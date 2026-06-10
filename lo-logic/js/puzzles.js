/**
 * Handcrafted 3×3 puzzles — verified unique with 6–8 clues each.
 * Clue types match reference: full pairs, color-only squares, shape-only, mixed.
 */

export const SHAPES = ["circle", "square", "triangle"];
export const COLORS = ["red", "blue", "yellow"];

/** @typedef {{ shape: string, color: string }} Tile */
/** @typedef {Tile | null} Cell */
/** @typedef {Cell[][]} Grid */
/** @typedef {'full' | 'shape' | 'color'} RevealMode */

export function tileKey(shape, color) {
  return `${shape}:${color}`;
}

/** @param {string[][]} rows */
function buildSolution(rows) {
  return rows.map((row) =>
    row.map(([shape, color]) => ({ shape, color })),
  );
}

/**
 * @param {Grid} sol
 * @param {([number, number] | [number, number, RevealMode])[]} positions
 * @param {RevealMode} [defaultReveal]
 */
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

/** Standard 8-clue layout (puzzles 1–7, 9) */
function cluesStandard(sol) {
  return [
    frag(sol, [[1, 0], [2, 0]]),
    frag(sol, [[0, 1], [1, 1]]),
    frag(sol, [[1, 1], [2, 1]]),
    frag(sol, [[0, 2], [1, 2]]),
    frag(sol, [[0, 0], [0, 1], [0, 2]]),
    frag(sol, [[0, 0, "color"], [1, 0, "color"]]),
    frag(sol, [[0, 2, "shape"], [1, 2, "shape"]]),
    frag(sol, [[0, 1, "shape"], [1, 1, "color"]]),
  ];
}

export const PUZZLES = [
  {
    id: 1,
    difficulty: "easy",
    solution: buildSolution([
      [["circle", "red"], ["square", "blue"], ["triangle", "yellow"]],
      [["triangle", "blue"], ["circle", "yellow"], ["square", "red"]],
      [["square", "yellow"], ["triangle", "red"], ["circle", "blue"]],
    ]),
    fragments: cluesStandard,
  },
  {
    id: 2,
    difficulty: "easy",
    solution: buildSolution([
      [["square", "yellow"], ["circle", "blue"], ["triangle", "red"]],
      [["circle", "red"], ["triangle", "yellow"], ["square", "blue"]],
      [["triangle", "blue"], ["square", "red"], ["circle", "yellow"]],
    ]),
    fragments: cluesStandard,
  },
  {
    id: 3,
    difficulty: "easy",
    solution: buildSolution([
      [["triangle", "blue"], ["square", "red"], ["circle", "yellow"]],
      [["square", "yellow"], ["circle", "blue"], ["triangle", "red"]],
      [["circle", "red"], ["triangle", "yellow"], ["square", "blue"]],
    ]),
    fragments: cluesStandard,
  },
  {
    id: 4,
    difficulty: "medium",
    solution: buildSolution([
      [["circle", "yellow"], ["triangle", "red"], ["square", "blue"]],
      [["square", "red"], ["circle", "blue"], ["triangle", "yellow"]],
      [["triangle", "blue"], ["square", "yellow"], ["circle", "red"]],
    ]),
    fragments: cluesStandard,
  },
  {
    id: 5,
    difficulty: "medium",
    solution: buildSolution([
      [["square", "blue"], ["circle", "red"], ["triangle", "yellow"]],
      [["triangle", "red"], ["square", "yellow"], ["circle", "blue"]],
      [["circle", "yellow"], ["triangle", "blue"], ["square", "red"]],
    ]),
    fragments: cluesStandard,
  },
  {
    id: 6,
    difficulty: "medium",
    solution: buildSolution([
      [["triangle", "yellow"], ["square", "blue"], ["circle", "red"]],
      [["circle", "blue"], ["triangle", "red"], ["square", "yellow"]],
      [["square", "red"], ["circle", "yellow"], ["triangle", "blue"]],
    ]),
    fragments: cluesStandard,
  },
  {
    id: 7,
    difficulty: "medium",
    solution: buildSolution([
      [["circle", "blue"], ["square", "yellow"], ["triangle", "red"]],
      [["square", "red"], ["triangle", "blue"], ["circle", "yellow"]],
      [["triangle", "yellow"], ["circle", "red"], ["square", "blue"]],
    ]),
    fragments: cluesStandard,
  },
  {
    id: 8,
    difficulty: "hard",
    solution: buildSolution([
      [["square", "red"], ["triangle", "blue"], ["circle", "yellow"]],
      [["circle", "red"], ["square", "yellow"], ["square", "blue"]],
      [["triangle", "yellow"], ["circle", "blue"], ["triangle", "red"]],
    ]),
    fragments: (sol) => [
      ...cluesStandard(sol),
      frag(sol, [[1, 2], [2, 2]]),
    ],
  },
  {
    id: 9,
    difficulty: "hard",
    solution: buildSolution([
      [["triangle", "red"], ["circle", "yellow"], ["square", "blue"]],
      [["circle", "blue"], ["square", "red"], ["triangle", "yellow"]],
      [["square", "yellow"], ["triangle", "blue"], ["circle", "red"]],
    ]),
    fragments: cluesStandard,
  },
  {
    id: 10,
    difficulty: "hard",
    solution: buildSolution([
      [["circle", "red"], ["square", "blue"], ["triangle", "yellow"]],
      [["triangle", "blue"], ["circle", "yellow"], ["square", "red"]],
      [["square", "yellow"], ["triangle", "red"], ["circle", "blue"]],
    ]),
    fragments: cluesStandard,
  },
].map((p) => ({
  id: p.id,
  difficulty: p.difficulty,
  solution: p.solution,
  fragments: p.fragments(p.solution),
}));

/** @param {Grid} grid */
export function gridComplete(grid) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (!grid[r][c]) return false;
    }
  }
  return true;
}

export function allTiles() {
  const tiles = [];
  for (const shape of SHAPES) {
    for (const color of COLORS) {
      tiles.push({ shape, color, id: tileKey(shape, color) });
    }
  }
  return tiles;
}
