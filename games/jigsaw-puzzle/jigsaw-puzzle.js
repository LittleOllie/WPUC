/**
 * Jigsaw Puzzle — drag rounded tiles from the tray onto the board.
 * Easy 3×3, Medium 4×4, Hard 6×6, Expert 8×8. Shared image pool with Memory Match.
 */
import { labPuzzleImageSrc, pickRandomLabPuzzleImage } from "../../scripts/labs-puzzle-images.js";

const SNAP_RATIO = 0.42;
const TRAY_PIECE_SCALE = 0.92;

const boardWrap = document.getElementById("jigsaw-board-wrap");
const boardEl = document.getElementById("jigsaw-board");
const trayEl = document.getElementById("jigsaw-tray");
const dragLayerEl = document.getElementById("jigsaw-drag-layer");
const leadEl = document.getElementById("jigsaw-lead");
const difficultySelect = document.getElementById("difficulty-select");
const btnStart = document.getElementById("btn-start");
const btnNewImage = document.getElementById("btn-new-image");
const uploadImageBtn = document.getElementById("uploadImageBtn");
const imageUpload = document.getElementById("imageUpload");
const leaderboardModal = document.getElementById("leaderboardModal");
const leaderboardList = document.getElementById("leaderboardList");
const confettiCanvas = document.getElementById("jigsaw-confetti");
const winOverlay = document.getElementById("jigsawWinOverlay");
const winStatsEl = document.getElementById("jigsawWinStats");
const winBestEl = document.getElementById("jigsawWinBest");
const winPlayAgainBtn = document.getElementById("jigsawPlayAgainBtn");

const submitSection = document.getElementById("jigsawLeaderboardSubmitSection");
const yourScoreEl = document.getElementById("jigsawLeaderboardYourScore");
const nameInput = document.getElementById("jigsawLeaderboardNameInput");
const submitBtn = document.getElementById("jigsawLeaderboardSubmitBtn");
const lbPlayAgainBtn = document.getElementById("jigsawLeaderboardPlayAgainBtn");
const submitMsg = document.getElementById("jigsawLeaderboardSubmitMsg");

let gridSize = 3;
let currentImageName = pickRandomLabPuzzleImage();
let imageSrc = labPuzzleImageSrc(currentImageName);
let isUploadedImage = false;
let pieces = [];
let moves = 0;
let remaining = 0;
let elapsedSeconds = 0;
let timerId = null;
let gameWon = false;
let hasSubmittedThisWin = false;
let cellSize = 0;
let trayPieceSize = 52;
let dragState = null;
let gamePhase = "preview";
let isScrambling = false;
let audioCtx = null;
let confettiParts = [];
let confettiAnim = null;
let soundsEnabled = true;

function formatTime(seconds) {
  const ui = window.LabsLeaderboardUI;
  if (ui && typeof ui.formatTime === "function") return ui.formatTime(seconds);
  const m = Math.floor(seconds / 60);
  const r = Math.floor(seconds % 60);
  return m + ":" + (r < 10 ? "0" : "") + r;
}

function getStoredLbName() {
  const ui = window.LabsLeaderboardUI;
  if (ui && typeof ui.getStoredPlayerName === "function") {
    return ui.getStoredPlayerName();
  }
  return "";
}

function saveLbName(name) {
  const ui = window.LabsLeaderboardUI;
  if (ui && typeof ui.setStoredPlayerName === "function") {
    ui.setStoredPlayerName(name);
  }
}

function renderLbRows(container, rows) {
  const ui = window.LabsLeaderboardUI;
  if (ui && typeof ui.renderLeaderboardList === "function") {
    ui.renderLeaderboardList(container, rows, { mode: "time-moves" });
    return;
  }
  if (!container) return;
  container.innerHTML = "<p class=\"leaderboard-unavailable\">Leaderboard UI unavailable.</p>";
}

function getDifficultyKey(size) {
  const n = size != null ? size : gridSize;
  if (n === 3) return "easy";
  if (n === 4) return "medium";
  if (n === 6) return "hard";
  return "expert";
}

function getDifficultyLabel(key) {
  if (key === "easy") return "Easy (3×3)";
  if (key === "medium") return "Medium (4×4)";
  if (key === "hard") return "Hard (6×6)";
  return "Expert (8×8)";
}

function bestStorageKey(difficulty) {
  return "lo_jigsaw_best_" + difficulty;
}

