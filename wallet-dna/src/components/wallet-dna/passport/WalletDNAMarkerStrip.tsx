import type { PlacedStamp } from "@/lib/wallet-dna/passport/passport-layout";
import type { WalletPassportStamp as Stamp } from "@/lib/wallet-dna/types";

type Props = {
  stamps: PlacedStamp[];
  visible: boolean;
  layout?: "strip" | "float";
  compact?: boolean;
};

const MARKER_COLORS: Record<Stamp["styleKey"], string> = {
  ethereum: "#818cf8",
  base: "#60a5fa",
  veteran: "#fbbf24",
  diamond: "#22d3ee",
  mint: "#fb923c",
  explorer: "#c084fc",
  loyalty: "#f59e0b",
  vault: "#a78bfa",
  multichain: "#6de0ff",
  default: "#ffdd55",
};

export function WalletDNAMarkerStrip({ stamps, visible, layout = "strip", compact }: Props) {
  if (!visible || !stamps.length || layout === "float") return null;

  return (
    <div className={`wdna-dna-card__markers${compact ? " wdna-dna-card__markers--compact" : ""}`} aria-hidden="true">
      {!compact && <span className="wdna-dna-card__markers-label">DNA markers</span>}
      <div className="wdna-dna-card__markers-list">
        {stamps.map(({ stamp }) => (
          <span
            key={stamp.id}
            className="wdna-dna-card__marker"
            style={{ ["--marker-color" as string]: MARKER_COLORS[stamp.styleKey] }}
          >
            {stamp.shortLabel || stamp.label.split(" ")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}
