import { imageUrlCandidates } from "./imageUrls.js";

export const REVEAL_MS = 1600;
export const FLASH_MS = 380;
export const REVEAL_TOTAL_MS = REVEAL_MS + FLASH_MS;

const PRELOAD_TIMEOUT_MS = 8000;
const PER_CANDIDATE_MS = 4000;

/**
 * @param {string} src
 * @param {number} timeoutMs
 */
function tryLoadImage(src, timeoutMs) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      resolve(true);
    };
    img.onerror = () => {
      cleanup();
      resolve(false);
    };
    img.src = src;
  });
}

/**
 * Try image URL candidates in order; stop at the first load within the total budget.
 * @param {string} url
 * @param {{ tokenId?: string|number, imageUrlTemplate?: string, imageIpfsCid?: string }} [options]
 */
export async function preloadImage(url, options = {}) {
  if (!url) return null;

  const candidates = imageUrlCandidates(url, options);
  if (!candidates.length) return null;

  const deadline = Date.now() + PRELOAD_TIMEOUT_MS;
  for (const candidate of candidates) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    if (await tryLoadImage(candidate, Math.min(remaining, PER_CANDIDATE_MS))) {
      return candidate;
    }
  }

  return null;
}

/**
 * Golden-line twin reveal (Collection Overlap–style) before results.
 * @param {{
 *   sourceImage: string,
 *   twinImage: string,
 *   sourceOptions?: { tokenId?: string|number, imageUrlTemplate?: string, imageIpfsCid?: string },
 *   twinOptions?: { tokenId?: string|number, imageUrlTemplate?: string, imageIpfsCid?: string },
 * }} images
 */
export async function playTwinReveal({ sourceImage, twinImage, sourceOptions, twinOptions }) {
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

  const [resolvedSource, resolvedTwin] = await Promise.all([
    preloadImage(sourceImage, sourceOptions),
    preloadImage(twinImage, twinOptions),
  ]);

  if (resolvedSource) {
    halfA.style.backgroundImage = `url("${resolvedSource}")`;
  }
  if (resolvedTwin) {
    halfB.style.backgroundImage = `url("${resolvedTwin}")`;
  }
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
