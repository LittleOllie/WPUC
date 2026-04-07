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

/** Set only from handleGameOver — one submission per runId per completed run. */
let currentRunId = null;
let currentScore = null;

function lockBodyScroll(lock) {
  document.documentElement.classList.toggle("modal-open", lock);
  document.body.classList.toggle("modal-open", lock);
}

function readStoredHandle() {
  try {
    const h = localStorage.getItem("frappybrew_xhandle");
    return typeof h === "string" ? h.trim() : "";
  } catch (_) {
    return "";
  }
}

function setSubmitMessage(el, text, isError) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("leaderboard-msg--error", !!isError);
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

/**
 * Single hook: call from the engine’s final game-over path after score is finalized.
 * Prepares submit row: new runId, score, cleared message, submit enabled.
 *
 * @param {number} finalScore — non-negative integer run score
 */
function handleGameOver(finalScore) {
  const sc =
    typeof finalScore === "number" && Number.isFinite(finalScore)
      ? Math.floor(finalScore)
      : Math.floor(Number(finalScore));
  currentScore = Number.isFinite(sc) && sc >= 0 ? sc : null;
  currentRunId = generateRunId();

  const msg = document.getElementById("leaderboardSubmitMsg");
  const btn = document.getElementById("leaderboardSubmitBtn");
  const input = document.getElementById("leaderboardNameInput");
  const statusGameOver = document.getElementById("leaderboardStatus");

  setSubmitMessage(msg, "", false);
  if (btn) {
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
  }

  if (input) {
    if (!input.value.trim()) {
      const h = readStoredHandle();
      if (h) input.value = h.length > 16 ? h.slice(0, 16) : h;
    }
  }

  if (statusGameOver && !isFirebaseConfigured) {
    statusGameOver.textContent = "Configure firebase-config.js to submit online scores.";
    statusGameOver.classList.add("leaderboard-status--error");
  } else if (statusGameOver) {
    statusGameOver.textContent = "";
    statusGameOver.classList.remove("leaderboard-status--error");
  }

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

async function onSubmitClick() {
  const btn = document.getElementById("leaderboardSubmitBtn");
  const input = document.getElementById("leaderboardNameInput");
  const msg = document.getElementById("leaderboardSubmitMsg");

  if (!btn || !currentRunId || currentScore === null) return;
  if (btn.disabled) return;

  const name = input ? input.value : "";
  btn.disabled = true;
  btn.setAttribute("aria-disabled", "true");

  const result = await submitScore(name, currentScore, currentRunId);

  if (result.ok) {
    setSubmitMessage(msg, "Score submitted! Check the leaderboard.", false);
    openLeaderboardModal({ focusRunId: currentRunId, celebrate: true });
  } else if (result.reason === "duplicate_run" || result.reason === "in_flight") {
    setSubmitMessage(msg, "Already submitted for this run.", false);
  } else if (result.reason === "bad_name") {
    setSubmitMessage(msg, "Enter a name between 2 and 16 characters.", true);
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
  } else if (result.reason === "bad_score") {
    setSubmitMessage(msg, "Invalid score.", true);
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
  } else if (result.reason === "no_db") {
    setSubmitMessage(msg, "Leaderboard not configured (add Firebase config).", true);
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
  } else {
    setSubmitMessage(msg, "Could not submit. Check connection or try later.", true);
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
  }
}

/**
 * One-time DOM wiring: submit button, modal open/close, browse from game over / splash.
 */
function boot() {
  attachFirestore(db);

  const submitBtn = document.getElementById("leaderboardSubmitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", onSubmitClick);
  }

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
