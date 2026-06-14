export interface InfectionOverlay {
  id: string;
  name: string;
  filename: string;
  underlay?: string;
  default?: boolean;
}

const OVERLAYS_BASE = `${import.meta.env.BASE_URL}assets/infections`;

let overlayCache: InfectionOverlay[] | null = null;

export async function loadInfectionOverlays(): Promise<InfectionOverlay[]> {
  if (overlayCache) return overlayCache;

  const response = await fetch(`${OVERLAYS_BASE}/overlays.json`);
  if (!response.ok) {
    throw new Error("Failed to load infection overlays.");
  }

  overlayCache = (await response.json()) as InfectionOverlay[];
  return overlayCache;
}

export function getDefaultOverlay(
  overlays: InfectionOverlay[],
): InfectionOverlay {
  return overlays.find((overlay) => overlay.default) ?? overlays[0];
}

export function getOverlayUrl(filename: string): string {
  return `${OVERLAYS_BASE}/${filename}`;
}

export async function loadOverlayImage(filename: string): Promise<HTMLImageElement> {
  return loadImage(getOverlayUrl(filename));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export function loadFileImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load uploaded image."));
    };
    img.src = url;
  });
}

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function isAcceptedImageType(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(
    file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
  );
}
