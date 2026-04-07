/**
 * Firestore leaderboard for Frappy Brew.
 * Rendering helpers are separate from submission — game code never imports this directly;
 * leaderboard-init.js wires DOM + handleGameOver + modal.
 *
 * Firestore collection id + `game` field value must match deployed rules (do not rename without migration).
 * Client only creates documents; updates/deletes are denied by Security Rules.
 *
 * Future (not implemented): switch to one document per player / highest score wins.
 */

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/** @type {import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js').Firestore | null} */
let dbRef = null;

export const COLLECTION_NAME = "one_button_hero_leaderboard";
export const GAME_SLUG = "one-button-hero";
export const DATA_VERSION = 1;
export const TOP50_LIMIT = 50;

/** In-memory + sessionStorage-backed run IDs already submitted this session. */
const submittedRunIds = new Set();

/** Prevents parallel duplicate submits for the same runId before the first addDoc finishes. */
const inFlightRunIds = new Set();

const STORAGE_KEY_RUNS = "obh_lb_submitted_run_ids";

function loadPersistedRunIds() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_RUNS);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach((id) => {
        if (typeof id === "string" && id.length >= 6) submittedRunIds.add(id);
      });
    }
  } catch (_) {
    /* ignore */
  }
}

function persistRunIds() {
  try {
    const arr = Array.from(submittedRunIds).slice(-80);
    sessionStorage.setItem(STORAGE_KEY_RUNS, JSON.stringify(arr));
  } catch (_) {
    /* ignore */
  }
}

/** Stable per-tab session for rules + debugging (3–100 chars). */
export function getOrCreateSessionId() {
  try {
    let s = sessionStorage.getItem("obh_lb_session_id");
    if (s && s.length >= 3 && s.length <= 100) return s;
    s = "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 18);
    if (s.length > 100) s = s.slice(0, 100);
    sessionStorage.setItem("obh_lb_session_id", s);
    return s;
  } catch (_) {
    return "sess_fallback_" + String(Date.now());
  }
}

/** Unique id per completed run (6–100 chars). */
export function generateRunId() {
  const id = "run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 16);
  return id.length > 100 ? id.slice(0, 100) : id;
}

function initDb(db) {
  dbRef = db;
  loadPersistedRunIds();
}

/**
 * @param {import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js').Firestore | null} db
 */
export function attachFirestore(db) {
  initDb(db);
}

/**
 * @param {string} playerName
 * @param {number} score - will be floored to integer
 * @param {string} runId
 * @returns {Promise<{ ok: boolean, reason?: string, error?: Error, runId?: string }>}
 */
export async function submitScore(playerName, score, runId) {
  if (!dbRef) {
    return { ok: false, reason: "no_db" };
  }
  if (submittedRunIds.has(runId)) {
    return { ok: false, reason: "duplicate_run" };
  }
  if (inFlightRunIds.has(runId)) {
    return { ok: false, reason: "in_flight" };
  }
  const name = typeof playerName === "string" ? playerName.trim() : "";
  if (name.length < 2 || name.length > 16) {
    return { ok: false, reason: "bad_name" };
  }
  const sc = Math.floor(Number(score));
  if (!Number.isFinite(sc) || sc < 0 || sc > 1000000) {
    return { ok: false, reason: "bad_score" };
  }
  if (typeof runId !== "string" || runId.length < 6 || runId.length > 100) {
    return { ok: false, reason: "bad_run" };
  }

  const sessionId = getOrCreateSessionId();
  if (sessionId.length < 3 || sessionId.length > 100) {
    return { ok: false, reason: "bad_session" };
  }

  inFlightRunIds.add(runId);
  try {
    await addDoc(collection(dbRef, COLLECTION_NAME), {
      playerName: name,
      score: sc,
      createdAt: serverTimestamp(),
      game: GAME_SLUG,
      runId,
      sessionId,
      version: DATA_VERSION,
    });
    submittedRunIds.add(runId);
    persistRunIds();
    return { ok: true, runId: runId };
  } catch (e) {
    console.warn("[leaderboard] submitScore failed:", e);
    return { ok: false, reason: "firestore", error: e };
  } finally {
    inFlightRunIds.delete(runId);
  }
}

/** Escape text for safe insertion into HTML. */
export function sanitizeForHtml(str) {
  if (typeof str !== "string") return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

/**
 * Render ranked rows into a container (ol recommended for semantics).
 * @param {HTMLElement} container
 * @param {Array<{ rank: number, playerName: string, score: number, runId?: string }>} rows
 * @param {{ highlightTop3?: boolean, highlightRunId?: string }} [opts]
 */
export function renderLeaderboard(container, rows, opts) {
  const highlightTop3 = !!(opts && opts.highlightTop3);
  const highlightRunId = opts && typeof opts.highlightRunId === "string" ? opts.highlightRunId : "";
  if (!container) return;
  container.innerHTML = "";
  if (!rows.length) {
    const li = document.createElement("li");
    li.className = "leaderboard-empty";
    li.textContent = "No scores yet — be the first!";
    container.appendChild(li);
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement("li");
    li.className = "leaderboard-row";
    if (typeof row.runId === "string" && row.runId.length > 0) {
      li.setAttribute("data-run-id", row.runId);
    }
    if (highlightTop3) {
      if (row.rank === 1) li.classList.add("leaderboard-row--top1");
      else if (row.rank === 2) li.classList.add("leaderboard-row--top2");
      else if (row.rank === 3) li.classList.add("leaderboard-row--top3");
    }
    if (highlightRunId && row.runId === highlightRunId) {
      li.classList.add("leaderboard-row--you");
    }

    const rankSpan = document.createElement("span");
    rankSpan.className = "leaderboard-rank";
    rankSpan.textContent = String(row.rank);

    const nameSpan = document.createElement("span");
    nameSpan.className = "leaderboard-name";
    nameSpan.textContent = typeof row.playerName === "string" ? row.playerName : "?";

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "leaderboard-score";
    scoreSpan.textContent = String(typeof row.score === "number" ? row.score : 0);

    li.appendChild(rankSpan);
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    container.appendChild(li);
  });
}

