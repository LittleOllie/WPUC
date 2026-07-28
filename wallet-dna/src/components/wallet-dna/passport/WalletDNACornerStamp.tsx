import { getDnaAnalysedStampSrc } from "@/lib/wallet-dna/passport/ollie-assets";

type Props = {
  visible: boolean;
};

export function WalletDNACornerStamp({ visible }: Props) {
  if (!visible) return null;

  return (
    <div className="wdna-dna-card__corner-stamp" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="wdna-dna-card__corner-stamp-img"
        src={getDnaAnalysedStampSrc()}
        alt=""
        draggable={false}
      />
    </div>
  );
}
