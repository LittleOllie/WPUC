/**
 * DDG — device-local scores (replaces Firestore when global LB is off).
 */
import { LOCAL_LEADERBOARD_NOTE } from "../scripts/labs-config.js";
import { addLocalScore, rankLocalScores, readLocalScores } from "../scripts/local-leaderboard.js";
import { renderLeaderboardList } from "../scripts/labs-leaderboard-ui.js";

const STORAGE_KEY = "lo_labs_lb_ddg";
const MAX_MODAL = 50;
const submittedRunIds = new Set();

function compareScores(a, b) {
  return (Number(b.score) || 0) - (Number(a.score) || 0);
}

function toRankedRows(limit) {
  return rankLocalScores(readLocalScores(STORAGE_KEY), compareScores)
    .slice(0, limit)
    .map((row) => ({
      rank: row.rank,
      playerName: row.playerName || row.name || "Player",
      score: Number(row.score) || 0,
      runId: row.runId,
    }));
}

/** Unique id per completed run (6–100 chars). */
export function generateRunId() {
  const id = "run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 16);
  return id.length > 100 ? id.slice(0, 100) : id;
}

/**
 * @param {HTMLElement} container
 * @param {Array<{ rank: number, playerName: string, score: number, runId?: string }>} rows
 * @param {{ highlightTop3?: boolean, highlightRunId?: string }} [opts]
 */
export function renderLeaderboard(container, rows, opts) {
  renderLeaderboardList(container, rows, {
    mode: "score",
    emptyMessage: "No scores yet — complete a run to add one!",
    highlightTop3: !!(opts && opts.highlightTop3),
    highlightRunId: opts && typeof opts.highlightRunId === "string" ? opts.highlightRunId : "",
  });
}

export function attachFirestore() {
  /* local mode — no Firestore */
}

export async function fetchTop5Scores() {
  return {
    rows: toRankedRows(5),
    offline: false,
    error: false,
  };
}

export async function submitScore(playerName, score, runId) {
  const name = typeof playerName === "string" ? playerName.trim() : "";
  if (name.length < 2 || name.length > 15) {
    return { ok: false, reason: "bad_name" };
  }
  if (submittedRunIds.has(runId)) {
    return { ok: false, reason: "duplicate_run" };
  }
  const sc = Math.floor(Number(score));
  if (!Number.isFinite(sc) || sc < 0) {
    return { ok: false, reason: "bad_score" };
  }

  const result = addLocalScore(
    STORAGE_KEY,
    { playerName: name, score: sc, runId },
    { max: MAX_MODAL, compare: compareScores, dedupeRunId: true }
  );

  if (!result.ok) {
    return { ok: false, reason: result.reason || "save_failed" };
  }

  submittedRunIds.add(runId);
  return { ok: true, runId };
}

export function startTop50Listener(opts) {
  const listEl = opts && opts.listEl;
  const statusEl = opts && opts.statusEl;
  const focusRunId = opts && opts.focusRunId;

  if (statusEl) {
    statusEl.textContent = LOCAL_LEADERBOARD_NOTE;
    statusEl.classList.remove("leaderboard-status--error");
  }

  renderLeaderboard(listEl, toRankedRows(MAX_MODAL), {
    highlightTop3: true,
    highlightRunId: typeof focusRunId === "string" ? focusRunId : "",
  });

  return function stop() {};
}

export const isLocalLeaderboard = true;
