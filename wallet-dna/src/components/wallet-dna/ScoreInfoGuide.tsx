import Link from "next/link";
import { SCORE_DESCRIPTIONS, SCORE_LABELS } from "@/lib/wallet-dna/constants";

const KEYS = Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>;

type Props = {
  /** Show expanded by default */
  defaultOpen?: boolean;
  /** Include link to full methodology page */
  showMethodologyLink?: boolean;
};

export function ScoreInfoGuide({ defaultOpen = false, showMethodologyLink = true }: Props) {
  return (
    <details className="wdna-score-info" open={defaultOpen}>
      <summary className="wdna-score-info__summary">
        <span className="wdna-score-info__icon" aria-hidden="true">
          i
        </span>
        What do these scores mean?
      </summary>
      <div className="wdna-score-info__body">
        <p className="wdna-score-info__lead">
          Each score runs from <strong>0 to 100</strong>. Higher means that trait shows up more
          strongly in your wallet&apos;s public NFT history on Ethereum and Base.
        </p>
        <ul className="wdna-score-info__list">
          {KEYS.map((k) => (
            <li key={k}>
              <strong>{SCORE_LABELS[k]}</strong>
              <span className="wdna-score-info__desc">{SCORE_DESCRIPTIONS[k]}</span>
            </li>
          ))}
        </ul>
        <p className="wdna-score-info__note">
          Tap <strong>How calculated</strong> on any score card below for the numbers behind your
          result. Scores marked with limited confidence may reflect incomplete transfer history.
        </p>
        {showMethodologyLink ? (
          <p className="wdna-score-info__link">
            <Link href="/methodology/#scores">Full scoring methodology →</Link>
          </p>
        ) : null}
      </div>
    </details>
  );
}
