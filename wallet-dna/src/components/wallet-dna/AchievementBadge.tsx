import type { CSSProperties } from "react";
import type { WalletBadge } from "@/lib/wallet-dna/types";

const BADGE_VISUALS: Record<
  string,
  { ring: string; glow: string; icon: string }
> = {
  diamond: { ring: "#22d3ee", glow: "rgba(34,211,238,0.35)", icon: "diamond" },
  freeze: { ring: "#67e8f9", glow: "rgba(103,232,249,0.3)", icon: "freeze" },
  base: { ring: "#2563eb", glow: "rgba(37,99,235,0.35)", icon: "base" },
  "base-native": { ring: "#3b82f6", glow: "rgba(59,130,246,0.35)", icon: "base" },
  veteran: { ring: "#eab308", glow: "rgba(234,179,8,0.35)", icon: "veteran" },
  explorer: { ring: "#a855f7", glow: "rgba(168,85,247,0.35)", icon: "explorer" },
  world: { ring: "#38bdf8", glow: "rgba(56,189,248,0.35)", icon: "multichain" },
  loyalty: { ring: "#f59e0b", glow: "rgba(245,158,11,0.35)", icon: "loyalty" },
  mint: { ring: "#f97316", glow: "rgba(249,115,22,0.35)", icon: "mint" },
  vault: { ring: "#6366f1", glow: "rgba(99,102,241,0.35)", icon: "vault" },
  crew: { ring: "#ec4899", glow: "rgba(236,72,153,0.35)", icon: "crew" },
  genesis: { ring: "#ffdd55", glow: "rgba(255,221,85,0.4)", icon: "genesis" },
};

const ICON_PATHS: Record<string, string> = {
  diamond: "M12 5l7 7-7 7-7-7z",
  freeze: "M12 4v16M4 12h16M7 7l10 10M17 7L7 17",
  base: "M6 12h12M12 6v12",
  veteran: "M12 8l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z",
  explorer: "M4 12h16M12 4l4 8-4 8-4-8z",
  multichain: "M4 12h16M12 4v16",
  loyalty: "M12 20s-8-4.5-8-10a5 5 0 0110 0c0 5.5-8 10-8 10z",
  mint: "M8 16l8-8M8 8h8v8",
  vault: "M6 10h12v10H6z M9 10V7a3 3 0 016 0v3",
  crew: "M8 11a3 3 0 106 0M5 20a7 7 0 0114 0",
  genesis: "M12 4l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z",
  helix: "M12 4c4 0 4 8 0 8s-4 8 0 8",
};

function BadgeIcon({ iconKey }: { iconKey: string }) {
  const d = ICON_PATHS[iconKey] ?? ICON_PATHS.helix!;
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Props = {
  badge: WalletBadge;
  size?: "md" | "sm";
};

export function AchievementBadge({ badge, size = "md" }: Props) {
  const visual = BADGE_VISUALS[badge.iconKey] ?? {
    ring: "#ffdd55",
    glow: "rgba(255,221,85,0.3)",
    icon: badge.iconKey,
  };
  const unlocked = badge.unlocked;

  return (
    <article
      className={`wdna-achievement-badge${unlocked ? " wdna-achievement-badge--unlocked" : " wdna-achievement-badge--locked"}${size === "sm" ? " wdna-achievement-badge--sm" : ""}`}
      style={
        unlocked
          ? ({
              ["--badge-ring" as string]: visual.ring,
              ["--badge-glow" as string]: visual.glow,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="wdna-achievement-badge__medal" aria-hidden="true">
        <BadgeIcon iconKey={visual.icon} />
      </div>
      <div className="wdna-achievement-badge__copy">
        <h4>{badge.name}</h4>
        <p>{unlocked ? (badge.unlockedReason ?? badge.description) : badge.description}</p>
      </div>
    </article>
  );
}
