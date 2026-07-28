import Link from "next/link";
import { SCORING_VERSION } from "@/lib/wallet-dna/constants";
import { SCORE_DESCRIPTIONS, SCORE_LABELS } from "@/lib/wallet-dna/constants";

export default function MethodologyPage() {
  return (
    <main className="wdna-wrap">
      <p>
        <Link href="/" style={{ color: "#ffdd55", fontWeight: 700 }}>
          ← Back to Wallet DNA
        </Link>
      </p>
      <h1 style={{ fontFamily: "Fredoka, sans-serif", fontSize: "2rem" }}>Methodology</h1>
      <div className="wdna-card" style={{ marginTop: 16 }}>
        <p>
          Wallet DNA analyses <strong>public</strong> NFT records on Ethereum and Base via Alchemy.
          No wallet connection or signatures are required.
        </p>
        <p>
          Scoring model version <strong>{SCORING_VERSION}</strong>. Outbound NFT transfers are{" "}
          <em>not</em> automatically labelled as sales.
        </p>
        <h2>Scores</h2>
        <ul>
          {(Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>).map((k) => (
            <li key={k}>
              <strong>{SCORE_LABELS[k]}</strong> — {SCORE_DESCRIPTIONS[k]}
            </li>
          ))}
        </ul>
        <p>
          Obvious spam and malformed NFT records are excluded where identifiable. Historical analysis
          may be capped for extremely active wallets.
        </p>
        <p>For entertainment and informational purposes only. Not financial advice.</p>
      </div>
    </main>
  );
}
