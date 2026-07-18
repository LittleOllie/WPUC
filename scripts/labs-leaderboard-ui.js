/**
 * Shared Games Lab leaderboard rendering + player name helpers.
 */
import { LOCAL_LEADERBOARD_NOTE } from "./labs-config.js";

export const PLAYER_NAME_KEY = "loPlayerName";
export const LEGACY_PLAYER_NAME_KEY = "lo_player_name";

export function getStoredPlayerName(maxLen = 30) {
  try {
    let v = localStorage.getItem(PLAYER_NAME_KEY);
    if (!v) v = localStorage.getItem(LEGACY_PLAYER_NAME_KEY);
    return String(v ?? "")
      .trim()
      .slice(0, maxLen);
  } catch (_) {
    return "";
  }
}

export function setStoredPlayerName(name, maxLen = 30) {
  const normalized = String(name ?? "")
    .trim()
    .slice(0, maxLen);
  if (!normalized) return;
  try {
    localStorage.setItem(PLAYER_NAME_KEY, normalized);
    localStorage.setItem(LEGACY_PLAYER_NAME_KEY, normalized);
  } catch (_) {}
}

export function formatTime(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ":" + (r < 10 ? "0" : "") + r;
}

export function formatTimeLeaderboardHtml(seconds) {
  if (seconds == null || typeof seconds !== "number" || isNaN(seconds)) return "—";
  return formatTime(seconds) + '<span class="leaderboard-sec-unit">s</span>';
}

/**
 * @param {HTMLElement | null} container
 * @param {Array<object>} rows
 * @param {{
 *   mode?: "score" | "time-moves",
 *   emptyMessage?: string,
 *   highlightTop3?: boolean,
 *   highlightRunId?: string,
 *   animate?: boolean,
 * }} [opts]
 */
export function renderLeaderboardList(container, rows, opts) {
  opts = opts || {};
  const mode = opts.mode === "time-moves" ? "time-moves" : "score";
  const emptyMessage =
    opts.emptyMessage || "No scores yet. Complete a run to add one.";
  const highlightTop3 = opts.highlightTop3 !== false;
  const highlightRunId =
    opts.highlightRunId && typeof opts.highlightRunId === "string"
      ? opts.highlightRunId
      : "";
  const animate = opts.animate !== false;

  if (!container) return;

  container.innerHTML = "";
  container.classList.remove("leaderboard-visible");
  container.classList.toggle(
    "leaderboard-list-popup--time-moves",
    mode === "time-moves"
  );

  if (!rows || !rows.length) {
    const empty = document.createElement("p");
    empty.className = "leaderboard-unavailable";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  rows.forEach(function (row, i) {
    const rankNum = row.rank != null ? row.rank : i + 1;
    const rowEl = document.createElement("div");
    rowEl.className = "leaderboard-popup-row";
    if (animate) rowEl.style.animationDelay = i * 0.06 + "s";

    if (typeof row.runId === "string" && row.runId.length > 0) {
      rowEl.setAttribute("data-run-id", row.runId);
    }

    if (highlightTop3) {
      if (rankNum === 1) rowEl.classList.add("rank-gold");
      else if (rankNum === 2) rowEl.classList.add("rank-silver");
      else if (rankNum === 3) rowEl.classList.add("rank-bronze");
    }

    if (highlightRunId && row.runId === highlightRunId) {
      rowEl.classList.add("leaderboard-popup-row--you");
    }

    const rankSpan = document.createElement("span");
    rankSpan.className = "leaderboard-popup-rank";
    rankSpan.textContent = "#" + rankNum;

    const nameSpan = document.createElement("span");
    nameSpan.className = "leaderboard-popup-name";
    const playerName =
      row.playerName || row.name || row.player_name || "Player";
    nameSpan.textContent = String(playerName);

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "leaderboard-popup-score";

    if (mode === "time-moves") {
      scoreSpan.innerHTML =
        formatTimeLeaderboardHtml(row.timeSeconds) +
        '<br><span class="leaderboard-popup-moves">' +
        (row.moves != null ? row.moves + " moves" : "—") +
        "</span>";
    } else {
      scoreSpan.textContent = Math.floor(
        Number(row.score != null ? row.score : 0)
      ).toLocaleString();
    }

    rowEl.appendChild(rankSpan);
    rowEl.appendChild(nameSpan);
    rowEl.appendChild(scoreSpan);
    container.appendChild(rowEl);
  });

  if (animate) container.classList.add("leaderboard-visible");
}

export function setDifficultyTabs(activeDiff, root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll(".leaderboard-tabs button[data-diff]").forEach(function (btn) {
    const isActive = btn.dataset.diff === activeDiff;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

export const LOCAL_NOTE = LOCAL_LEADERBOARD_NOTE;

if (typeof window !== "undefined") {
  window.LabsLeaderboardUI = {
    PLAYER_NAME_KEY,
    LEGACY_PLAYER_NAME_KEY,
    LOCAL_NOTE,
    getStoredPlayerName,
    setStoredPlayerName,
    formatTime,
    formatTimeLeaderboardHtml,
    renderLeaderboardList,
    setDifficultyTabs,
  };
}
