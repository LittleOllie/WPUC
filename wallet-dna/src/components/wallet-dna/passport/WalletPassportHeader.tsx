type Props = {
  compact?: boolean;
  centered?: boolean;
};

/** Export card header — DNA profile, not passport. */
export function WalletPassportHeader({ compact, centered }: Props) {
  return (
    <div className={`wdna-dna-card__brand${centered ? " wdna-dna-card__brand--center" : ""}${compact ? " wdna-dna-card__brand--compact" : ""}`}>
      <p className="wdna-dna-card__wordmark">
        <span className="wdna-dna-card__wordmark-line">Wallet <span className="wdna-dna-card__wordmark-accent">DNA</span></span>
      </p>
      {!compact && <p className="wdna-dna-card__tagline">Collector profile</p>}
    </div>
  );
}
