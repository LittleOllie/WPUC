/** Public URLs and deployment-mode helpers (no secrets). */

export type DeploymentMode = "static-mock" | "server-live" | "server-mock";

export function getDeploymentMode(): DeploymentMode {
  if (process.env.NEXT_PUBLIC_USE_CLIENT_MOCK === "true") return "static-mock";
  const live = process.env.ENABLE_LIVE_X_API === "true" && process.env.ENABLE_MOCK_MODE !== "true";
  return live ? "server-live" : "server-mock";
}

export function isClientSideMock(): boolean {
  return process.env.NEXT_PUBLIC_USE_CLIENT_MOCK === "true";
}

/** Base path when hosted under /x-inner-circle on static site; empty on Vercel root. */
export function getPublicBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

/**
 * Avatar proxy prefix for SVG image hrefs.
 * Prefer NEXT_PUBLIC_APP_URL on Vercel so PNG export resolves absolute URLs.
 */
export function getAvatarProxyBase(): string {
  const basePath = getPublicBasePath();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (appUrl) return `${appUrl}${basePath}/api/avatar`;
  return `${basePath}/api/avatar`;
}

/** Upgrade Twitter _normal avatars to a larger variant when available. */
export function upgradeTwitterProfileImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/_normal\.(jpe?g|png|webp)(\?|$)/i.test(trimmed)) {
    return trimmed.replace(/_normal(\.(jpe?g|png|webp))(\?|$)/i, "_400x400$1$3");
  }
  if (/_normal(\?|$)/i.test(trimmed)) {
    return trimmed.replace(/_normal(\?|$)/i, "_400x400$1");
  }
  return trimmed;
}
