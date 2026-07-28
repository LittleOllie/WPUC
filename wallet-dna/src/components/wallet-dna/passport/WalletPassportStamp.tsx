import type { WalletPassportStamp as Stamp } from "@/lib/wallet-dna/types";

export type WalletPassportStampProps = {
  stamp: Stamp;
  size: "small" | "medium" | "large";
  rotation: number;
  opacity?: number;
};

const STYLE_COLORS: Record<Stamp["styleKey"], { border: string; text: string; bg: string }> = {
  ethereum: { border: "#4338ca", text: "#312e81", bg: "rgba(67,56,202,0.08)" },
  base: { border: "#2563eb", text: "#1e40af", bg: "rgba(37,99,235,0.1)" },
  veteran: { border: "#ca8a04", text: "#854d0e", bg: "rgba(234,179,8,0.1)" },
  diamond: { border: "#0891b2", text: "#155e75", bg: "rgba(6,182,212,0.1)" },
  mint: { border: "#ea580c", text: "#9a3412", bg: "rgba(249,115,22,0.1)" },
  explorer: { border: "#7c3aed", text: "#5b21b6", bg: "rgba(124,58,237,0.08)" },
  loyalty: { border: "#d97706", text: "#92400e", bg: "rgba(217,119,6,0.1)" },
  vault: { border: "#6366f1", text: "#4338ca", bg: "rgba(99,102,241,0.1)" },
  multichain: { border: "#4c6fff", text: "#1e3a8a", bg: "rgba(76,111,255,0.1)" },
  default: { border: "#4c6fff", text: "#1a1a2e", bg: "rgba(255,221,85,0.15)" },
};

const SIZE_PX = { small: 88, medium: 108, large: 128 };

function StampIcon({ iconKey }: { iconKey: string }) {
  const paths: Record<string, string> = {
    helix: "M12 4c4 0 4 8 0 8s-4 8 0 8",
    ethereum: "M12 4l-4 8 4 3 4-3-4-8z",
    base: "M6 12h12M12 6v12",
    multichain: "M4 12h16M12 4v16",
    veteran: "M12 8l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z",
    diamond: "M12 5l7 7-7 7-7-7z",
    freeze: "M12 4v16M4 12h16M7 7l10 10M17 7L7 17",
    mint: "M8 16l8-8M8 8h8v8",
    explorer: "M4 12h16M12 4l4 8-4 8-4-8z",
    loyalty: "M12 20s-8-4.5-8-10a5 5 0 0110 0c0 5.5-8 10-8 10z",
    vault: "M6 10h12v10H6z M9 10V7a3 3 0 016 0v3",
  };
  const d = paths[iconKey] ?? paths.helix!;
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WalletPassportStamp({ stamp, size, rotation, opacity = 0.88 }: WalletPassportStampProps) {
  const px = SIZE_PX[size];
  const colors = STYLE_COLORS[stamp.styleKey];

  return (
    <div
      className="wdna-passport-stamp"
      style={{
        width: px,
        height: px,
        transform: `rotate(${rotation}deg)`,
        opacity,
        ["--stamp-border" as string]: colors.border,
        ["--stamp-text" as string]: colors.text,
        ["--stamp-bg" as string]: colors.bg,
      }}
    >
      <div className="wdna-passport-stamp__ring">
        <div className="wdna-passport-stamp__icon">
          <StampIcon iconKey={stamp.iconKey} />
        </div>
        <p className="wdna-passport-stamp__label">{stamp.label}</p>
        {stamp.subtext && <p className="wdna-passport-stamp__sub">{stamp.subtext}</p>}
        {stamp.dateText && <p className="wdna-passport-stamp__date">{stamp.dateText}</p>}
      </div>
    </div>
  );
}
