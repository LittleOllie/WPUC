/**
 * Leaderboard wiring for Frappy Brew.
 *
 * INTEGRATION (engine → this file only):
 *   After a run ends and the final score is known, the game calls once:
 *     window.handleGameOver(finalScore)
 *   Implemented in frappy-brew.js endGame() only — not render loops or reset.
 *
 * Top 50 list: opens in #leaderboardModal; Firestore listener starts on open and
 * unsubscribes on close so listeners never stack or leak.
 */

import {
  attachFirestore,
  submitScore,
  startTop50Listener,
  generateRunId,
  fetchTop5Scores,
  renderLeaderboard,
} from "./leaderboard-local-storage.js";
import { LOCAL_LEADERBOARD_NOTE } from "../scripts/labs-config.js";
import { setStoredPlayerName as savePlayerName } from "../scripts/labs-leaderboard-ui.js";

/** Unsubscribe for the modal Top 50 listener — null when modal closed. */
let top50Unsubscribe = null;

/** @type {HTMLElement | null} */
let focusBeforeLeaderboard = null;

/** Fresh run id + score for the game-over submit panel (set each game over). */
let currentRunId = null;
let currentScore = 0;

function lockBodyScroll(lock) {
  document.documentElement.classList.toggle("modal-open", lock);
  document.body.classList.toggle("modal-open", lock);
}

function stopTop50Listener() {
  if (typeof top50Unsubscribe === "function") {
    try {
      top50Unsubscribe();
    } catch (_) {}
  }
  top50Unsubscribe = null;
}

function triggerLeaderboardFireworks() {
  const el = document.getElementById("leaderboardFireworks");
  if (!el) return;
  el.classList.remove("leaderboard-fireworks--active");
  void el.offsetWidth;
  el.classList.add("leaderboard-fireworks--active");
  window.setTimeout(function () {
    el.classList.remove("leaderboard-fireworks--active");
  }, 2600);
}

function setStoredPlayerName(name) {
  const normalized = String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 15);
  if (normalized.length < 2) return;
  savePlayerName(normalized, 15);
}

function normalizeLeaderboardName(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 15);
}

function setSubmitMessage(el, text, isError) {
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("leaderboard-msg--error", !!isError);
}

function updateSubmitButtonState() {
  const submitBtn = document.getElementById("leaderboardSubmitBtn");
  if (!submitBtn) return;
  submitBtn.disabled = currentScore < 1;
}

/**
 * Single hook: call from the engine’s final game-over path after score is finalized.
 * Refreshes the game-over Top 5 preview and prepares the submit panel for this run.
 *
 * @param {number} finalScore — non-negative integer run score
 */
function handleGameOver(finalScore) {
  currentScore = Number.isFinite(finalScore) && finalScore >= 0 ? Math.floor(finalScore) : 0;
  currentRunId = generateRunId();

  const nameInput = document.getElementById("leaderboardNameInput");
  const statusEl = document.getElementById("leaderboardStatus");

  if (nameInput) {
    nameInput.value = "";
    nameInput.readOnly = false;
    nameInput.disabled = false;
    nameInput.removeAttribute("readonly");
    requestAnimationFrame(function () {
      if (typeof nameInput.focus === "function") nameInput.focus();
    });
  }

  if (statusEl) {
    if (currentScore < 1) {
      setSubmitMessage(statusEl, "Score a point or more to save.", false);
    } else {
      setSubmitMessage(statusEl, LOCAL_LEADERBOARD_NOTE, false);
    }
  }

  updateSubmitButtonState();
  loadGameOverTop5();
}

/**
 * Loads Top 5 for the game-over card (one getDocs per game over — not a render-loop listener).
 */
function loadGameOverTop5() {
  const listEl = document.getElementById("gameOverTop5List");
  const statusEl = document.getElementById("gameOverTop5Status");
  if (!listEl) return;

  if (statusEl) {
    statusEl.textContent = "Loading…";
    statusEl.classList.remove("leaderboard-status--error");
  }
  listEl.innerHTML = "";

  fetchTop5Scores().then(function (result) {
    if (!document.getElementById("gameOverTop5List")) return;
    if (result.error) {
      if (statusEl) {
        statusEl.textContent = "Could not load your scores.";
        statusEl.classList.add("leaderboard-status--error");
      }
      listEl.innerHTML = "";
      return;
    }
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.classList.remove("leaderboard-status--error");
    }
    renderLeaderboard(listEl, result.rows, { highlightTop3: true });
  });
}

