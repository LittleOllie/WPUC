/**
 * Map normalized image points → viewport pixels for .hero-bg (background-size: cover).
 * Stays in sync with styles/site-labs-bg.css on resize and breakpoint changes.
 */

const MOBILE_MQ = "(max-width: 768px)";

const BG_META = {
  desktop: {
    src: new URL("../assets/websiteComputerBG.png", import.meta.url).href,
    width: 2588,
    height: 1464,
    beakers: {
      left: { x: 0.375, y: 0.655 },
      right: { x: 0.519, y: 0.635 },
    },
  },
  mobile: {
    src: new URL("../assets/iphoneWebsiteBG.png", import.meta.url).href,
    width: 822,
    height: 1464,
    beakers: {
      left: { x: 0.363, y: 0.722 },
      right: { x: 0.613, y: 0.702 },
    },
  },
};

let initPromise = null;

function loadImageSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function initBgCoverTracking() {
  if (!initPromise) {
    initPromise = Promise.all(
      Object.values(BG_META).map(async (meta) => {
        const size = await loadImageSize(meta.src);
        if (size) {
          meta.width = size.width;
          meta.height = size.height;
        }
      })
    );
  }
  return initPromise;
}

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    w: Math.round(vv?.width ?? window.innerWidth),
    h: Math.round(vv?.height ?? window.innerHeight),
  };
}

function isMobileLayout() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function getActiveMeta() {
  return isMobileLayout() ? BG_META.mobile : BG_META.desktop;
}

function parseBgAxis(keyword, viewport, scaled) {
  const key = (keyword || "center").trim().toLowerCase();
  if (key === "center") return (viewport - scaled) / 2;
  if (key === "left" || key === "top") return 0;
  if (key === "right" || key === "bottom") return viewport - scaled;
  if (key.endsWith("%")) {
    const pct = parseFloat(key) / 100;
    if (Number.isFinite(pct)) return (viewport - scaled) * pct;
  }
  return (viewport - scaled) / 2;
}

function readBgPosition(viewW, viewH, scaledW, scaledH) {
  const el = document.querySelector(".hero-bg");
  if (!el) {
    const mobile = isMobileLayout();
    return {
      offsetX: (viewW - scaledW) / 2,
      offsetY: mobile ? viewH - scaledH : (viewH - scaledH) / 2,
    };
  }

  const parts = getComputedStyle(el).backgroundPosition.trim().split(/\s+/);
  const posX = parts[0] || "center";
  const posY = parts[1] || parts[0] || "center";

  return {
    offsetX: parseBgAxis(posX, viewW, scaledW),
    offsetY: parseBgAxis(posY, viewH, scaledH),
  };
}

/**
 * @param {number} normX 0–1 across source image
 * @param {number} normY 0–1 down source image
 */
export function imagePointToViewport(normX, normY, viewW, viewH) {
  const meta = getActiveMeta();
  const scale = Math.max(viewW / meta.width, viewH / meta.height);
  const scaledW = meta.width * scale;
  const scaledH = meta.height * scale;
  const { offsetX, offsetY } = readBgPosition(viewW, viewH, scaledW, scaledH);

  return {
    x: offsetX + normX * meta.width * scale,
    y: offsetY + normY * meta.height * scale,
  };
}

/**
 * @param {"left" | "right"} beakerId
 */
export function getBeakerOrigin(beakerId, viewW, viewH) {
  const meta = getActiveMeta();
  const beaker = meta.beakers[beakerId];
  if (!beaker) return { x: viewW / 2, y: viewH / 2 };
  return imagePointToViewport(beaker.x, beaker.y, viewW, viewH);
}

export function getCurrentViewportSize() {
  return getViewportSize();
}
