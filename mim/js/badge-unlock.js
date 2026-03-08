/**
 * Badge unlock popup - shown only when a badge unlock event occurs.
 * Uses controlled state; resets on page load. Never persists after refresh/navigation.
 */
import { openBadgeShareModal } from "./badge-share.js";

/** Controlled state — always false on page load */
let badgeUnlockPopupOpen = false;

let unlockPopupListenersInit = false;

function initUnlockPopupListeners() {
  if (unlockPopupListenersInit) return;
  unlockPopupListenersInit = true;

  const popup = document.getElementById("badgeUnlockPopup");
  const shareBtn = document.getElementById("badgeUnlockShareBtn");
  const closeBtn = document.getElementById("badgeUnlockCloseBtn");

  // Close on backdrop click (click outside content)
  popup?.addEventListener("click", (e) => {
    if (e.target === popup) hideBadgeUnlockPopup();
  });

  shareBtn?.addEventListener("click", () => {
    const nameEl = document.getElementById("badgeUnlockName");
    const iconEl = document.getElementById("badgeUnlockIcon");
    const badge = {
      name: nameEl?.textContent || "Badge",
      icon: iconEl?.textContent?.trim() || "🏆",
      id: popup?.dataset?.badgeId || "",
      description: popup?.dataset?.badgeDescription || "",
    };
    const profile = window.__badgeUnlockProfile || {};
    hideBadgeUnlockPopup();
    openBadgeShareModal(profile, badge);
  });

  closeBtn?.addEventListener("click", hideBadgeUnlockPopup);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && badgeUnlockPopupOpen) hideBadgeUnlockPopup();
  });
}

function hideBadgeUnlockPopup() {
  const popup = document.getElementById("badgeUnlockPopup");
  if (popup) {
    popup.hidden = true;
    popup.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  badgeUnlockPopupOpen = false;
}

/**
 * Ensure popup is closed on page load. Call when script loads.
 */
export function ensureBadgeUnlockPopupClosedOnLoad() {
  const popup = document.getElementById("badgeUnlockPopup");
  if (popup) {
    popup.hidden = true;
    popup.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  badgeUnlockPopupOpen = false;
}

/**
 * Show badge unlock popup. Only call when a badge has just been unlocked.
 * @param {{ id: string; name: string; icon: string; description?: string }} badge
 * @param {Object} profile - User profile (for share modal)
 */
export function showBadgeUnlockPopup(badge, profile = {}) {
  if (badgeUnlockPopupOpen) return;

  window.__badgeUnlockProfile = profile;
  initUnlockPopupListeners();

  const popup = document.getElementById("badgeUnlockPopup");
  const nameEl = document.getElementById("badgeUnlockName");
  const iconEl = document.getElementById("badgeUnlockIcon");

  if (!popup) return;

  if (nameEl) nameEl.textContent = badge?.name || "Badge";
  if (iconEl) iconEl.textContent = badge?.icon || "🏆";
  popup.dataset.badgeId = badge?.id || "";
  popup.dataset.badgeDescription = badge?.description || "";

  popup.hidden = false;
  popup.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  badgeUnlockPopupOpen = true;
}

// Ensure popup is closed on page load (never persist after refresh/navigation)
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBadgeUnlockPopupClosedOnLoad);
  } else {
    ensureBadgeUnlockPopupClosedOnLoad();
  }
}