function readPersonalBest(difficulty) {
  try {
    const raw = localStorage.getItem(bestStorageKey(difficulty));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function isBetterRun(a, b) {
  if (!b) return true;
  if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds < b.timeSeconds;
  return (a.moves || 0) < (b.moves || 0);
}

function writePersonalBest(difficulty, entry) {
  try {
    localStorage.setItem(
      bestStorageKey(difficulty),
      JSON.stringify({
        timeSeconds: entry.timeSeconds,
        moves: entry.moves,
        completedAt: entry.completedAt || Date.now(),
      })
    );
  } catch (_) {}
}

function formatBestLine(best) {
  if (!best) return "Best: — (complete a puzzle to set one!)";
  const date = new Date(best.completedAt || Date.now());
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    "Best: " +
    formatTime(best.timeSeconds) +
    " • " +
    best.moves +
    " moves • " +
    dateStr
  );
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function pieceBgStyle(row, col) {
  const denom = gridSize - 1 || 1;
  const x = (col / denom) * 100;
  const y = (row / denom) * 100;
  const size = gridSize * 100;
  return {
    backgroundImage: "url(\"" + imageSrc + "\")",
    backgroundSize: size + "% " + size + "%",
    backgroundPosition: x + "% " + y + "%",
  };
}

function applyBgToEl(el, row, col) {
  const style = pieceBgStyle(row, col);
  el.style.backgroundImage = style.backgroundImage;
  el.style.backgroundSize = style.backgroundSize;
  el.style.backgroundPosition = style.backgroundPosition;
}

function updateStats() {
  /* Stats UI hidden — moves/time still tracked for win screen & leaderboard */
}

function startTimer() {
  if (timerId) return;
  timerId = window.setInterval(function () {
    elapsedSeconds += 1;
    updateStats();
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function resetStats() {
  stopTimer();
  moves = 0;
  elapsedSeconds = 0;
  gameWon = false;
  hasSubmittedThisWin = false;
  updateStats();
}

function measureLayout() {
  if (!boardEl || !boardWrap) return;
  const rect = boardEl.getBoundingClientRect();
  const innerGap = parseFloat(getComputedStyle(boardEl).gap) || 1;
  const padding =
    (parseFloat(getComputedStyle(boardEl).paddingLeft) || 0) +
    (parseFloat(getComputedStyle(boardEl).paddingRight) || 0);
  const totalGap = innerGap * (gridSize - 1);
  cellSize = Math.max(24, (rect.width - padding - totalGap) / gridSize);

  const trayCols = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(gridSize * gridSize))));
  trayPieceSize = Math.max(40, Math.min(cellSize * TRAY_PIECE_SCALE, 72));
  if (trayEl) {
    trayEl.style.setProperty("--jigsaw-tray-piece", trayPieceSize + "px");
    trayEl.style.gridTemplateColumns =
      "repeat(" + trayCols + ", minmax(" + trayPieceSize + "px, 1fr))";
  }
}

function buildBoardSlots() {
  if (!boardEl) return;
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = "repeat(" + gridSize + ", 1fr)";
  boardEl.style.gridTemplateRows = "repeat(" + gridSize + ", 1fr)";

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const slot = document.createElement("div");
      slot.className = "jigsaw-puzzle__slot";
      slot.dataset.row = String(row);
      slot.dataset.col = String(col);
      slot.setAttribute("role", "gridcell");
      boardEl.appendChild(slot);
    }
  }
}

function createPieceEl(piece) {
  const el = document.createElement("div");
  el.className = "jigsaw-puzzle__piece";
  el.dataset.id = String(piece.id);
  el.dataset.row = String(piece.row);
  el.dataset.col = String(piece.col);
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", "Puzzle piece row " + (piece.row + 1) + " column " + (piece.col + 1));
  applyBgToEl(el, piece.row, piece.col);
  el.addEventListener("pointerdown", onPiecePointerDown);
  piece.el = el;
  return el;
}

function countRemaining() {
  return pieces.filter(function (p) { return !p.placed; }).length;
}

function syncRemaining() {
  remaining = countRemaining();
  updateStats();
}

