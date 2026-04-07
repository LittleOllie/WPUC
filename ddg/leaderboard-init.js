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

import { db, isFirebaseConfigured } from "./firebase-config.js";
import {
  attachFirestore,
  submitScore,
  startTop50Listener,
  generateRunId,
  fetchTop5Scores,
  renderLeaderboard,
} from "./leaderboard.js";

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

/** Same storage keys as shell.js (X handle). */
function readStoredHandle() {
  try {
    const STORAGE_KEY = "frappybrew_xhandle";
    const LEGACY_KEYS = ["frappy_brew_x_handle"];
    let v = localStorage.getItem(STORAGE_KEY);
    if (!v) {
      for (let i = 0; i < LEGACY_KEYS.length; i++) {
        const old = localStorage.getItem(LEGACY_KEYS[i]);
        if (old) {
          v = old;
          break;
        }
      }
    }
    return typeof v === "string"
      ? v.replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15)
      : "";
  } catch (_) {
    return "";
  }
}

function normalizeLeaderboardName(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/^@+/, "")
    .slice(0, 16);
}

function setSubmitMessage(el, text, isError) {
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("leaderboard-msg--error", !!isError);
}

function updateSubmitButtonState() {
  const submitBtn = document.getElementById("leaderboardSubmitBtn");
  if (!submitBtn) return;
  const disabled = !isFirebaseConfigured || currentScore < 1;
  submitBtn.disabled = disabled;
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
    const h = readStoredHandle();
    if (h.length >= 2) nameInput.value = h;
  }

  if (statusEl) {
    if (!isFirebaseConfigured) {
      setSubmitMessage(statusEl, "Configure firebase-config.js to submit scores.", true);
    } else if (currentScore < 1) {
      setSubmitMessage(statusEl, "Score a point or more to submit.", false);
    } else {
      setSubmitMessage(statusEl, "", false);
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

  fetchTop5Scores(db).then(function (result) {
    if (!document.getElementById("gameOverTop5List")) return;
    if (result.offline) {
      if (statusEl) {
        statusEl.textContent = "Configure firebase-config.js to see rankings.";
        statusEl.classList.add("leaderboard-status--error");
      }
      listEl.innerHTML = "";
      return;
    }
    if (result.error) {
      if (statusEl) {
        statusEl.textContent = "Could not load leaderboard.";
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
  if (!isFirebaseConfigured || currentScore < 1) return;

  if (submitBtn) submitBtn.disabled = true;
  setSubmitMessage(statusEl, "Submitting…", false);

  const result = await submitScore(name, currentScore, currentRunId);

  updateSubmitButtonState();

  if (result.ok) {
    setSubmitMessage(statusEl, "Score saved!", false);
    loadGameOverTop5();
    openLeaderboardModal({ focusRunId: result.runId, celebrate: true });
    return;
  }
  if (result.reason === "duplicate_run") {
    setSubmitMessage(statusEl, "This run was already submitted.", false);
    return;
  }
  if (result.reason === "bad_name") {
    setSubmitMessage(statusEl, "Use 2–16 characters for your name.", true);
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
    db,
    listEl,
    statusEl,
    onError: function () {},
    focusRunId: focusRunId,
    onFocusRunMissing:
      focusRunId
        ? function () {
            const s = document.getElementById("leaderboardModalStatus");
            if (s && !s.classList.contains("leaderboard-status--error")) {
              s.textContent =
                "Score saved! Your row may still be syncing — or your rank might be outside the Top 50.";
            }
          }
        : undefined,
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
  attachFirestore(db);

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
