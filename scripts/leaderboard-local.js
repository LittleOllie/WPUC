/**
 * One Button Hero — device-local scores (replaces Firestore when global LB is off).
 * Restore global: set USE_GLOBAL_LEADERBOARD in scripts/labs-config.js and import leaderboard.js in game.js.
 */
import { LOCAL_LEADERBOARD_NOTE } from "./labs-config.js";
import { addLocalScore, rankLocalScores, readLocalScores } from "./local-leaderboard.js";
import {
  getStoredPlayerName,
  renderLeaderboardList,
  setStoredPlayerName,
} from "./labs-leaderboard-ui.js";

const STORAGE_KEY = "lo_labs_lb_obh";
const MAX_NAME_LEN = 15;
const MAX_ENTRIES = 10;

export const MIN_LEADERBOARD_SCORE = 0;
export const LOCAL_SCORES_NOTE = LOCAL_LEADERBOARD_NOTE;

let nameModalResolve = null;

function compareScores(a, b) {
  return (Number(b.score) || 0) - (Number(a.score) || 0);
}

function toRows() {
  return rankLocalScores(readLocalScores(STORAGE_KEY), compareScores).map((row) => ({
    id: row.runId || String(row.createdAt),
    name: row.name || row.playerName || "Player",
    score: Number(row.score) || 0,
    runId: row.runId,
    createdAt: row.createdAt,
  }));
}

export function getPlayerName() {
  const stored = getStoredPlayerName(MAX_NAME_LEN);
  if (stored) return Promise.resolve(stored);

  const modal = document.getElementById("nameModal");
  const input = document.getElementById("nameModalInput");
  if (!modal || !input) return Promise.resolve("Player");

  modal.classList.remove("hidden");
  input.value = "";
  input.focus();

  return new Promise((resolve) => {
    nameModalResolve = resolve;
  });
}

export function submitNameModal(name) {
  const n = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (n) setStoredPlayerName(n, MAX_NAME_LEN);

  const modal = document.getElementById("nameModal");
  if (modal) modal.classList.add("hidden");

  if (nameModalResolve) {
    nameModalResolve(n || getStoredPlayerName(MAX_NAME_LEN) || "Player");
    nameModalResolve = null;
  }
}

export function getStoredName() {
  return getStoredPlayerName(MAX_NAME_LEN);
}

export function setStoredName(name) {
  const n = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (n) setStoredPlayerName(n, MAX_NAME_LEN);
}

export async function getTopScores() {
  return toRows().slice(0, MAX_ENTRIES);
}

export async function checkLeaderboard(score) {
  const top = await getTopScores();
  const num = top.length;
  const sc = Math.floor(Number(score) || 0);
  const lowest = num > 0 ? Math.min(...top.map((r) => Number(r.score) || 0)) : 0;

  if (num < MAX_ENTRIES || sc > lowest) {
    const rank = top.filter((r) => (Number(r.score) || 0) > sc).length + 1;
    return { qualifies: true, rank: Math.min(rank, MAX_ENTRIES) };
  }
  return { qualifies: false };
}

export async function submitScore(name, score) {
  const nm = (name || "").trim().slice(0, MAX_NAME_LEN);
  const sc = Math.floor(Number(score) || 0);
  if (!nm) throw new Error("Name required");

  const runId = "run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  const result = addLocalScore(
    STORAGE_KEY,
    { name: nm, playerName: nm, score: sc, runId },
    { max: MAX_ENTRIES, compare: compareScores }
  );
  if (!result.ok) throw new Error("Could not save score");
}

export function renderLeaderboardPopup(rows) {
  const el = document.getElementById("leaderboardList");
  renderLeaderboardList(el, rows, {
    mode: "score",
    emptyMessage: "No scores yet. Submit a run to start your list.",
    highlightTop3: true,
  });
}

export function renderTop10(listEl, rows) {
  renderLeaderboardPopup(rows);
}