function setGamePhase(phase) {
  gamePhase = phase;
  document.body.classList.toggle("jigsaw-puzzle-page--preview", phase === "preview");
  document.body.classList.toggle("jigsaw-puzzle-page--playing", phase === "playing");

  if (btnStart) {
    btnStart.classList.toggle("hidden", phase !== "preview");
    btnStart.disabled = isScrambling;
  }
  if (leadEl) {
    leadEl.textContent =
      phase === "preview"
        ? "See the picture, press Start, then rebuild it from the tray."
        : "Drag pieces from the tray to rebuild the picture.";
  }
  if (difficultySelect) {
    difficultySelect.disabled = isScrambling;
  }
  if (btnNewImage) btnNewImage.disabled = isScrambling;
  if (uploadImageBtn) uploadImageBtn.disabled = isScrambling;
  if (gamePhase === "preview") {
    updateTrayMinHeight(pieces.length || gridSize * gridSize);
  }
}

function showPreviewBoard() {
  if (!boardEl || !trayEl) return;
  trayEl.innerHTML = "";
  pieces.forEach(function (piece) {
    piece.placed = false;
    piece.boardSlot = null;
    piece.el.classList.remove(
      "jigsaw-puzzle__piece--locked",
      "jigsaw-puzzle__piece--misplaced",
      "jigsaw-puzzle__piece--on-board",
      "jigsaw-puzzle__piece--scrambling"
    );
    piece.el.classList.add("jigsaw-puzzle__piece--preview");
    const slot = slotAt(piece.row, piece.col);
    if (slot) slot.appendChild(piece.el);
  });
  syncRemaining();
  updateTrayMinHeight(pieces.length);
}

function getTrayColumnCount() {
  if (!trayEl) return 3;
  const match = trayEl.style.gridTemplateColumns.match(/repeat\((\d+)/);
  if (match) return parseInt(match[1], 10) || 3;
  return Math.max(3, Math.min(8, Math.ceil(Math.sqrt(gridSize * gridSize))));
}

function updateTrayMinHeight(pieceCount) {
  if (!trayEl) return;
  const cols = getTrayColumnCount();
  const rows = Math.max(1, Math.ceil(pieceCount / cols));
  const gap = 4;
  const padding = 14;
  trayEl.style.minHeight = rows * trayPieceSize + Math.max(0, rows - 1) * gap + padding + "px";
}

function scrambleToTray() {
  if (gamePhase !== "preview" || isScrambling) return;
  isScrambling = true;
  setGamePhase("preview");

  pieces.forEach(function (piece) {
    if (!piece.el) return;
    piece.el.classList.remove("jigsaw-puzzle__piece--preview", "jigsaw-puzzle__piece--scrambling");
    piece.el.remove();
  });

  trayEl.innerHTML = "";
  measureLayout();
  updateTrayMinHeight(pieces.length);
  buildTray();

  if (dragLayerEl) dragLayerEl.innerHTML = "";
  recoverStrayPieces();
  isScrambling = false;
  setGamePhase("playing");
}

function buildTray() {
  if (!trayEl) return;
  trayEl.innerHTML = "";
  const loose = shuffleArray(
    pieces.filter(function (p) { return !p.placed && !p.boardSlot; })
  );
  loose.forEach(function (piece) {
    piece.el.classList.remove("jigsaw-puzzle__piece--preview");
    trayEl.appendChild(piece.el);
  });
  syncRemaining();
}

function buildPieces() {
  pieces = [];
  let id = 0;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const piece = {
        id: id++,
        row: row,
        col: col,
        placed: false,
        boardSlot: null,
        el: null,
      };
      createPieceEl(piece);
      pieces.push(piece);
    }
  }
}

function getImageUrl() {
  return isUploadedImage ? imageSrc : labPuzzleImageSrc(currentImageName);
}

function preloadImage(src, callback) {
  const img = new Image();
  img.onload = function () { callback(null, img); };
  img.onerror = function () { callback(new Error("Image failed to load")); };
  img.src = src;
}

function startPuzzle() {
  if (!boardEl || !trayEl) return;
  cancelActiveDrag();
  purgeStrayPieces();
  resetStats();
  hideWinOverlays();
  dragState = null;
  isScrambling = false;
  imageSrc = getImageUrl();
  buildBoardSlots();
  buildPieces();
  measureLayout();
  showPreviewBoard();
  setGamePhase("preview");
  recoverStrayPieces();
}

function getDragMount() {
  return dragLayerEl || document.body;
}

function mountForDrag(el) {
  getDragMount().appendChild(el);
}

