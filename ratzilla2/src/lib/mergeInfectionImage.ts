import { getOverlayUrl } from "./infectionOverlays";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawCenteredInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number,
) {
  const scale = Math.min(
    rectWidth / image.naturalWidth,
    rectHeight / image.naturalHeight,
  );
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = rectX + (rectWidth - drawWidth) / 2;
  const offsetY = rectY + (rectHeight - drawHeight) / 2;

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export async function mergeInfectionImage(
  nftImage: HTMLImageElement,
  overlayFilename: string,
  underlayFilename?: string,
): Promise<Blob> {
  const overlay = await loadImage(getOverlayUrl(overlayFilename));
  const underlay = underlayFilename
    ? await loadImage(getOverlayUrl(underlayFilename))
    : null;

  const nftWidth = nftImage.naturalWidth;
  const nftHeight = nftImage.naturalHeight;
  const underlayHeight = underlay
    ? Math.round(nftWidth * (underlay.naturalHeight / underlay.naturalWidth))
    : 0;

  const canvas = document.createElement("canvas");
  canvas.width = nftWidth;
  canvas.height = nftHeight + underlayHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  if (underlay) {
    ctx.drawImage(underlay, 0, nftHeight, nftWidth, underlayHeight);
  }

  ctx.drawImage(nftImage, 0, 0, nftWidth, nftHeight);
  drawCenteredInRect(ctx, overlay, 0, 0, nftWidth, nftHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate infected image."));
          return;
        }
        resolve(blob);
      },
      "image/png",
      1,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function infectedFilename(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "nft";
  return `infected-${base}.png`;
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write) {
    throw new Error("Clipboard image copy is not supported.");
  }

  const pngBlob =
    blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });

  await navigator.clipboard.write([
    new ClipboardItem({
      "image/png": Promise.resolve(pngBlob),
    }),
  ]);
}

/** Phone / tablet — used for download-first share UX copy. */
export function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return true;
  if (/iPhone|iPod|iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** @deprecated Use isMobileDevice */
export const prefersMobileXShare = isMobileDevice;

export const X_INFECTION_SHARE_TEXT = `⚠️ INFECTION CONFIRMED ⚠️

I have been registered as a Blackwater Subject.

Containment protocols have failed.

How many more have been exposed?

@Blackwater_Z26

#BLACKWATERINFECTION`;

function buildXIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/**
 * Opens X compose with pre-filled message.
 * Desktop: x.com in a new tab. Mobile: X app via deep link, then web intent fallback.
 */
export function openXCompose(text: string): void {
  const webUrl = buildXIntentUrl(text);

  if (isMobileDevice()) {
    const appUrl = `twitter://post?message=${encodeURIComponent(text)}`;
    let fallbackTimer = 0;

    const clearFallback = () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };

    const onHide = () => {
      if (document.hidden) clearFallback();
    };

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide, { once: true });

    fallbackTimer = window.setTimeout(() => {
      clearFallback();
      window.location.assign(webUrl);
    }, 900);

    window.location.href = appUrl;
    return;
  }

  const opened = window.open(webUrl, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(webUrl);
}

/** Opens X compose — image is attached manually after download. */
export function shareInfectedToX(
  text: string = X_INFECTION_SHARE_TEXT,
): void {
  openXCompose(text);
}
