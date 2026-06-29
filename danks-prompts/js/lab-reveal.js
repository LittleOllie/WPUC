/**
 * After gloop fills — header slides to hero, then lab content appears.
 */

const HEADER_MS = 1050;

/**
 * @param {{
 *   applyLabBackground: () => void,
 *   onComplete: () => void,
 *   splashKey: string,
 * }} opts
 */
export function beginLabReveal({ applyLabBackground, onComplete, splashKey }) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const splash = document.getElementById("danks-splash");
  const main = document.getElementById("danks-main");
  const fromEl = document.getElementById("danks-splash-header");
  const toEl = document.getElementById("danks-header-image");

  applyLabBackground();
  document.body.classList.remove("danks-page--splash");
  document.body.classList.add("danks-page--revealing");

  if (main) {
    main.classList.remove("danks-main--hidden");
    main.classList.add("danks-main--content-hidden");
    main.setAttribute("aria-hidden", "false");
  }

  window.scrollTo(0, 0);

  if (reduced || !fromEl || !toEl) {
    finishLabReveal({ splashKey });
    onComplete();
    return;
  }

  const fromRect = fromEl.getBoundingClientRect();
  toEl.style.visibility = "hidden";
  const toRect = toEl.getBoundingClientRect();

  fromEl.classList.add("danks-header--flying");
  fromEl.style.top = `${fromRect.top}px`;
  fromEl.style.left = `${fromRect.left}px`;
  fromEl.style.width = `${fromRect.width}px`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fromEl.style.top = `${toRect.top}px`;
      fromEl.style.left = `${toRect.left}px`;
      fromEl.style.width = `${toRect.width}px`;
    });
  });

  window.setTimeout(() => {
    toEl.style.visibility = "";
    finishLabReveal({ splashKey, flyingEl: fromEl });
    onComplete();
  }, HEADER_MS);
}

/**
 * @param {{ splashKey: string, flyingEl?: HTMLElement | null }} opts
 */
export function finishLabReveal({ splashKey, flyingEl = null }) {
  const splash = document.getElementById("danks-splash");
  const main = document.getElementById("danks-main");
  const fromEl = flyingEl || document.getElementById("danks-splash-header");
  const toEl = document.getElementById("danks-header-image");
  const enterBtn = document.getElementById("danks-enter-btn");

  fromEl?.classList.remove("danks-header--flying");
  fromEl?.style.removeProperty("top");
  fromEl?.style.removeProperty("left");
  fromEl?.style.removeProperty("width");
  fromEl?.style.removeProperty("opacity");
  fromEl?.style.removeProperty("transition");

  toEl?.style.removeProperty("visibility");

  enterBtn?.classList.remove("danks-splash__enter--hide");
  enterBtn && (enterBtn.disabled = false);

  splash?.classList.add("danks-splash--hidden");
  splash?.classList.remove("danks-splash--melting");
  splash?.setAttribute("aria-hidden", "true");

  main?.classList.remove("danks-main--content-hidden");
  main?.classList.add("danks-main--content-visible");

  document.body.classList.remove("danks-page--entering", "danks-page--revealing");

  try {
    sessionStorage.setItem(splashKey, "1");
  } catch {
    /* ignore */
  }
}

export function resetLabRevealState() {
  const fromEl = document.getElementById("danks-splash-header");
  const toEl = document.getElementById("danks-header-image");
  const main = document.getElementById("danks-main");
  const enterBtn = document.getElementById("danks-enter-btn");

  fromEl?.classList.remove("danks-header--flying");
  fromEl?.style.removeProperty("top");
  fromEl?.style.removeProperty("left");
  fromEl?.style.removeProperty("width");
  fromEl?.style.removeProperty("opacity");
  fromEl?.style.removeProperty("transition");

  toEl?.style.removeProperty("visibility");

  enterBtn?.classList.remove("danks-splash__enter--hide");
  enterBtn && (enterBtn.disabled = false);

  main?.classList.remove("danks-main--content-hidden", "danks-main--content-visible");
}