function pieceHome(piece) {
  if (!piece || !piece.el) return "gone";
  if (piece.el.closest(".jigsaw-puzzle__slot")) return "board";
  if (piece.el.closest("#jigsaw-tray")) return "tray";
  if (piece.el.closest("#jigsaw-drag-layer")) return "drag";
  if (piece.el.parentElement === document.body) return "body";
  return "gone";
}

function purgeStrayPieces() {
  if (dragLayerEl) dragLayerEl.innerHTML = "";
  document.querySelectorAll("#jigsaw-drag-layer .jigsaw-puzzle__piece, body > .jigsaw-puzzle__piece").forEach(function (el) {
    el.remove();
  });
}

function recoverStrayPieces() {
  pieces.forEach(function (piece) {
    if (piece.placed || !piece.el) return;
    const home = pieceHome(piece);
    if (home === "tray" || home === "board") return;

    clearPieceDragStyles(piece.el);
    if (piece.boardSlot) {
      const slot = slotAt(piece.boardSlot.row, piece.boardSlot.col);
      if (slot && slotIsEmpty(slot)) {
        placePieceWrong(piece, slot);
        return;
      }
    }
    returnPieceToTray(piece, false);
  });
}

function addDocumentDragListeners(el) {
  document.addEventListener("pointermove", onPiecePointerMove, { passive: false });
  document.addEventListener("pointerup", onPiecePointerUp);
  document.addEventListener("pointercancel", onPiecePointerUp);
  if (el) {
    el.addEventListener("pointermove", onPiecePointerMove, { passive: false });
    el.addEventListener("pointerup", onPiecePointerUp);
    el.addEventListener("pointercancel", onPiecePointerUp);
  }
}

function removeDocumentDragListeners(el) {
  document.removeEventListener("pointermove", onPiecePointerMove);
  document.removeEventListener("pointerup", onPiecePointerUp);
  document.removeEventListener("pointercancel", onPiecePointerUp);
  if (el) {
    el.removeEventListener("pointermove", onPiecePointerMove);
    el.removeEventListener("pointerup", onPiecePointerUp);
    el.removeEventListener("pointercancel", onPiecePointerUp);
  }
}

function cancelActiveDrag() {
  if (!dragState) return;
  const state = dragState;
  const dragEl = state.piece && state.piece.el;
  dragState = null;
  removeDocumentDragListeners(dragEl);

  const piece = state.piece;
  if (!piece || !piece.el || piece.placed) return;

  clearPieceDragStyles(piece.el);
  document.querySelectorAll(".jigsaw-puzzle__slot--highlight").forEach(function (node) {
    node.classList.remove("jigsaw-puzzle__slot--highlight");
  });

  if (state.originSlot && slotIsEmpty(state.originSlot)) {
    placePieceWrong(piece, state.originSlot);
  } else if (pieceHome(piece) !== "tray") {
    returnPieceToTray(piece, false);
  }
}

function runWithImage() {
  preloadImage(getImageUrl(), function (err) {
    if (err) {
      if (!isUploadedImage) {
        currentImageName = pickRandomLabPuzzleImage();
        imageSrc = labPuzzleImageSrc(currentImageName);
        preloadImage(imageSrc, function (err2) {
          if (!err2) startPuzzle();
        });
      }
      return;
    }
    startPuzzle();
  });
}

function slotAt(row, col) {
  return boardEl && boardEl.querySelector(
    '.jigsaw-puzzle__slot[data-row="' + row + '"][data-col="' + col + '"]'
  );
}

function slotIsEmpty(slot) {
  return slot && !slot.querySelector(".jigsaw-puzzle__piece");
}

function slotCoords(slot) {
  return {
    row: parseInt(slot.dataset.row, 10),
    col: parseInt(slot.dataset.col, 10),
  };
}

function isCorrectSlot(piece, slot) {
  const coords = slotCoords(slot);
  return coords.row === piece.row && coords.col === piece.col;
}

function findSnapTarget(clientX, clientY) {
  const threshold = cellSize * SNAP_RATIO;
  let best = null;
  let bestDist = Infinity;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const slot = slotAt(row, col);
      if (!slotIsEmpty(slot)) continue;
      const rect = slot.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        best = slot;
      }
    }
  }
  return best;
}

