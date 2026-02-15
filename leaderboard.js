import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const STORAGE_KEY = "loPlayerName";
const MAX_NAME_LEN = 15;
export const MIN_LEADERBOARD_SCORE = 500;

const SCORES_COL = "scores";

/**
 * This prevents duplicate submission during a single game run.
 * Must be reset when a new run starts.
 */
let hasSubmittedThisRun = false;

/* --------------------------------------------------
   PLAYER NAME (stored once in localStorage)
-------------------------------------------------- */

export function getStoredName() {
  return (localStorage.getItem(STORAGE_KEY) || "")
    .trim()
    .slice(0, MAX_NAME_LEN);
}

export function setStoredName(name) {
  const n = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (n) localStorage.setItem(STORAGE_KEY, n);
}

/* --------------------------------------------------
   LEADERBOARD FETCH
-------------------------------------------------- */

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

export async function checkLeaderboard(score) {
  try {
    const top = await getTopScores();
    const num = top.length;

    if (num < 10) {
      return { qualifies: true, rank: num + 1 };
    }

    const lowest = Math.min(...top.map((r) => Number(r.score) || 0));

    if (score > lowest) {
      const rank =
        top.filter((r) => (Number(r.score) || 0) > score).length + 1;
      return { qualifies: true, rank };
    }

    return { qualifies: false };
  } catch (e) {
    console.warn("Leaderboard check:", e?.message);
    return { qualifies: false };
  }
}

/* --------------------------------------------------
   SUBMIT SCORE (clean + safe)
-------------------------------------------------- */

export async function submitScore(name, score) {
  if (hasSubmittedThisRun) {
    throw new Error("Score already submitted this run");
  }

  const nm = (name || "").trim().slice(0, MAX_NAME_LEN);
  const sc = Math.floor(Number(score) || 0);

  if (!nm) throw new Error("Name required");
  if (sc < MIN_LEADERBOARD_SCORE)
    throw new Error("Score does not meet minimum");

  hasSubmittedThisRun = true;

  try {
    await addDoc(collection(db, SCORES_COL), {
      name: nm,
      score: sc,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    hasSubmittedThisRun = false; // allow retry if error
    console.warn("Leaderboard submit:", e?.message);
    throw e;
  }
}

/* --------------------------------------------------
   RESET SUBMISSION LOCK (call on new run)
-------------------------------------------------- */

export function resetSubmissionLock() {
  hasSubmittedThisRun = false;
}

/* --------------------------------------------------
   RENDER POPUP LEADERBOARD
-------------------------------------------------- */

export function renderLeaderboardPopup(rows) {
  const el = document.getElementById("leaderboardList");
  if (!el) return;

  el.innerHTML = "";
  const rankClasses = ["rank-gold", "rank-silver", "rank-bronze"];
  const medals = ["🥇", "🥈", "🥉"];

  rows.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "leaderboard-popup-row";
    if (rankClasses[i]) row.classList.add(rankClasses[i]);

    const rank = document.createElement("span");
    rank.className = "leaderboard-popup-rank";
    rank.textContent = medals[i] ?? `#${i + 1}`;

    const name = document.createElement("span");
    name.className = "leaderboard-popup-name";
    const nameText = (r.name || "Player")
      .slice(0, MAX_NAME_LEN)
      .toUpperCase();
    name.textContent = i === 0 ? `👑 ${nameText}` : nameText;

    const score = document.createElement("span");
    score.className = "leaderboard-popup-score";
    score.textContent = Math.floor(Number(r.score) || 0).toLocaleString();

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(score);
    el.appendChild(row);
  });
}