const maskCache = new Map();

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Rasterize a grass PNG once for alpha sampling (transparent sky / empty areas).
 */
export async function loadGrassMask(src) {
  if (maskCache.has(src)) return maskCache.get(src);

  const img = new Image();
  img.decoding = "async";
  img.src = src;

  await new Promise((resolve, reject) => {
    if (img.complete) resolve();
    else {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`grass mask: ${src}`));
    }
  });

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  const mask = { w, h, data };
  maskCache.set(src, mask);
  return mask;
}

export function preloadGrassMasks(sources) {
  return Promise.all(sources.map((src) => loadGrassMask(src).catch(() => null)));
}

function sampleAlpha(mask, u, v) {
  const x = Math.floor(clamp(u, 0, 1) * (mask.w - 1));
  const y = Math.floor(clamp(1 - v, 0, 1) * (mask.h - 1));
  return mask.data[(y * mask.w + x) * 4 + 3];
}

/** object-fit: contain + object-position: bottom center */
function displayedImageRect(img) {
  const box = img.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return null;

  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return null;

  const boxAspect = box.width / box.height;
  const imgAspect = nw / nh;

  let drawW;
  let drawH;
  if (imgAspect > boxAspect) {
    drawW = box.width;
    drawH = box.width / imgAspect;
  } else {
    drawH = box.height;
    drawW = box.height * imgAspect;
  }

  const left = box.left + (box.width - drawW) * 0.5;
  const top = box.top + (box.height - drawH);

  return { left, top, width: drawW, height: drawH };
}

/**
 * True when pointer is over opaque grass in this tile (not transparent sky).
 */
export function hitTestGrassTile(clientX, clientY, img, mask, alphaThreshold = 72) {
  if (!mask || !img?.complete) return false;

  const draw = displayedImageRect(img);
  if (!draw) return false;

  if (
    clientX < draw.left ||
    clientX > draw.left + draw.width ||
    clientY < draw.top ||
    clientY > draw.top + draw.height
  ) {
    return false;
  }

  const u = (clientX - draw.left) / draw.width;
  const v = 1 - (clientY - draw.top) / draw.height;
  return sampleAlpha(mask, u, v) >= alphaThreshold;
}

/**
 * Front → middle → back; any opaque blade counts as grass contact.
 */
export function hitTestGrassLayers(clientX, clientY, layerTiles, layerMasks) {
  return findHoveredGrassTile(clientX, clientY, layerTiles, layerMasks) != null;
}

/** Topmost grass PNG under the pointer (front layer wins). */
export function findHoveredGrassTile(clientX, clientY, layerTiles, layerMasks) {
  for (let li = layerTiles.length - 1; li >= 0; li--) {
    const tiles = layerTiles[li];
    const mask = layerMasks[li];
    if (!tiles?.length || !mask) continue;

    for (let t = 0; t < tiles.length; t++) {
      const img = tiles[t].querySelector(".grass-tile__img");
      if (hitTestGrassTile(clientX, clientY, img, mask)) {
        return { layer: li, tile: t };
      }
    }
  }
  return null;
}
