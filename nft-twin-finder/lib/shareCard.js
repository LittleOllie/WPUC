import { imageUrlCandidates } from "./imageUrls.js";

const HEADER_LOGO = new URL("../dopeornope/assets/lo1.png", import.meta.url).href;
const FOOTER_MASCOT = new URL("../LOCharacter.png", import.meta.url).href;
const FONT = '"Fredoka", ui-rounded, system-ui, sans-serif';

const COLORS = {
  navy: "#0f2f6e",
  white: "#ffffff",
  muted: "rgba(255, 255, 255, 0.88)",
  yellow: "#ffd84d",
  yellowBright: "#ffdf66",
  cardTop: "#ffec96",
  cardBottom: "#ffd84d",
  cardAccentTop: "#fff8d2",
  cardAccentBottom: "#ffe478",
  stageTop: "#ffdf66",
  stageBottom: "#ffc83c",
};

const LAYOUT = {
  width: 1080,
  padX: 48,
  padTop: 36,
  padBottom: 40,
  logoSize: 96,
  cardSize: 380,
  cardGap: 48,
};

/**
 * @param {CanvasRenderingContext2D} ctx
 */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 */
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

/**
 * @param {string} url
 * @param {{ tokenId?: string|number, imageUrlTemplate?: string, imageIpfsCid?: string }} [options]
 */
async function loadCanvasImage(url, options = {}) {
  const candidates = imageUrlCandidates(url, options);
  const sources = candidates.length ? candidates : [url];

  for (const src of sources) {
    if (!src) continue;
    try {
      return await loadCorsImage(src);
    } catch {
      /* try next gateway */
    }
  }

  throw new Error(`Could not load image: ${url}`);
}

/**
 * @param {string} src
 */
function loadCorsImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 */
function drawBackground(ctx, w, h) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#7bb9f9");
  gradient.addColorStop(0.45, "#4a8df3");
  gradient.addColorStop(1, "#2d6fd4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.22, 0, w * 0.5, h * 0.22, w * 0.48);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.1)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @returns {number} card height
 */
function drawTwinCard(ctx, x, y, cardW, { label, collectionName, tokenId, image, accent }) {
  const pad = 14;
  const labelSize = 22;
  const collectionSize = 24;
  const tokenSize = 30;
  const metaGap = 4;
  const stageSize = cardW - pad * 2;
  const cardH = pad + labelSize + 10 + stageSize + pad + collectionSize + metaGap + tokenSize + pad;

  roundRect(ctx, x, y, cardW, cardH, 24);
  const cardGradient = ctx.createLinearGradient(x, y, x, y + cardH);
  cardGradient.addColorStop(0, accent ? COLORS.cardAccentTop : COLORS.cardTop);
  cardGradient.addColorStop(1, accent ? COLORS.cardAccentBottom : COLORS.cardBottom);
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  let cursorY = y + pad;

  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${labelSize}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label.toUpperCase(), x + cardW / 2, cursorY);
  cursorY += labelSize + 10;

  const stageX = x + pad;
  const stageY = cursorY;

  roundRect(ctx, stageX, stageY, stageSize, stageSize, 18);
  const stageGradient = ctx.createLinearGradient(stageX, stageY, stageX, stageY + stageSize);
  stageGradient.addColorStop(0, COLORS.stageTop);
  stageGradient.addColorStop(1, COLORS.stageBottom);
  ctx.fillStyle = stageGradient;
  ctx.fill();

  if (image) {
    ctx.save();
    roundRect(ctx, stageX, stageY, stageSize, stageSize, 18);
    ctx.clip();
    const scale = Math.max(stageSize / image.width, stageSize / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(
      image,
      stageX + (stageSize - drawW) / 2,
      stageY + (stageSize - drawH) / 2,
      drawW,
      drawH,
    );
    ctx.restore();
  }

  cursorY = stageY + stageSize + pad;
  const metaMax = cardW - pad * 2;

  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 ${collectionSize}px ${FONT}`;
  ctx.fillText(truncateText(ctx, collectionName, metaMax), x + cardW / 2, cursorY);
  cursorY += collectionSize + metaGap;

  ctx.fillStyle = "rgba(15, 47, 110, 0.82)";
  ctx.font = `900 ${tokenSize}px ${FONT}`;
  ctx.fillText(`#${tokenId}`, x + cardW / 2, cursorY);

  return cardH;
}

function twinCardHeight(cardW) {
  const pad = 14;
  const labelSize = 22;
  const collectionSize = 24;
  const tokenSize = 30;
  const metaGap = 4;
  const stageSize = cardW - pad * 2;
  return pad + labelSize + 10 + stageSize + pad + collectionSize + metaGap + tokenSize + pad;
}

/**
 * @param {object} result
 * @param {number} [twinIndex]
 */
export async function exportTwinComparison(result, twinIndex = 0) {
  const { collection, token, twins } = result;
  const twin = twins[twinIndex];
  if (!twin) throw new Error("NO_TWIN_SELECTED");

  await document.fonts.ready;

  const [sourceImage, twinImage, headerLogo, footerMascot] = await Promise.all([
    loadCanvasImage(token.imageSrc || token.image, token.imageOptions).catch(() => null),
    loadCanvasImage(twin.imageSrc || twin.image, twin.imageOptions).catch(() => null),
    loadCorsImage(HEADER_LOGO).catch(() => null),
    loadCorsImage(FOOTER_MASCOT).catch(() => null),
  ]);

  const { width, padTop, padBottom, logoSize, cardSize, cardGap } = LAYOUT;
  const cardsWidth = cardSize * 2 + cardGap;
  const cardsLeft = (width - cardsWidth) / 2;

  const headerBlock = (headerLogo ? logoSize + 18 : 0) + 58 + 36 + 28;
  const cardsTop = padTop + headerBlock;
  const cardH = twinCardHeight(cardSize);
  const matchH = 52;
  const footerH = 36;
  const height = cardsTop + cardH + 28 + matchH + 32 + footerH + padBottom;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNSUPPORTED");

  drawBackground(ctx, width, height);

  y = padTop;

  if (headerLogo) {
    ctx.drawImage(headerLogo, (width - logoSize) / 2, y, logoSize, logoSize);
    y += logoSize + 18;
  }

  ctx.fillStyle = COLORS.white;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `900 58px ${FONT}`;
  ctx.fillText("YOUR TWINS", width / 2, y);
  y += 58;

  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText("Closest matches in the collection", width / 2, y + 8);
  y = cardsTop;

  const leftCardH = drawTwinCard(ctx, cardsLeft, y, cardSize, {
    label: "Your NFT",
    collectionName: collection.name,
    tokenId: token.id,
    image: sourceImage,
    accent: false,
  });

  ctx.fillStyle = COLORS.yellow;
  ctx.font = `900 52px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("×", cardsLeft + cardSize + cardGap / 2, y + leftCardH / 2);

  drawTwinCard(ctx, cardsLeft + cardSize + cardGap, y, cardSize, {
    label: `#${twinIndex + 1} Twin`,
    collectionName: collection.name,
    tokenId: twin.id,
    image: twinImage,
    accent: true,
  });

  const matchY = y + leftCardH + 28;
  const pillW = 260;
  const pillH = matchH;
  const pillX = (width - pillW) / 2;
  roundRect(ctx, pillX, matchY, pillW, pillH, 999);
  const pillGradient = ctx.createLinearGradient(pillX, matchY, pillX, matchY + pillH);
  pillGradient.addColorStop(0, COLORS.yellowBright);
  pillGradient.addColorStop(1, COLORS.yellow);
  ctx.fillStyle = pillGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#1e73ff";
  ctx.font = `900 28px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(`${twin.score.toFixed(1)}% Match`, width / 2, matchY + pillH / 2);

  const footerY = matchY + pillH + 32;
  const footerText = "Powered by Little Ollie Labs";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = `700 22px ${FONT}`;
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(footerText).width;
  const mascotSize = footerMascot ? 36 : 0;
  const mascotGap = footerMascot ? 10 : 0;
  const footerWidth = mascotSize + mascotGap + textWidth;
  let footerX = (width - footerWidth) / 2;

  if (footerMascot) {
    ctx.drawImage(footerMascot, footerX, footerY - mascotSize / 2, mascotSize, mascotSize);
    footerX += mascotSize + mascotGap;
  }

  ctx.textAlign = "left";
  ctx.fillText(footerText, footerX, footerY);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("EXPORT_FAILED"));
    }, "image/png");
  });

  const slug = collection.slug || "collection";
  const filename = `twin-finder-${slug}-${token.id}-vs-${twin.id}.png`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
