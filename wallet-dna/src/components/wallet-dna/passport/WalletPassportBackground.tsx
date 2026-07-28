type Props = {
  siteUrl: string;
};

export function WalletPassportBackground({ siteUrl }: Props) {
  const host = siteUrl.replace(/^https?:\/\//, "");
  return (
    <>
      <div className="wdna-dna-card__bg-gradient" aria-hidden="true" />
      <div className="wdna-dna-card__bg-helix" aria-hidden="true" />
      <div className="wdna-dna-card__bg-glow" aria-hidden="true" />
      <footer className="wdna-dna-card__footer">
        <span className="wdna-dna-card__footer-brand">Powered By Little Ollie Labs</span>
        <span className="wdna-dna-card__footer-url">{host}</span>
      </footer>
    </>
  );
}
