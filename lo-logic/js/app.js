import { PUZZLES, allTiles, tileKey } from "./puzzles.js";
import { emptyGrid, validatePuzzle, usedTileIds } from "./engine.js";
import { renderFragmentsPanel } from "./fragments.js";
import { initTileDrag } from "./drag.js";

const $ = (sel) => document.querySelector(sel);

let puzzleIndex = 0;
/** @type {import('./puzzles.js').Grid} */
let grid = emptyGrid();
let soundOn = false;
let showingSolution = false;

const audio = {
  pick: () => {},
  snap: () => {},
  wrong: () => {},
  win: () => {},
};

function initAudio() {
  const beep = (freq, dur) => {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {
      /* ignore */
    }
  };
  audio.pick = () => beep(520, 0.06);
  audio.snap = () => beep(740, 0.08);
  audio.wrong = () => beep(220, 0.14);
  audio.win = () => beep(880, 0.22);
}

function tileFromId(id) {
  const [shape, color] = id.split(":");
  return { shape, color };
}

function getPuzzle() {
  return PUZZLES[puzzleIndex];
}

function clearGrid() {
  grid = emptyGrid();
  showingSolution = false;
  syncRevealUI();
}

/** @param {import('./puzzles.js').Grid} solution */
function applySolution(solution) {
  grid = solution.map((row) => row.map((cell) => ({ ...cell })));
}

function syncRevealUI() {
  document.body.classList.toggle("lo-reveal-active", showingSolution);
  const board = $("#board");
  board?.classList.toggle("lo-board--revealed", showingSolution);
  const btn = $("#btn-show-solved");
  if (btn) {
    btn.textContent = showingSolution ? "Hide solved" : "Show solved";
    btn.classList.toggle("is-on", showingSolution);
    btn.setAttribute("aria-pressed", String(showingSolution));
  }
}

function toggleShowSolved() {
  showingSolution = !showingSolution;
  if (showingSolution) {
    applySolution(getPuzzle().solution);
  } else {
    grid = emptyGrid();
  }
  syncRevealUI();
  render();
}

function placeTile(r, c, tile) {
  grid[r][c] = { shape: tile.shape, color: tile.color };
}

function removeTile(r, c) {
  grid[r][c] = null;
}

function handleDrop({ tileId, to, from }) {
  const tile = tileFromId(tileId);

  if (from === "tray") {
    if (grid[to.r][to.c]) return;
    placeTile(to.r, to.c, tile);
    audio.snap();
  } else if (from && typeof from === "object") {
    if (to === "tray") {
      removeTile(from.r, from.c);
      audio.pick();
    } else {
      const existing = grid[to.r][to.c];
      removeTile(from.r, from.c);
      if (existing) placeTile(from.r, from.c, existing);
      placeTile(to.r, to.c, tile);
      audio.snap();
    }
  }

  render();
}

function createTileEl(tile) {
  const el = document.createElement("div");
  el.className = "lo-tile";
  el.dataset.tileId = tile.id || tileKey(tile.shape, tile.color);
  el.setAttribute("aria-label", `${tile.color} ${tile.shape}`);

  const shape = document.createElement("span");
  shape.className = `lo-shape lo-shape--${tile.shape} lo-color--${tile.color}`;
  el.appendChild(shape);
  return el;
}

function renderBoard() {
  const board = $("#board");
  if (!board) return;
  board.innerHTML = "";

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const slot = document.createElement("div");
      slot.className = "lo-slot";
      slot.dataset.row = String(r);
      slot.dataset.col = String(c);

      const cell = grid[r][c];
      if (cell) {
        const tile = createTileEl(cell);
        tile.classList.add("lo-tile--placed");
        slot.appendChild(tile);
      }
      board.appendChild(slot);
    }
  }
}

function renderTray() {
  const tray = $("#tray");
  if (!tray) return;
  tray.innerHTML = "";
  const used = usedTileIds(grid);

  for (const t of allTiles()) {
    if (used.has(t.id)) continue;
    tray.appendChild(createTileEl(t));
  }
}

function renderFragments() {
  renderFragmentsPanel($("#fragments"), getPuzzle().fragments);
}

function renderMeta() {
  const puzzle = getPuzzle();
  const num = $("#puzzle-num");
  const diff = $("#difficulty");
  if (num) num.textContent = `Puzzle ${puzzle.id} / ${PUZZLES.length}`;
  if (diff) {
    diff.textContent = puzzle.difficulty;
    diff.className = `lo-diff lo-diff--${puzzle.difficulty}`;
  }
}

function render() {
  renderMeta();
  renderFragments();
  renderBoard();
  renderTray();
  syncRevealUI();
  $("#success")?.classList.add("is-hidden");
  $("#board")?.classList.remove("lo-board--success", "lo-board--shake");
}

function showSuccess() {
  $("#success")?.classList.remove("is-hidden");
  $("#board")?.classList.add("lo-board--success");
  audio.win();
}

function shakeBoard() {
  const board = $("#board");
  board?.classList.add("lo-board--shake");
  setTimeout(() => board?.classList.remove("lo-board--shake"), 500);
}

function checkSolution() {
  const result = validatePuzzle(grid, getPuzzle());
  if (result.ok) {
    showSuccess();
    return;
  }
  audio.wrong();
  shakeBoard();
  const msg = $("#feedback");
  if (msg) {
    msg.textContent = result.message;
    msg.classList.add("lo-feedback--show");
    setTimeout(() => msg.classList.remove("lo-feedback--show"), 2400);
  }
}

function loadPuzzle(index) {
  puzzleIndex = ((index % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
  showingSolution = false;
  clearGrid();
  render();
}

function bindUI() {
  initTileDrag({
    onPick: () => audio.pick(),
    onDrop: handleDrop,
    onCancel: () => audio.pick(),
  });

  $("#btn-check")?.addEventListener("click", checkSolution);
  $("#btn-reset")?.addEventListener("click", () => {
    clearGrid();
    render();
  });

  $("#btn-show-solved")?.addEventListener("click", toggleShowSolved);

  $("#btn-sound")?.addEventListener("click", () => {
    soundOn = !soundOn;
    const btn = $("#btn-sound");
    btn?.classList.toggle("lo-icon-btn--on", soundOn);
    btn?.setAttribute("aria-pressed", String(soundOn));
    if (btn) btn.textContent = soundOn ? "🔊" : "🔇";
  });

  const saved = localStorage.getItem("lo-logic-puzzle");
  if (saved) {
    const n = parseInt(saved, 10);
    if (n >= 1 && n <= PUZZLES.length) puzzleIndex = n - 1;
  }
  loadPuzzle(puzzleIndex);

  $("#btn-next")?.addEventListener("click", () => {
    const next = puzzleIndex + 1;
    localStorage.setItem("lo-logic-puzzle", String(Math.min(next + 1, PUZZLES.length)));
    loadPuzzle(next);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAudio();
  bindUI();
});