function clearPieceDragStyles(el) {
  el.classList.remove("jigsaw-puzzle__piece--dragging");
  el.style.position = "";
  el.style.left = "";
  el.style.top = "";
  el.style.width = "";
  el.style.height = "";
  el.style.margin = "";
  el.style.transform = "";
  el.style.transition = "";
  el.style.touchAction = "";
  el.style.zIndex = "";
}

function moveDraggedPiece(clientX, clientY) {
  if (!dragState || !dragState.piece.el) return;
  const el = dragState.piece.el;
  el.style.left = clientX - dragState.offsetX + "px";
  el.style.top = clientY - dragState.offsetY + "px";

  document.querySelectorAll(".jigsaw-puzzle__slot--highlight").forEach(function (node) {
    node.classList.remove("jigsaw-puzzle__slot--highlight");
  });
  const target = findSnapTarget(clientX, clientY);
  if (target) target.classList.add("jigsaw-puzzle__slot--highlight");
}

function playSnapSound() {
  if (!soundsEnabled) return;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 620;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (_) {}
}

function placePieceOnBoard(piece, slot) {
  clearPieceDragStyles(piece.el);
  piece.el.classList.remove("jigsaw-puzzle__piece--misplaced");
  piece.el.classList.add("jigsaw-puzzle__piece--on-board", "jigsaw-puzzle__piece--snap");
  slot.appendChild(piece.el);
  piece.boardSlot = slotCoords(slot);

  window.setTimeout(function () {
    piece.el.classList.remove("jigsaw-puzzle__piece--snap");
  }, 280);
}

function lockPiece(piece, slot) {
  piece.placed = true;
  piece.boardSlot = { row: piece.row, col: piece.col };
  clearPieceDragStyles(piece.el);
  piece.el.classList.remove("jigsaw-puzzle__piece--misplaced", "jigsaw-puzzle__piece--on-board");
  piece.el.classList.add("jigsaw-puzzle__piece--locked", "jigsaw-puzzle__piece--snap");
  slot.appendChild(piece.el);

  window.setTimeout(function () {
    piece.el.classList.remove("jigsaw-puzzle__piece--snap");
    piece.el.classList.add("jigsaw-puzzle__piece--sparkle");
    window.setTimeout(function () {
      piece.el.classList.remove("jigsaw-puzzle__piece--sparkle");
    }, 560);
  }, 30);

  syncRemaining();
  playSnapSound();

  if (countRemaining() === 0) {
    onWin();
  }
}

function placePieceWrong(piece, slot) {
  placePieceOnBoard(piece, slot);
  piece.el.classList.add("jigsaw-puzzle__piece--misplaced");
  playSnapSound();
}

function returnPieceToTray(piece, animate) {
  if (piece.placed || !trayEl) return;
  clearPieceDragStyles(piece.el);
  piece.el.classList.remove("jigsaw-puzzle__piece--on-board", "jigsaw-puzzle__piece--misplaced");
  piece.boardSlot = null;

  if (animate) {
    piece.el.style.transition = "transform 0.25s ease";
    piece.el.style.transform = "scale(0.94)";
    window.setTimeout(function () {
      piece.el.style.transition = "";
      piece.el.style.transform = "";
    }, 260);
  }

  trayEl.appendChild(piece.el);
  syncRemaining();
}

function onPiecePointerDown(e) {
  if (gameWon || dragState || gamePhase !== "playing" || isScrambling) return;
  if (e.button != null && e.button !== 0) return;
  const el = e.currentTarget;
  if (el.classList.contains("jigsaw-puzzle__piece--locked")) return;

  const id = parseInt(el.dataset.id, 10);
  const piece = pieces.find(function (p) { return p.id === id; });
  if (!piece || piece.placed) return;

  e.preventDefault();
  e.stopPropagation();

  const slotParent = el.closest(".jigsaw-puzzle__slot");
  const rect = el.getBoundingClientRect();
  dragState = {
    piece: piece,
    pointerId: e.pointerId,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    width: rect.width,
    height: rect.height,
    fromTray: el.parentElement === trayEl,
    fromBoard: !!slotParent,
    originSlot: slotParent || null,
    lastClientX: e.clientX,
    lastClientY: e.clientY,
  };

  if (dragState.fromTray && piece.el.parentElement === trayEl) {
    piece.el.remove();
  } else if (dragState.fromBoard && slotParent) {
    piece.boardSlot = null;
    piece.el.remove();
  }

  el.classList.add("jigsaw-puzzle__piece--dragging");
  el.style.transition = "none";
  el.style.transform = "none";
  el.style.touchAction = "none";
  el.style.position = "fixed";
  el.style.margin = "0";
  el.style.width = dragState.width + "px";
  el.style.height = dragState.height + "px";
  el.style.left = rect.left + "px";
  el.style.top = rect.top + "px";
  el.style.zIndex = "100";
  mountForDrag(el);

  try {
    el.setPointerCapture(e.pointerId);
  } catch (_) {}

  addDocumentDragListeners(el);
  moveDraggedPiece(e.clientX, e.clientY);
}

