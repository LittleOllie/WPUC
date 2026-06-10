const REVEAL_MS = 4800;
const FLASH_MS = 380;

function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}

/**
 * Golden-line twin reveal (Collection Overlap–style) before results.
 * @param {{ sourceImage: string, twinImage: string }} images
 */
export async function playTwinReveal({ sourceImage, twinImage }) {
  const stage = document.getElementById("ntf-reveal-stage");
  const halfA = document.getElementById("ntf-reveal-half-a");
  const halfB = document.getElementById("ntf-reveal-half-b");

  if (!stage || !halfA || !halfB || !sourceImage || !twinImage) {
    return;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    return;
  }

  await Promise.all([preloadImage(sourceImage), preloadImage(twinImage)]);

  halfA.style.backgroundImage = `url("${sourceImage}")`;
  halfB.style.backgroundImage = `url("${twinImage}")`;
  stage.style.setProperty("--reveal-duration", `${REVEAL_MS}ms`);

  stage.hidden = false;
  stage.classList.remove("ntf-reveal--flash");
  void stage.offsetWidth;
  stage.classList.add("ntf-reveal--active");

  return new Promise((resolve) => {
    window.setTimeout(() => {
      stage.classList.add("ntf-reveal--flash");
      window.setTimeout(() => {
        stage.classList.remove("ntf-reveal--active", "ntf-reveal--flash");
        stage.hidden = true;
        halfA.style.backgroundImage = "";
        halfB.style.backgroundImage = "";
        stage.style.removeProperty("--reveal-duration");
        resolve();
      }, FLASH_MS);
    }, REVEAL_MS);
  });
}
