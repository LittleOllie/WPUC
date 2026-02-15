// leaderboard.js – Global Top 10 (Firestore: single collection "scores")
import { db } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const STORAGE_KEY = "loPlayerName";
const MAX_NAME_LEN = 15;
const SUBMIT_COOLDOWN_MS = 3000;

/** Minimum score required to qualify for the global leaderboard. */
export const MIN_LEADERBOARD_SCORE = 500;

let nameModalResolve = null;

// ---------- Player name (one time only, localStorage) ----------

export function getPlayerName() {
  const stored = (localStorage.getItem(STORAGE_KEY) || "").trim().slice(0, MAX_NAME_LEN);
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
  if (n) localStorage.setItem(STORAGE_KEY, n);

  const modal = document.getElementById("nameModal");
  if (modal) modal.classList.add("hidden");

  if (nameModalResolve) {
    nameModalResolve(n || localStorage.getItem(STORAGE_KEY) || "Player");
    nameModalResolve = null;
  }
}

export function getStoredName() {
  return (localStorage.getItem(STORAGE_KEY) || "").trim().slice(0, MAX_NAME_LEN);
}

export function setStoredName(name) {
  const n = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (n) localStorage.setItem(STORAGE_KEY, n);
}

// ---------- Firestore: single collection "scores" ----------

const SCORES_COL = "scores";

/**
 * Fetches global Top 10 (all players).
 * @returns {Promise<Array<{ id: string, name: string, score: number, createdAt: any }>>}
 */
export async function getTopScores() {
  try {
    const q = query(
      collection(db, SCORES_COL),
      orderBy("score", "desc"),
      limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Leaderboard getTopScores:", e?.message);
    return [];
  }
}

/**
 * Returns whether score qualifies for Top 10 and optional rank.
 * @param {number} score
 * @returns {Promise<{ qualifies: boolean, rank?: number }>}
 */
export async function checkLeaderboard(score) {
  try {
    const top = await getTopScores();
    const num = top.length;
    const lowest = num > 0 ? Math.min(...top.map((r) => Number(r.score) || 0)) : 0;

    if (num < 10 || score > lowest) {
      const rank = top.filter((r) => (Number(r.score) || 0) > score).length + 1;
      return { qualifies: true, rank };
    }
    return { qualifies: false };
  } catch (e) {
    console.warn("Leaderboard check:", e?.message);
    return { qualifies: false };
  }
}

/**
 * Submits or updates player's score. Keeps only best score per name.
 * @param {string} name
 * @param {number} score
 */
export async function submitScore(name, score) {
  const nm = (name || "").trim().slice(0, MAX_NAME_LEN);
  const sc = Math.floor(Number(score) || 0);
  if (!nm) throw new Error("Name required");

  const now = Date.now();
  const last = Number(localStorage.getItem("obh_last_submit") || 0);
  if (now - last < SUBMIT_COOLDOWN_MS) throw new Error("Wait a moment before submitting again");

  try {
    const col = collection(db, SCORES_COL);
    const q = query(col, where("name", "==", nm), limit(1));
    const existing = await getDocs(q);

    if (!existing.empty) {
      const docSnap = existing.docs[0];
      const oldScore = Math.floor(Number(docSnap.data().score) || 0);
      if (sc <= oldScore) return;
      await updateDoc(doc(db, SCORES_COL, docSnap.id), {
        name: nm,
        score: sc,
        createdAt: serverTimestamp(),
      });
    } else {
      await addDoc(col, {
        name: nm,
        score: sc,
        createdAt: serverTimestamp(),
      });
    }

    localStorage.setItem("obh_last_submit", String(now));
  } catch (e) {
    console.warn("Leaderboard submit:", e?.message);
    throw e;
  }
}

/**
 * Renders Top 10 into #leaderboardList (popup). Format: #1 NAME SCORE. rank-gold/silver/bronze, staggered fade-in.
 * @param {Array<{ name: string, score: number }>} rows
 */
export function renderLeaderboardPopup(rows) {
  const el = document.getElementById("leaderboardList");
  if (!el) return;

  el.innerHTML = "";
  el.classList.remove("leaderboard-visible");
  const rankClasses = ["rank-gold", "rank-silver", "rank-bronze"];

  rows.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "leaderboard-popup-row";
    if (rankClasses[i]) row.classList.add(rankClasses[i]);
    row.style.animationDelay = `${i * 0.06}s`;

    const rank = document.createElement("span");
    rank.className = "leaderboard-popup-rank";
    rank.textContent = `#${i + 1}`;

    const name = document.createElement("span");
    name.className = "leaderboard-popup-name";
    const nameText = (r.name || "Player").slice(0, MAX_NAME_LEN).toUpperCase();
    name.textContent = i === 0 ? `👑 ${nameText}` : nameText;

    const score = document.createElement("span");
    score.className = "leaderboard-popup-score";
    score.textContent = Math.floor(Number(r.score) || 0).toLocaleString();

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(score);
    el.appendChild(row);
  });

  el.classList.add("leaderboard-visible");
}

/**
 * Renders Top 10 into #leaderboard (game over panel). Kept for inline list.
 */
export function renderTop10(listEl, rows) {
  const el = listEl || document.getElementById("leaderboard");
  if (!el) return;

  el.innerHTML = "";
  const medals = ["🥇", "🥈", "🥉"];
  rows.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    if (i === 0) row.classList.add("gold");
    else if (i === 1) row.classList.add("silver");
    else if (i === 2) row.classList.add("bronze");

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = medals[i] ?? `#${i + 1}`;

    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = (r.name || "Player").slice(0, MAX_NAME_LEN);

    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = Math.floor(Number(r.score) || 0).toLocaleString();

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(score);
    el.appendChild(row);
  });

  el.classList.add("leaderboard-visible");
}
