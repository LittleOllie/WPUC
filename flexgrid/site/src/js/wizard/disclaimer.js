/**
 * Disclaimer overlay — dismissed for the current browser tab session.
 * Dev: ?disclaimer=1 or sessionStorage.removeItem('flexgrid_disclaimer_dismissed_v1')
 */

const SESSION_KEY = "flexgrid_disclaimer_dismissed_v1";
let disclaimerBound = false;

export function initDisclaimer() {
  if (disclaimerBound) return;
  const overlay = document.getElementById("disclaimerOverlay");
  const btn = document.getElementById("disclaimerContinue");
  if (!overlay) return;
  if (overlay.dataset.disclaimerBound === "1") {
    disclaimerBound = true;
    return;
  }
  disclaimerBound = true;

  const forceShow =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("disclaimer") === "1";

  if (!forceShow) {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") {
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
        return;
      }
    } catch (_) {
      /* private mode */
    }
  }

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  function dismissDisclaimer() {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (_) {}
  }

  if (btn) btn.addEventListener("click", dismissDisclaimer);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismissDisclaimer();
  });
  overlay.dataset.disclaimerBound = "1";
}
