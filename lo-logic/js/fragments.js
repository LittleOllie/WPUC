/**
 * Visual clue fragments — partial connected groups from the hidden solution.
 * Cells may reveal full tile, shape only, or color only (never rotated).
 */

/** @typedef {{ shape: string, color: string }} Tile */
/** @typedef {'full' | 'shape' | 'color'} RevealMode */
/** @typedef {{ dr: number, dc: number, shape: string, color: string, reveal: RevealMode }} FragmentCell */
/** @typedef {{ cells: FragmentCell[] }} Fragment */

const TILE_PX = 36;

/** @param {FragmentCell} cell */
export function createMiniTileEl(cell) {
  const el = document.createElement("div");
  const reveal = cell.reveal ?? "full";
  el.className = `lo-frag-tile lo-frag-tile--${reveal}`;

  if (reveal === "color") {
    const swatch = document.createElement("span");
    swatch.className = `lo-frag-swatch lo-frag-swatch--${cell.color}`;
    swatch.setAttribute("aria-label", `${cell.color} (color only)`);
    const tag = document.createElement("span");
    tag.className = "lo-frag-swatch-tag";
    tag.textContent = "color";
    el.appendChild(swatch);
    el.appendChild(tag);
    return el;
  }

  if (reveal === "shape") {
    const shape = document.createElement("span");
    shape.className = `lo-shape lo-shape--${cell.shape} lo-frag-shape-only`;
    shape.setAttribute("aria-label", `${cell.shape} (shape only)`);
    el.appendChild(shape);
    return el;
  }

  const shape = document.createElement("span");
  shape.className = `lo-shape lo-shape--${cell.shape} lo-color--${cell.color}`;
  shape.setAttribute("aria-label", `${cell.color} ${cell.shape}`);
  el.appendChild(shape);
  return el;
}

/** @param {Fragment} fragment */
export function renderFragmentEl(fragment) {
  const wrap = document.createElement("div");
  wrap.className = "lo-fragment";

  const cells = fragment.cells;
  const maxR = Math.max(...cells.map((c) => c.dr));
  const maxC = Math.max(...cells.map((c) => c.dc));

  const grid = document.createElement("div");
  grid.className = "lo-fragment-grid";
  grid.style.setProperty("--frag-rows", String(maxR + 1));
  grid.style.setProperty("--frag-cols", String(maxC + 1));

  const occupied = new Set(cells.map((c) => `${c.dr},${c.dc}`));

  for (let dr = 0; dr <= maxR; dr++) {
    for (let dc = 0; dc <= maxC; dc++) {
      const key = `${dr},${dc}`;
      if (!occupied.has(key)) {
        const spacer = document.createElement("div");
        spacer.className = "lo-frag-spacer";
        spacer.style.gridRow = String(dr + 1);
        spacer.style.gridColumn = String(dc + 1);
        grid.appendChild(spacer);
        continue;
      }
      const cell = cells.find((c) => c.dr === dr && c.dc === dc);
      const tile = createMiniTileEl(cell);
      tile.style.gridRow = String(dr + 1);
      tile.style.gridColumn = String(dc + 1);
      grid.appendChild(tile);
    }
  }

  wrap.appendChild(grid);
  return wrap;
}

/** @param {Fragment[]} fragments */
export function renderFragmentsPanel(container, fragments) {
  if (!container) return;
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "lo-fragments-list";

  fragments.forEach((frag, index) => {
    const card = document.createElement("div");
    card.className = "lo-fragment-card";
    const num = document.createElement("span");
    num.className = "lo-fragment-num";
    num.textContent = String(index + 1);
    card.appendChild(num);
    card.appendChild(renderFragmentEl(frag));
    list.appendChild(card);
  });

  container.appendChild(list);
}

/**
 * Verify fragment fits on solution as shown (no rotation).
 */
export function fragmentMatchesSolution(fragment, solution) {
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      if (fitsAt(fragment.cells, solution, br, bc)) return true;
    }
  }
  return false;
}

/** @param {FragmentCell[]} cells */
function fitsAt(cells, solution, baseR, baseC) {
  const minR = Math.min(...cells.map((c) => c.dr));
  const minC = Math.min(...cells.map((c) => c.dc));
  for (const c of cells) {
    const r = baseR + (c.dr - minR);
    const col = baseC + (c.dc - minC);
    if (r < 0 || r > 2 || col < 0 || col > 2) return false;
    const s = solution[r][col];
    if (!s || !cellMatches(c, s)) return false;
  }
  return true;
}

/** @param {FragmentCell} cell @param {Tile} tile */
function cellMatches(cell, tile) {
  const reveal = cell.reveal ?? "full";
  if (reveal === "color") return cell.color === tile.color;
  if (reveal === "shape") return cell.shape === tile.shape;
  return cell.shape === tile.shape && cell.color === tile.color;
}

export { TILE_PX };
