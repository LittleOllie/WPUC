import { APP_CONFIG, IMAGE_CONFIG, RING_COLORS, type RingKey } from "@/lib/config";
import type { CandidateAccount, TargetAccount } from "@/lib/analysis/types";
import { upgradeTwitterProfileImageUrl } from "@/lib/deployment";
import { computeAvatarPositions, type AvatarSlot } from "@/lib/image/layout";

export interface SvgGeneratorOptions {
  proxyBase?: string;
  generatedAt?: string;
  /** Static / mock hosts have no avatar proxy — render initials instead of broken images. */
  useInitialsOnly?: boolean;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function initials(name: string, username?: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]![0] ?? "") + (parts[1]![0] ?? "")).toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase();
  if (username && username.length >= 2) return username.slice(0, 2).toUpperCase();
  return "?";
}

function clipId(username: string, x: number, y: number): string {
  return `clip-${username.replace(/[^a-zA-Z0-9_-]/g, "")}-${Math.round(x)}-${Math.round(y)}`;
}

function shouldUseInitials(
  account: { profileImageUrl: string | null },
  opts: SvgGeneratorOptions,
): boolean {
  if (opts.useInitialsOnly) return true;
  const url = account.profileImageUrl?.trim() ?? "";
  if (!url) return true;
  if (/\/mock\//i.test(url) || url.includes("placeholder")) return true;
  return false;
}

function avatarNode(
  slot: AvatarSlot,
  account: { username: string; displayName: string; profileImageUrl: string | null },
  opts: SvgGeneratorOptions,
  clipDefs: string[],
): string {
  const { x, y, size } = slot;
  const r = size / 2;
  const label = initials(account.displayName, account.username);

  if (shouldUseInitials(account, opts)) {
    return `
      <g>
        <circle cx="${x}" cy="${y}" r="${r}" fill="#6366f1" stroke="#fff" stroke-width="3" />
        <text x="${x}" y="${y + 5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.max(12, Math.round(r * 0.55))}" font-weight="700" fill="#fff">${escapeXml(label)}</text>
      </g>`;
  }

  const proxyBase = opts.proxyBase ?? "";
  const imageUrl = upgradeTwitterProfileImageUrl(account.profileImageUrl) ?? account.profileImageUrl!;
  const href = `${proxyBase}?url=${encodeURIComponent(imageUrl)}`;
  const id = clipId(account.username, x, y);
  clipDefs.push(`<clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r - 2}" /></clipPath>`);

  return `
    <g>
      <circle cx="${x}" cy="${y}" r="${r}" fill="#e2e8f0" stroke="#fff" stroke-width="3" />
      <image href="${escapeXml(href)}" x="${x - r}" y="${y - r}" width="${size}" height="${size}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice" />
    </g>`;
}

export function generateCircleSvg(
  target: TargetAccount,
  rings: Record<RingKey, CandidateAccount[]>,
  opts: SvgGeneratorOptions = {},
): string {
  const size = IMAGE_CONFIG.canvasSize;
  const cx = size / 2;
  const cy = size / 2;
  const dateStr = opts.generatedAt ?? new Date().toISOString().slice(0, 10);
  const clipDefs: string[] = [];

  const ringKeys: RingKey[] = ["community", "goodFriends", "besties", "inner"];
  const ringBands = ringKeys
    .map((key) => {
      const radius = IMAGE_CONFIG.ringRadii[key];
      return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${RING_COLORS[key]}" stroke-width="6" opacity="0.4" />`;
    })
    .join("");

  let avatars = "";
  for (const key of ["inner", "besties", "goodFriends", "community"] as RingKey[]) {
    const positions = computeAvatarPositions(key, rings[key]?.length ?? 0);
    const accounts = rings[key] ?? [];
    positions.forEach((pos, i) => {
      const account = accounts[i];
      if (!account) return;
      avatars += avatarNode(pos, account, opts, clipDefs);
    });
  }

  const targetR = IMAGE_CONFIG.targetAvatarSize / 2;
  const targetInitials = initials(target.displayName, target.username);
  let targetCenter: string;

  if (shouldUseInitials(target, opts)) {
    targetCenter = `
      <circle cx="${cx}" cy="${cy}" r="${targetR}" fill="#4f46e5" stroke="#fff" stroke-width="4" />
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="800" fill="#fff">${escapeXml(targetInitials)}</text>`;
  } else {
    const id = "targetClip";
    clipDefs.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${targetR - 2}" /></clipPath>`);
    const imageUrl = upgradeTwitterProfileImageUrl(target.profileImageUrl) ?? target.profileImageUrl!;
    const href = `${opts.proxyBase ?? "/api/avatar"}?url=${encodeURIComponent(imageUrl)}`;
    targetCenter = `
      <circle cx="${cx}" cy="${cy}" r="${targetR}" fill="#e2e8f0" stroke="#fff" stroke-width="4" />
      <image href="${escapeXml(href)}" x="${cx - targetR}" y="${cy - targetR}" width="${IMAGE_CONFIG.targetAvatarSize}" height="${IMAGE_CONFIG.targetAvatarSize}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice" />`;
  }

  const defsBlock = clipDefs.length ? `<defs>${clipDefs.join("")}</defs>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="X inner circle for @${escapeXml(target.username)}">
  ${defsBlock}
  <rect width="100%" height="100%" fill="${RING_COLORS.background}" />
  ${ringBands}
  ${avatars}
  ${targetCenter}
  <text x="${cx}" y="${size - 88}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="30" font-weight="800" fill="${RING_COLORS.text}">@${escapeXml(target.username)}</text>
  <text x="${cx}" y="${size - 52}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="${RING_COLORS.muted}">${escapeXml(APP_CONFIG.disclaimer)}</text>
  <text x="40" y="${size - 20}" font-family="system-ui,sans-serif" font-size="14" fill="${RING_COLORS.muted}">${escapeXml(APP_CONFIG.brandingCorner)}</text>
  ${APP_CONFIG.showGeneratedDate ? `<text x="${size - 40}" y="${size - 20}" text-anchor="end" font-family="system-ui,sans-serif" font-size="14" fill="${RING_COLORS.muted}">${escapeXml(dateStr)}</text>` : ""}
</svg>`;
}

export function sanitiseSvgMarkup(svg: string): string {
  return svg.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/on\w+="[^"]*"/gi, "");
}
