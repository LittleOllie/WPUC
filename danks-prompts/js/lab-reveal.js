/**
 * After gloop fills — single header flies up, then moves into hero (no duplicate).
 */

const HEADER_MS = 1050;

function measureHeroHeaderTarget(slot, width) {
  const slotRect = slot.getBoundingClientRect();
  const w = Math.min(width, slotRect.width || width);
  const left = slotRect.left + Math.max(0, (slotRect.width - w) / 2);
  return { top: slotRect.top, left, width: w };
}

/** Move the one header back into the splash layout. */
export function restoreHeaderToSplash() {
  const header = document.getElementById("danks-splash-header");
  const splashInner = document.querySelector(".danks-splash__inner");
  if (!header || !splashInner) return;

  header.classList.remove("danks-header--flying", "danks-hero__header-landed");
  header.classList.add("danks-splash__logo");
  header.style.cssText = "";

  if (header.parentElement !== splashInner) {
    const btn = document.getElementById("danks-enter-btn");
    splashInner.insertBefore(header, btn || null);
  }
}

/** Park the one header in the hero slot (skip animation / return visits). */
export function mountHeaderInHero() {
  const header = document.getElementById("danks-splash-header");
  const slot = document.getElementById("danks-header-image");
  if (!header || !slot) return;

  header.classList.remove("danks-splash__logo", "danks-header--flying");
  header.classList.add("danks-hero__header-landed");
  header.style.cssText = "";

  if (header.parentElement !== slot) {
    slot.appendChild(header);
  }
}

export function cleanupRevealStyles() {
  const header = document.getElementById("danks-splash-header");
  const enterBtn = document.getElementById("danks-enter-btn");
  const main = document.getElementById("danks-main");

  header?.classList.remove("danks-header--flying");
  header?.style.removeProperty("top");
  header?.style.removeProperty("left");
  header?.style.removeProperty("width");
  header?.style.removeProperty("transform");
  header?.style.removeProperty("transition");

  enterBtn?.classList.remove("danks-splash__enter--hide");
  if (enterBtn) enterBtn.disabled = false;

  main?.classList.remove("danks-main--content-hidden", "danks-main--content-visible");
}

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
  const header = document.getElementById("danks-splash-header");
  const slot = document.getElementById("danks-header-image");

  applyLabBackground();
  document.body.classList.remove("danks-page--splash");
  document.body.classList.add("danks-page--revealing");

  if (main) {
    main.classList.remove("danks-main--hidden");
    main.classList.add("danks-main--content-hidden");
    main.setAttribute("aria-hidden", "false");
  }

  window.scrollTo(0, 0);

  if (reduced || !header || !slot) {
    finishLabReveal({ splashKey });
    onComplete();
    return;
  }

  const fromRect = header.getBoundingClientRect();

  // Escape splash stacking — one element, reparented to body for the flight.
  document.body.appendChild(header);

  header.classList.remove("danks-splash__logo");
  header.classList.add("danks-header--flying");
  header.style.top = `${fromRect.top}px`;
  header.style.left = `${fromRect.left}px`;
  header.style.width = `${fromRect.width}px`;

  const target = measureHeroHeaderTarget(slot, fromRect.width);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      header.style.top = `${target.top}px`;
      header.style.left = `${target.left}px`;
      header.style.width = `${target.width}px`;
    });
  });

  window.setTimeout(() => {
    finishLabReveal({ splashKey, headerEl: header });
    onComplete();
  }, HEADER_MS);
}

/**
 * @param {{ splashKey: string, headerEl?: HTMLElement | null }} opts
 */
export function finishLabReveal({ splashKey, headerEl = null }) {
  const splash = document.getElementById("danks-splash");
  const main = document.getElementById("danks-main");
  const header = headerEl || document.getElementById("danks-splash-header");
  const slot = document.getElementById("danks-header-image");
  const enterBtn = document.getElementById("danks-enter-btn");

  if (header && slot) {
    const lastRect = header.getBoundingClientRect();

    slot.appendChild(header);
    header.classList.remove("danks-header--flying", "danks-splash__logo");
    header.classList.add("danks-hero__header-landed");
    header.style.transition = "none";
    header.style.top = "";
    header.style.left = "";
    header.style.width = "";

    const newRect = header.getBoundingClientRect();
    const dx = lastRect.left - newRect.left;
    const dy = lastRect.top - newRect.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      header.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        header.style.transform = "";
      });
    }
  }

  splash?.classList.add("danks-splash--hidden");
  splash?.setAttribute("aria-hidden", "true");

  enterBtn?.classList.remove("danks-splash__enter--hide");
  if (enterBtn) enterBtn.disabled = false;

  main?.classList.remove("danks-main--content-hidden");
  main?.classList.add("danks-main--content-visible");

  document.body.classList.remove("danks-page--entering", "danks-page--revealing");

  try {
    sessionStorage.setItem(splashKey, "1");
  } catch {
    /* ignore */
  }
}

/** Full reset when returning to splash. */
export function resetLabRevealState() {
  cleanupRevealStyles();
  restoreHeaderToSplash();
}
