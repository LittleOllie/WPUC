import { basePath } from "@/lib/wallet-dna/client";
import { isProxiableImageUrl } from "@/lib/wallet-dna/utils/image-proxy";

const apiBase = process.env.NEXT_PUBLIC_WALLET_DNA_API_BASE?.replace(/\/$/, "") || "";
const EXPORT_IMAGE_MAX_DIMENSION = 960;

function proxyEndpoint(): string {
  if (typeof window !== "undefined" && apiBase) return `${apiBase}/api/wallet-dna/image-proxy`;
  return `${basePath}/api/wallet-dna/image-proxy`;
}

function resolveAbsoluteUrl(src: string): string {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}

function isSameOriginUrl(src: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const u = new URL(src, window.location.origin);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function looksLikeImageUrl(url: string, mime: string): boolean {
  if (mime.startsWith("image/")) return true;
  if (mime === "application/octet-stream" || mime === "binary/octet-stream") {
    return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(url);
  }
  return false;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressBitmapToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<string | null> {
  const scale = Math.min(1, EXPORT_IMAGE_MAX_DIMENSION / Math.max(width, height, 1));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, outW, outH);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

async function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  const absolute = resolveAbsoluteUrl(src);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    if (!isSameOriginUrl(absolute)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = absolute;
  });
}

async function fetchImageAsDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:")) return src;

  const absolute = resolveAbsoluteUrl(src);

  try {
    if (isSameOriginUrl(absolute)) {
      const res = await fetch(absolute);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!looksLikeImageUrl(absolute, blob.type)) return null;

      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(blob);
        const dataUrl = await compressBitmapToDataUrl(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
        return dataUrl;
      }

      const raw = await blobToDataUrl(blob);
      const img = await loadImageElement(raw);
      if (!img?.naturalWidth) return raw;
      return compressBitmapToDataUrl(img, img.naturalWidth, img.naturalHeight);
    }

    if (!isProxiableImageUrl(absolute)) return null;

    const proxyUrl = `${proxyEndpoint()}?url=${encodeURIComponent(absolute)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!looksLikeImageUrl(absolute, blob.type)) return null;
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

async function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  if (img.decode) {
    try {
      await img.decode();
    } catch {
      /* ignore decode errors */
    }
  }
}

async function rasterizeImageElement(img: HTMLImageElement): Promise<string | null> {
  await waitForImage(img);
  if (!img.naturalWidth || !img.naturalHeight) return null;
  return compressBitmapToDataUrl(img, img.naturalWidth, img.naturalHeight);
}

function makeFallbackEl(className: string, label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `wdna-nft-fallback ${className}`.trim();
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.innerHTML =
    '<span class="wdna-nft-fallback__glyph" aria-hidden="true">🧬</span><span class="wdna-nft-fallback__name">NFT</span>';
  return el;
}

async function inlineCloneImage(
  cloneImg: HTMLImageElement,
  liveImg: HTMLImageElement | undefined,
  src: string,
): Promise<boolean> {
  let dataUrl: string | null = null;

  if (liveImg) {
    dataUrl = await rasterizeImageElement(liveImg);
  }

  if (!dataUrl) {
    dataUrl = await fetchImageAsDataUrl(src);
  }

  if (!dataUrl) {
    const loaded = await loadImageElement(src);
    if (loaded?.naturalWidth) {
      dataUrl = await compressBitmapToDataUrl(
        loaded,
        loaded.naturalWidth,
        loaded.naturalHeight,
      );
    }
  }

  if (!dataUrl) {
    try {
      const absolute = resolveAbsoluteUrl(src);
      if (isSameOriginUrl(absolute)) {
        dataUrl = await rasterizeImageElement(cloneImg);
      }
    } catch {
      /* ignore invalid URL */
    }
  }

  if (!dataUrl) return false;

  cloneImg.src = dataUrl;
  cloneImg.removeAttribute("crossorigin");
  cloneImg.removeAttribute("srcset");
  cloneImg.loading = "eager";
  await waitForImage(cloneImg);
  return true;
}

/** Inline remote images as data URLs so canvas export is not tainted. */
export async function prepareShareCardForExport(
  root: HTMLElement,
  liveRoot?: HTMLElement | null,
): Promise<boolean> {
  const cloneImgs = Array.from(root.querySelectorAll("img"));
  const liveImgs = liveRoot ? Array.from(liveRoot.querySelectorAll("img")) : [];
  let allOk = true;

  await Promise.all(
    cloneImgs.map(async (cloneImg, index) => {
      const src = cloneImg.getAttribute("src");
      if (!src || src.startsWith("data:")) return;

      const ok = await inlineCloneImage(cloneImg, liveImgs[index], src);
      if (ok) return;

      allOk = false;
      const label = cloneImg.getAttribute("alt") ?? "NFT artwork";
      const fallback = makeFallbackEl(cloneImg.className, label);
      cloneImg.replaceWith(fallback);
    }),
  );

  return allOk;
}

export function shareHighlightFacts(
  highlights: Array<{ type: string; supportingText?: string; subtitle?: string; collection?: { collectionName: string; currentQuantity: number; chain: string } }>,
): string[] {
  const facts: string[] = [];

  for (const h of highlights) {
    if (h.type === "most-active-chain") continue;

    if (h.type === "most-held-collection" && h.collection) {
      facts.push(
        `${h.collection.collectionName} · ${h.collection.currentQuantity} currently held · ${h.collection.chain}`,
      );
      continue;
    }

    const text = h.supportingText ?? h.subtitle ?? "";
    if (!text || /NaN|Invalid Date/i.test(text)) continue;
    facts.push(text);
    if (facts.length >= 2) break;
  }

  return facts;
}