async function onSubmitClick() {
  const nameInput = document.getElementById("leaderboardNameInput");
  const statusEl = document.getElementById("leaderboardStatus");
  const submitBtn = document.getElementById("leaderboardSubmitBtn");
  if (!nameInput || !currentRunId) return;

  const name = normalizeLeaderboardName(nameInput.value);
  if (name.length < 2) {
    setSubmitMessage(statusEl, "Enter at least 2 characters for your name.", true);
    return;
  }
  if (currentScore < 1) return;

  if (submitBtn) submitBtn.disabled = true;
  setSubmitMessage(statusEl, "Submitting…", false);

  const result = await submitScore(name, currentScore, currentRunId);

  updateSubmitButtonState();

  if (result.ok) {
    setStoredPlayerName(name);
    setSubmitMessage(statusEl, "Score saved on this device!", false);
    loadGameOverTop5();
    openLeaderboardModal({ focusRunId: result.runId, celebrate: true });
    return;
  }
  if (result.reason === "duplicate_run") {
    setSubmitMessage(statusEl, "This run was already submitted.", false);
    return;
  }
  if (result.reason === "bad_name") {
    setSubmitMessage(statusEl, "Use 2–15 characters for your name.", true);
    return;
  }
  setSubmitMessage(statusEl, "Could not submit. Try again.", true);
}

/**
 * @param {{ focusRunId?: string | null, celebrate?: boolean }} [opts]
 */
function openLeaderboardModal(opts) {
  opts = opts || {};
  const focusRunId = opts.focusRunId || null;
  const celebrate = !!opts.celebrate;

  const modal = document.getElementById("leaderboardModal");
  const listEl = document.getElementById("leaderboardModalList");
  const statusEl = document.getElementById("leaderboardModalStatus");
  const closeBtn = document.getElementById("leaderboardModalClose");
  if (!modal) return;

  stopTop50Listener();

  focusBeforeLeaderboard = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.removeAttribute("hidden");
  modal.setAttribute("aria-hidden", "false");
  lockBodyScroll(true);

  if (celebrate) {
    modal.classList.add("leaderboard-modal--celebrate");
    requestAnimationFrame(function () {
      triggerLeaderboardFireworks();
    });
  } else {
    modal.classList.remove("leaderboard-modal--celebrate");
  }

  top50Unsubscribe = startTop50Listener({
    listEl,
    statusEl,
    onError: function () {},
    focusRunId: focusRunId,
  });

  requestAnimationFrame(function () {
    if (closeBtn && typeof closeBtn.focus === "function") closeBtn.focus();
  });
}

function closeLeaderboardModal() {
  const modal = document.getElementById("leaderboardModal");
  stopTop50Listener();
  if (modal) {
    modal.setAttribute("hidden", "");
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("leaderboard-modal--celebrate");
  }
  lockBodyScroll(false);
  if (focusBeforeLeaderboard && typeof focusBeforeLeaderboard.focus === "function") {
    try {
      focusBeforeLeaderboard.focus();
    } catch (_) {}
  }
  focusBeforeLeaderboard = null;
}

if (typeof window !== "undefined") {
  window.handleGameOver = handleGameOver;
}

/**
 * One-time DOM wiring: modal open/close, browse from game over / splash, submit panel.
 */
function boot() {
  attachFirestore();

  const openBtn = document.getElementById("leaderboardOpenBtn");
  if (openBtn) {
    openBtn.addEventListener("click", function () {
      openLeaderboardModal();
    });
  }

  const gameOverBrowse = document.getElementById("gameOverViewLeaderboardBtn");
  if (gameOverBrowse) {
    gameOverBrowse.addEventListener("click", function () {
      openLeaderboardModal();
    });
  }

  const submitBtn = document.getElementById("leaderboardSubmitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      void onSubmitClick();
    });
  }

  const nameInput = document.getElementById("leaderboardNameInput");
  if (nameInput) {
    nameInput.addEventListener("input", function () {
      updateSubmitButtonState();
    });
  }

  const closeBtn = document.getElementById("leaderboardModalClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeLeaderboardModal);
  }

  const modal = document.getElementById("leaderboardModal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeLeaderboardModal();
    });
  }

  if (typeof window !== "undefined") {
    window.Leaderboard = {
      handleGameOver: handleGameOver,
      openLeaderboardModal: openLeaderboardModal,
      closeLeaderboardModal: closeLeaderboardModal,
      submitScore: submitScore,
      generateRunId: generateRunId,
      attachFirestore: attachFirestore,
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

window.addEventListener("beforeunload", function () {
  stopTop50Listener();
});