function onPiecePointerMove(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  e.preventDefault();
  dragState.lastClientX = e.clientX;
  dragState.lastClientY = e.clientY;
  moveDraggedPiece(e.clientX, e.clientY);
}

function finishDrag(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const state = dragState;
  dragState = null;

  const piece = state.piece;
  const el = piece.el;

  try {
    if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  } catch (_) {}

  removeDocumentDragListeners(el);

  document.querySelectorAll(".jigsaw-puzzle__slot--highlight").forEach(function (node) {
    node.classList.remove("jigsaw-puzzle__slot--highlight");
  });

  const dropX = Number.isFinite(e.clientX) ? e.clientX : state.lastClientX;
  const dropY = Number.isFinite(e.clientY) ? e.clientY : state.lastClientY;

  if (!piece.placed) {
    moves += 1;
    if (moves === 1) startTimer();
    updateStats();
  }

  const target = findSnapTarget(dropX, dropY);
  if (target) {
    if (isCorrectSlot(piece, target)) {
      lockPiece(piece, target);
    } else {
      placePieceWrong(piece, target);
    }
  } else if (state.originSlot && slotIsEmpty(state.originSlot)) {
    placePieceWrong(piece, state.originSlot);
  } else {
    returnPieceToTray(piece, true);
  }

  recoverStrayPieces();
}

function onPiecePointerUp(e) {
  finishDrag(e);
}

