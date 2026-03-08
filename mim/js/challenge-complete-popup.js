/**
 * Challenge completion popup - user chooses Keep Habit or Remove Habit.
 * Returns a Promise that resolves with "keep" or "remove".
 */
let popupOpen = false;
let resolveChoice = null;

function hideChallengeCompletePopup() {
  const popup = document.getElementById("challengeCompletePopup");
  if (popup) {
    popup.hidden = true;
    popup.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  popupOpen = false;
}

let listenersInit = false;

function initListeners() {
  if (listenersInit) return;
  listenersInit = true;

  const popup = document.getElementById("challengeCompletePopup");
  const keepBtn = document.getElementById("challengeCompleteKeepBtn");
  const removeBtn = document.getElementById("challengeCompleteRemoveBtn");

  popup?.addEventListener("click", (e) => {
    if (e.target === popup) {
      if (resolveChoice) resolveChoice("keep");
      hideChallengeCompletePopup();
    }
  });

  keepBtn?.addEventListener("click", () => {
    if (resolveChoice) resolveChoice("keep");
    hideChallengeCompletePopup();
  });

  removeBtn?.addEventListener("click", () => {
    if (resolveChoice) resolveChoice("remove");
    hideChallengeCompletePopup();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popupOpen) {
      if (resolveChoice) resolveChoice("keep");
      hideChallengeCompletePopup();
    }
  });
}

/**
 * Show challenge completion popup. User chooses Keep Habit or Remove Habit.
 * @param {Object} challenge - Challenge def with name, icon, durationDays
 * @returns {Promise<"keep"|"remove">}
 */
export function showChallengeCompletePopup(challenge) {
  return new Promise((resolve) => {
    if (popupOpen && resolveChoice) {
      resolveChoice("keep");
    }
    resolveChoice = resolve;
    initListeners();

  const popup = document.getElementById("challengeCompletePopup");
  const nameEl = document.getElementById("challengeCompleteName");
  const iconEl = document.getElementById("challengeCompleteIcon");
  const subtitleEl = document.getElementById("challengeCompleteSubtitle");

  if (!popup) {
    resolve("keep");
    return;
  }

  if (nameEl) nameEl.textContent = challenge?.name || "Challenge";
  if (iconEl) iconEl.textContent = challenge?.icon || "🎯";
  if (subtitleEl) {
    const days = Number(challenge?.durationDays) ?? 7;
    subtitleEl.textContent = `${days} Days Complete`;
  }

  popup.hidden = false;
  popup.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  popupOpen = true;
  });
}
