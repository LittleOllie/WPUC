import { playPurpleLiquidTransition } from "./js/home-liquid-transition.js";
import { initBgCoverTracking } from "./js/bg-cover-point.js";

document.addEventListener("DOMContentLoaded", function () {
  initBgCoverTracking();

  const playgroundLink = document.getElementById("playgroundLink");
  if (!playgroundLink) return;

  let transitioning = false;

  playgroundLink.addEventListener("click", function (e) {
    if (transitioning) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const href = playgroundLink.getAttribute("href");
    if (!href) return;

    e.preventDefault();
    transitioning = true;
    playgroundLink.setAttribute("aria-disabled", "true");
    playgroundLink.style.pointerEvents = "none";

    playPurpleLiquidTransition(() => {
      window.location.href = href;
    });
  });
});
