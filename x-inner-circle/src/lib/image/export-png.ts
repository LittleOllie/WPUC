import { IMAGE_CONFIG } from "@/lib/config";
import { sanitiseSvgMarkup } from "@/lib/image/svg-generator";

/** Browser-side PNG export from SVG markup. */
export async function exportSvgToPng(
  svgMarkup: string,
  opts?: { scale?: number; background?: string },
): Promise<Blob> {
  const scale = opts?.scale ?? 1;
  const background = opts?.background ?? "#ffffff";
  const safe = sanitiseSvgMarkup(svgMarkup);
  const blob = new Blob([safe], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const w = IMAGE_CONFIG.canvasSize * scale;
    const h = IMAGE_CONFIG.canvasSize * scale;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
    });
    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load SVG image"));
    img.src = src;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportHighResPng(svgMarkup: string): Promise<Blob> {
  return exportSvgToPng(svgMarkup, { scale: IMAGE_CONFIG.highResScale });
}
