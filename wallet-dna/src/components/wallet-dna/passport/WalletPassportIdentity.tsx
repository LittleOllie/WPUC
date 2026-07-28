import type { WalletPassportData, WalletPassportPreferences } from "@/lib/wallet-dna/types";
import { shortenAddress } from "@/lib/wallet-dna/utils/helpers";

type Props = {
  data: WalletPassportData;
  prefs: Pick<
    WalletPassportPreferences,
    "showENS" | "showShortAddress" | "showCollectorSince" | "showPassportNumber" | "showGeneratedDate"
  >;
  layout?: "inline" | "stack" | "footer";
};

export function WalletPassportIdentity({ data, prefs, layout = "stack" }: Props) {
  const identity =
    prefs.showENS && data.ensName
      ? data.ensName
      : prefs.showShortAddress
        ? shortenAddress(data.walletAddress)
        : null;

  const chainLabel = data.chains.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(" · ");
  const since =
    prefs.showCollectorSince && data.collectorSinceYear
      ? `Collector since ${data.collectorSinceYear}`
      : null;

  if (layout === "footer") {
    const parts = [identity, since, chainLabel].filter(Boolean);
    if (!parts.length) return null;
    return (
      <p className="wdna-dna-card__identity wdna-dna-card__identity--footer">
        {parts.join(" · ")}
      </p>
    );
  }

  return (
    <div className={`wdna-dna-card__identity wdna-dna-card__identity--${layout}`}>
      {identity && <p className="wdna-dna-card__wallet">{identity}</p>}
      <div className="wdna-dna-card__meta-row">
        {prefs.showCollectorSince && data.collectorSinceYear && (
          <span className="wdna-dna-card__meta-chip">Collector since {data.collectorSinceYear}</span>
        )}
        {data.chains.length > 0 && (
          <span className="wdna-dna-card__meta-chip wdna-dna-card__meta-chip--muted">
            {data.chains.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}
