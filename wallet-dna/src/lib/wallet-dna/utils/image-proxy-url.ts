import { isProxiableImageUrl } from "@/lib/wallet-dna/utils/image-proxy";

export function getImageProxyEndpoint(): string {
  const apiBase = process.env.NEXT_PUBLIC_WALLET_DNA_API_BASE?.replace(/\/$/, "") || "";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (typeof window !== "undefined" && apiBase) {
    return `${apiBase}/api/wallet-dna/image-proxy`;
  }
  return `${basePath}/api/wallet-dna/image-proxy`;
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

/** Resolve a remote NFT image URL through the app proxy when needed. */
export function getProxiedImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  if (isSameOriginUrl(raw)) return raw;
  if (isProxiableImageUrl(raw)) {
    return `${getImageProxyEndpoint()}?url=${encodeURIComponent(raw)}`;
  }
  return raw;
}
