/**
 * Badges page: display badge list with progress.
 */
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-init.js";
import { BADGE_DEFINITIONS } from "./badge-definitions.js";
import { getBadgeProgress } from "./badge-progress.js";
import { openBadgeShareModal } from "./badge-share.js";
import { getAuthState } from "./auth-state.js";
import { escapeHtml, escapeAttr } from "./utils.js";

let currentUser = null;

function init() {
  const badgeList = document.getElementById("badgeList");
  if (!badgeList) return;

  async function loadAndRender() {
    if (!currentUser) {
      badgeList.innerHTML = '<p class="badges-empty">Sign in to view badges.</p>';
      return;
    }

    badgeList.innerHTML = "<p class=\"badges-empty\">Loading…</p>";

    try {
      const progressMap = await getBadgeProgress(currentUser.uid);
      badgeList.innerHTML = "";

      for (const badge of BADGE_DEFINITIONS) {
        const prog = progressMap.get(badge.id) || { progress: 0, total: badge.days, unlocked: false };
        const card = document.createElement("div");
        card.className = "badge-card" + (prog.unlocked ? " badge-card--unlocked" : " badge-card--locked");
        card.dataset.badgeId = badge.id;

        const pct = prog.total > 0 ? Math.round((prog.progress / prog.total) * 100) : 0;
        const progressText = `${prog.progress} / ${prog.total} days`;

        card.innerHTML =
          `<div class="badge-card-icon">${escapeHtml(badge.icon)}</div>` +
          `<div class="badge-card-content">` +
          `<h3 class="badge-card-name">${escapeHtml(badge.name)}</h3>` +
          `<p class="badge-card-desc">${escapeHtml(badge.description)}</p>` +
          `<div class="badge-card-progress-wrap">` +
          `<div class="progress-bar badge-progress-bar">` +
          `<div class="progress-fill" style="width: ${pct}%;"></div>` +
          `</div>` +
          `<span class="badge-card-progress-text">${escapeHtml(progressText)}</span>` +
          `</div>` +
          (prog.unlocked
            ? `<button type="button" class="button-primary button-small badge-share-btn" data-badge-id="${escapeAttr(badge.id)}" data-badge-name="${escapeAttr(badge.name)}" data-badge-icon="${escapeAttr(badge.icon)}" data-badge-description="${escapeAttr(badge.description || "")}">Share</button>`
            : "")
          + `</div>`;

        badgeList.appendChild(card);
      }

      // Share button handlers
      badgeList.querySelectorAll(".badge-share-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const badge = {
            id: btn.dataset.badgeId,
            name: btn.dataset.badgeName,
            icon: btn.dataset.badgeIcon,
            description: btn.dataset.badgeDescription || "",
          };
          const profile = await getAuthState().getUserProfile();
          openBadgeShareModal(profile || {}, badge);
        });
      });
    } catch (err) {
      console.error("[Badges] Load error:", err);
      badgeList.innerHTML = '<p class="badges-empty muted-text">Could not load badges.</p>';
    }
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    loadAndRender();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
