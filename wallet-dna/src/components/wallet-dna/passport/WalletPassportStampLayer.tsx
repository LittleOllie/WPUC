import type { PlacedStamp } from "@/lib/wallet-dna/passport/passport-layout";
import { STAMP_ZONE_CLASS } from "@/lib/wallet-dna/passport/passport-layout";
import { WalletPassportStamp } from "@/components/wallet-dna/passport/WalletPassportStamp";

type Props = {
  stamps: PlacedStamp[];
  visible: boolean;
};

export function WalletPassportStampLayer({ stamps, visible }: Props) {
  if (!visible || !stamps.length) return null;

  return (
    <div className="wdna-passport-stamps" aria-hidden="true">
      {stamps.map(({ stamp, zone, rotation, size, opacity }) => (
        <div key={stamp.id} className={`wdna-passport-stamps__item ${STAMP_ZONE_CLASS[zone]}`}>
          <WalletPassportStamp stamp={stamp} size={size} rotation={rotation} opacity={opacity} />
        </div>
      ))}
    </div>
  );
}
