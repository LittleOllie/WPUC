import { gridComplete, tileKey } from "./puzzles.js";

/** @returns {import('./puzzles.js').Grid} */
export function emptyGrid() {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

/** @param {import('./puzzles.js').Grid} a @param {import('./puzzles.js').Grid} b */
function cellsEqual(a, b) {
  return a.shape === b.shape && a.color === b.color;
}

/** @param {import('./puzzles.js').Grid} grid @param {import('./puzzles.js').Grid} solution */
export function matchesSolution(grid, solution) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const g = grid[r][c];
      const s = solution[r][c];
      if (!g || !s || !cellsEqual(g, s)) return false;
    }
  }
  return true;
}

/** @param {import('./puzzles.js').Grid} grid */
export function countPlaced(grid) {
  let n = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c]) n++;
    }
  }
  return n;
}

/** @param {import('./puzzles.js').Grid} grid */
export function usedTileIds(grid) {
  const ids = new Set();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = grid[r][c];
      if (cell) ids.add(tileKey(cell.shape, cell.color));
    }
  }
  return ids;
}

/**
 * @param {import('./puzzles.js').Grid} grid
 * @param {{ solution: import('./puzzles.js').Grid }} puzzle
 */
export function validatePuzzle(grid, puzzle) {
  if (!gridComplete(grid)) {
    return { ok: false, reason: "incomplete", message: "Place all 9 tiles on the board!" };
  }

  if (!matchesSolution(grid, puzzle.solution)) {
    return {
      ok: false,
      reason: "wrong",
      message: "Not quite — compare the clue fragments again!",
    };
  }

  return { ok: true, message: "Perfect! You solved the hidden board!" };
}
