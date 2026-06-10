/**
 * Find all 3×3 grids (9 distinct tiles) satisfying every fragment placement.
 */

import { allTiles } from "./puzzles.js";

/** @typedef {{ dr: number, dc: number, shape: string, color: string, reveal?: string }} FragmentCell */
/** @typedef {{ cells: FragmentCell[] }} Fragment */

/** @param {import('./puzzles.js').Grid} grid @param {FragmentCell} cell */
function cellMatches(cell, tile) {
  const reveal = cell.reveal ?? "full";
  if (reveal === "color") return cell.color === tile.color;
  if (reveal === "shape") return cell.shape === tile.shape;
  return cell.shape === tile.shape && cell.color === tile.color;
}

/** @param {Fragment} fragment */
function placementsForFragment(fragment) {
  const cells = fragment.cells;
  const minDr = Math.min(...cells.map((c) => c.dr));
  const minDc = Math.min(...cells.map((c) => c.dc));
  const out = [];

  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const mapped = cells.map((cell) => ({
        r: br + (cell.dr - minDr),
        c: bc + (cell.dc - minDc),
        cell,
      }));
      if (mapped.every((m) => m.r >= 0 && m.r <= 2 && m.c >= 0 && m.c <= 2)) {
        out.push(mapped);
      }
    }
  }
  return out;
}

/** @param {import('./puzzles.js').Grid} grid @param {Fragment[]} fragments @param {number} filled */
function fragmentsStillPossible(grid, fragments, filled) {
  for (const frag of fragments) {
    let any = false;
    for (const placement of placementsForFragment(frag)) {
      let ok = true;
      for (const { r, c, cell } of placement) {
        const idx = r * 3 + c;
        if (idx >= filled) continue;
        const tile = grid[r][c];
        if (!tile || !cellMatches(cell, tile)) {
          ok = false;
          break;
        }
      }
      if (ok) any = true;
    }
    if (!any) return false;
  }
  return true;
}

/** @param {import('./puzzles.js').Grid} grid @param {Fragment[]} fragments */
function gridSatisfiesAllFragments(grid, fragments) {
  return fragments.every((frag) =>
    placementsForFragment(frag).some((placement) =>
      placement.every(({ r, c, cell }) => cellMatches(cell, grid[r][c])),
    ),
  );
}

/** @param {Fragment[]} fragments @param {number} [limit] */
export function countGridsForFragments(fragments, limit = 2) {
  const tiles = allTiles();
  /** @type {import('./puzzles.js').Grid} */
  const grid = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  const used = new Set();
  let count = 0;

  function solve(idx) {
    if (count >= limit) return;
    if (idx === 9) {
      if (gridSatisfiesAllFragments(grid, fragments)) count++;
      return;
    }
    const r = Math.floor(idx / 3);
    const c = idx % 3;

    for (const tile of tiles) {
      if (used.has(tile.id)) continue;
      grid[r][c] = { shape: tile.shape, color: tile.color };
      used.add(tile.id);
      if (fragmentsStillPossible(grid, fragments, idx + 1)) {
        solve(idx + 1);
      }
      used.delete(tile.id);
      grid[r][c] = null;
      if (count >= limit) return;
    }
  }

  solve(0);
  return count;
}

/** @param {Fragment[]} fragments */
export function findGridsForFragments(fragments) {
  const tiles = allTiles();
  /** @type {import('./puzzles.js').Grid} */
  const grid = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  const used = new Set();
  /** @type {import('./puzzles.js').Grid[]} */
  const results = [];

  function solve(idx) {
    if (idx === 9) {
      if (gridSatisfiesAllFragments(grid, fragments)) {
        results.push(grid.map((row) => row.map((c) => ({ ...c }))));
      }
      return;
    }
    const r = Math.floor(idx / 3);
    const c = idx % 3;

    for (const tile of tiles) {
      if (used.has(tile.id)) continue;
      grid[r][c] = { shape: tile.shape, color: tile.color };
      used.add(tile.id);
      if (fragmentsStillPossible(grid, fragments, idx + 1)) {
        solve(idx + 1);
      }
      used.delete(tile.id);
      grid[r][c] = null;
    }
  }

  solve(0);
  return results;
}

/** @param {import('./puzzles.js').Grid} a @param {import('./puzzles.js').Grid} b */
function gridsEqual(a, b) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x = a[r][c];
      const y = b[r][c];
      if (!x || !y || x.shape !== y.shape || x.color !== y.color) return false;
    }
  }
  return true;
}

/** @param {Fragment[]} fragments @param {import('./puzzles.js').Grid} solution */
export function fragmentsPinUniqueSolution(fragments, solution) {
  const matches = findGridsForFragments(fragments);
  return matches.length === 1 && gridsEqual(matches[0], solution);
}