function launchConfetti() {
  if (!confettiCanvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = confettiCanvas.getContext("2d");
  if (!ctx) return;

  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  confettiParts = [];
  const colors = ["#ffd84d", "#6fd3f2", "#8fd36c", "#ff8fab", "#b388ff", "#fff"];

  for (let i = 0; i < 90; i++) {
    confettiParts.push({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * confettiCanvas.height * 0.25,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 120 + Math.random() * 60,
    });
  }

  if (confettiAnim) window.cancelAnimationFrame(confettiAnim);

  function tick() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = 0;
    confettiParts.forEach(function (p) {
      if (p.life <= 0) return;
      alive += 1;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.rot += p.vr;
      p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive > 0) {
      confettiAnim = window.requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiAnim = null;
    }
  }
  tick();
}

function hideWinOverlays() {
  if (winOverlay) {
    winOverlay.classList.add("hidden");
    winOverlay.setAttribute("aria-hidden", "true");
  }
  if (leaderboardModal) leaderboardModal.classList.add("hidden");
  if (submitSection) submitSection.classList.add("hidden");
}

function onWin() {
  if (gameWon) return;
  gameWon = true;
  stopTimer();

  const diff = getDifficultyKey();
  const run = {
    timeSeconds: elapsedSeconds,
    moves: moves,
    completedAt: Date.now(),
  };
  const prevBest = readPersonalBest(diff);
  if (isBetterRun(run, prevBest)) {
    writePersonalBest(diff, run);
  }
  const best = readPersonalBest(diff);

  if (winStatsEl) {
    winStatsEl.textContent =
      "Time: " +
      formatTime(elapsedSeconds) +
      "\nMoves: " +
      moves +
      "\nDifficulty: " +
      getDifficultyLabel(diff);
  }
  if (winBestEl) winBestEl.textContent = formatBestLine(best);

  if (winOverlay) {
    winOverlay.classList.remove("hidden");
    winOverlay.setAttribute("aria-hidden", "false");
  }

  launchConfetti();
}

async function submitWinScore() {
  if (hasSubmittedThisWin) return;
  const name = (nameInput && nameInput.value.trim()) || "Player";
  if (typeof window.submitScore !== "function") {
    if (submitMsg) {
      submitMsg.textContent = window.leaderboardBridgeError
        ? "Leaderboard script failed to load. Open via a web server and check the console (F12)."
        : "Leaderboard unavailable. Open via http(s):// and check console (F12).";
    }
    return;
  }
  const difficulty = getDifficultyKey();
  hasSubmittedThisWin = true;
  if (nameInput) nameInput.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
  if (lbPlayAgainBtn) lbPlayAgainBtn.disabled = true;
  if (submitMsg) submitMsg.textContent = "Saving…";
  try {
    await window.submitScore(name, difficulty, elapsedSeconds, moves);
    saveLbName(name);
    if (submitMsg) submitMsg.textContent = "Score saved on this device!";
  } catch (_) {
    hasSubmittedThisWin = false;
    if (nameInput) nameInput.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
    if (lbPlayAgainBtn) lbPlayAgainBtn.disabled = false;
    if (submitMsg) submitMsg.textContent = "Could not save score. Try again.";
  }
}

async function loadLeaderboard(difficulty) {
  if (!leaderboardList) return;
  if (window.LabsLeaderboardUI) {
    window.LabsLeaderboardUI.setDifficultyTabs(difficulty);
  }
  if (typeof window.getLeaderboard !== "function") {
    leaderboardList.innerHTML =
      "<p class=\"leaderboard-unavailable\">Leaderboard unavailable. Open via a web server (http:// or https://).</p>";
    return;
  }
  try {
    const scores = await window.getLeaderboard(difficulty);
    renderLbRows(leaderboardList, scores);
  } catch (_) {
    leaderboardList.innerHTML =
      "<p class=\"leaderboard-unavailable\">Could not load leaderboard.</p>";
  }
}

function playAgain() {
  hideWinOverlays();
  isUploadedImage = false;
  currentImageName = pickRandomLabPuzzleImage();
  imageSrc = labPuzzleImageSrc(currentImageName);
  runWithImage();
}

if (btnStart) {
  btnStart.addEventListener("click", function () {
    scrambleToTray();
  });
}

if (difficultySelect) {
  difficultySelect.addEventListener("change", function () {
    if (dragState || isScrambling) return;
    gridSize = parseInt(difficultySelect.value, 10) || 3;
    runWithImage();
  });
}

if (btnNewImage) {
  btnNewImage.addEventListener("click", function () {
    if (dragState || isScrambling) return;
    isUploadedImage = false;
    currentImageName = pickRandomLabPuzzleImage();
    imageSrc = labPuzzleImageSrc(currentImageName);
    runWithImage();
  });
}

if (uploadImageBtn && imageUpload) {
  uploadImageBtn.addEventListener("click", function () {
    imageUpload.click();
  });
  imageUpload.addEventListener("change", function () {
    if (isScrambling) return;
    const file = imageUpload.files && imageUpload.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      isUploadedImage = true;
      imageSrc = ev.target.result;
      runWithImage();
    };
    reader.readAsDataURL(file);
    imageUpload.value = "";
  });
}

document.getElementById("leaderboardBtn")?.addEventListener("click", function () {
  leaderboardModal?.classList.remove("hidden");
  if (gameWon && !hasSubmittedThisWin && submitSection) {
    submitSection.classList.remove("hidden");
    if (yourScoreEl) {
      yourScoreEl.textContent =
        "Your time: " + formatTime(elapsedSeconds) + " • Moves: " + moves;
    }
    if (nameInput) nameInput.value = getStoredLbName();
  } else if (submitSection) {
    submitSection.classList.add("hidden");
  }
  loadLeaderboard(getDifficultyKey());
});

document.getElementById("closeLeaderboard")?.addEventListener("click", function () {
  leaderboardModal?.classList.add("hidden");
});

document.querySelectorAll(".leaderboard-tabs button").forEach(function (btn) {
  btn.addEventListener("click", function () {
    loadLeaderboard(btn.dataset.diff);
  });
});

if (submitBtn) submitBtn.addEventListener("click", submitWinScore);
if (lbPlayAgainBtn) lbPlayAgainBtn.addEventListener("click", playAgain);
if (winPlayAgainBtn) winPlayAgainBtn.addEventListener("click", playAgain);

window.addEventListener("resize", function () {
  measureLayout();
});

try {
  soundsEnabled = localStorage.getItem("lo_sounds_enabled") !== "0";
} catch (_) {}

if (difficultySelect) {
  gridSize = parseInt(difficultySelect.value, 10) || 3;
}
runWithImage();
window.setTimeout(measureLayout, 60);