export const TOP_PREVIEW_COUNT = 5;

/**
 * One-shot fetch for game-over preview (not a listener).
 */
export async function fetchTop5Scores(db) {
  initDb(db);
  if (!dbRef) {
    return { rows: [], offline: true };
  }
  try {
    const col = collection(dbRef, COLLECTION_NAME);
    const qTop = query(col, orderBy("score", "desc"), limit(TOP_PREVIEW_COUNT));
    const snap = await getDocs(qTop);
    const rows = [];
    var rank = 1;
    snap.forEach(function (doc) {
      var d = doc.data();
      rows.push({
        rank: rank++,
        playerName: typeof d.playerName === "string" ? d.playerName : "?",
        score: typeof d.score === "number" ? d.score : 0,
        runId: typeof d.runId === "string" ? d.runId : "",
      });
    });
    return { rows };
  } catch (e) {
    console.warn("[leaderboard] fetchTop5Scores failed:", e);
    return { rows: [], error: true };
  }
}

/**
 * Real-time Top 50 by score (desc). Unsubscribe when the modal closes.
 *
 * @param {{ db: *, listEl: HTMLElement | null, statusEl: HTMLElement | null, onError?: (e: Error) => void, focusRunId?: string | null, onFocusRunFound?: () => void, onFocusRunMissing?: () => void }}
 * @returns {() => void} unsubscribe
 */
export function startTop50Listener({
  db,
  listEl,
  statusEl,
  onError,
  focusRunId,
  onFocusRunFound,
  onFocusRunMissing,
}) {
  initDb(db);

  if (!dbRef) {
    if (statusEl) {
      statusEl.textContent = "Leaderboard offline — add Firebase config in firebase-config.js.";
      statusEl.classList.add("leaderboard-status--error");
    }
    if (listEl) listEl.innerHTML = "";
    return function noop() {};
  }

  if (statusEl) {
    statusEl.textContent = "Loading…";
    statusEl.classList.remove("leaderboard-status--error");
  }
  if (listEl) listEl.innerHTML = "";

  const col = collection(dbRef, COLLECTION_NAME);
  const qTop = query(col, orderBy("score", "desc"), limit(TOP50_LIMIT));

  var focusResolved = false;
  var missingTimer = null;
  var missingNotified = false;

  function notifyMissing() {
    if (missingNotified) return;
    missingNotified = true;
    if (typeof onFocusRunMissing === "function") onFocusRunMissing();
  }

  function tryScrollToRun() {
    if (!focusRunId || !listEl) return;
    var el = null;
    try {
      el = listEl.querySelector("[data-run-id=\"" + CSS.escape(focusRunId) + "\"]");
    } catch (_) {
      return;
    }
    if (el) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      });
      if (!focusResolved) {
        focusResolved = true;
        if (typeof onFocusRunFound === "function") onFocusRunFound();
      }
      if (missingTimer) {
        clearTimeout(missingTimer);
        missingTimer = null;
      }
    }
  }

  if (focusRunId && typeof onFocusRunMissing === "function") {
    missingTimer = window.setTimeout(function () {
      if (focusResolved) return;
      var el = null;
      try {
        el = listEl ? listEl.querySelector("[data-run-id=\"" + CSS.escape(focusRunId) + "\"]") : null;
      } catch (_) {}
      if (!el) notifyMissing();
    }, 5000);
  }

  const unsubSnap = onSnapshot(
    qTop,
    function (snap) {
      if (statusEl) {
        statusEl.textContent = "";
        statusEl.classList.remove("leaderboard-status--error");
      }
      const rows = [];
      var rank = 1;
      snap.forEach(function (doc) {
        var d = doc.data();
        rows.push({
          rank: rank++,
          playerName: typeof d.playerName === "string" ? d.playerName : "?",
          score: typeof d.score === "number" ? d.score : 0,
          runId: typeof d.runId === "string" ? d.runId : "",
        });
      });
      renderLeaderboard(listEl, rows, { highlightTop3: true, highlightRunId: focusRunId || "" });
      tryScrollToRun();
    },
    function (err) {
      console.warn("[leaderboard] Top 50 listener:", err);
      if (statusEl) {
        statusEl.textContent = "Could not load leaderboard.";
        statusEl.classList.add("leaderboard-status--error");
      }
      if (listEl) listEl.innerHTML = "";
      if (onError) onError(err);
    }
  );

  return function unsubscribeTop50() {
    if (missingTimer) clearTimeout(missingTimer);
    try {
      unsubSnap();
    } catch (_) {}
  };
}
