/** Loading overlay + status line helpers. */

import { $ } from "../core/dom.js";

function isDisclaimerBlocking() {
  const overlay = document.getElementById("disclaimerOverlay");
  return overlay && !overlay.classList.contains("hidden");
}

export function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

/** Let the browser paint (overlay + spinner) before blocking sync work. */
export function yieldToPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function restartLoadingSpinner(overlay) {
  const ring = overlay?.querySelector(".loading-overlay-ring");
  if (!ring) return;
  // display:none → flex skips animation start in some browsers — force a restart.
  ring.style.animation = "none";
  void ring.offsetHeight;
  ring.style.removeProperty("animation");
}

export function showLoading(message = "Loading…", progress = "") {
  if (isDisclaimerBlocking()) return;
  const overlay = $("loadingOverlay");
  const wasVisible = overlay?.classList.contains("visible");
  if (overlay) {
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");
    if (!wasVisible) restartLoadingSpinner(overlay);
  }
  const statusEl = $("loadingOverlayStatus");
  if (statusEl) {
    const line = [message, progress].filter((s) => s && String(s).trim()).join(" — ");
    statusEl.textContent = line || "";
  }
}

export function hideLoading() {
  const overlay = $("loadingOverlay");
  if (overlay) {
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
  }
  const statusEl = $("loadingOverlayStatus");
  if (statusEl) statusEl.textContent = "";
}

export function showConnectionStatus(_connected) {
  /* Reserved — no-op unless a connection indicator is present in DOM. */
}
