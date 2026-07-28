import type { WalletDNAScores } from "@/lib/wallet-dna/types";
import { SCORE_LABELS } from "@/lib/wallet-dna/constants";

type Props = {
  scores: WalletDNAScores;
  visible: boolean;
  compact?: boolean;
  layout?: "grid" | "row";
};

const KEYS = Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>;

export function WalletPassportScores({ scores, visible, compact, layout = "grid" }: Props) {
  if (!visible) return null;

  const layoutClass =
    layout === "row"
      ? " wdna-dna-card__scores--row"
      : compact
        ? " wdna-dna-card__scores--compact"
        : "";

  return (
    <div className={`wdna-dna-card__scores${layoutClass}`}>
      {KEYS.map((k) => (
        <div key={k} className="wdna-dna-card__score">
          <span className="wdna-dna-card__score-value">{scores[k].value}</span>
          <span className="wdna-dna-card__score-label">{SCORE_LABELS[k]}</span>
        </div>
      ))}
    </div>
  );
}
