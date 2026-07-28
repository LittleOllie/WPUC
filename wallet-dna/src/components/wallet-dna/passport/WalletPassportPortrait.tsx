import type { PlacedStamp } from "@/lib/wallet-dna/passport/passport-layout";
import type { WalletPassportData, WalletPassportPreferences } from "@/lib/wallet-dna/types";
import { accentForPersonality } from "@/lib/wallet-dna/theme";
import { WalletPassportBackground } from "@/components/wallet-dna/passport/WalletPassportBackground";
import { WalletPassportBadges } from "@/components/wallet-dna/passport/WalletPassportBadges";
import { WalletPassportHeader } from "@/components/wallet-dna/passport/WalletPassportHeader";
import { WalletPassportIdentity } from "@/components/wallet-dna/passport/WalletPassportIdentity";
import { WalletPassportOllie } from "@/components/wallet-dna/passport/WalletPassportOllie";
import { WalletPassportScores } from "@/components/wallet-dna/passport/WalletPassportScores";
import { WalletDNAMarkerStrip } from "@/components/wallet-dna/passport/WalletDNAMarkerStrip";

type Props = {
  data: WalletPassportData;
  prefs: WalletPassportPreferences;
  placedStamps: PlacedStamp[];
  siteUrl: string;
};

export function WalletPassportPortrait({ data, prefs, placedStamps, siteUrl }: Props) {
  const accent = accentForPersonality(data.personalityId);

  return (
    <div
      className="wdna-dna-card wdna-dna-card--portrait"
      style={{ ["--dna-accent" as string]: accent.accent, ["--dna-glow" as string]: accent.glow }}
    >
      <WalletPassportBackground siteUrl={siteUrl} />
      <WalletPassportHeader centered />
      <WalletPassportOllie
        key={data.personalityId}
        variant={data.ollieVariant}
        personalityId={data.personalityId}
        visible={prefs.showOllie}
        large
      />
      <h2 className="wdna-dna-card__personality">{data.personalityName}</h2>
      <WalletPassportIdentity data={data} prefs={prefs} />
      <WalletPassportScores scores={data.scores} visible={prefs.showScores} layout="row" />
      <WalletPassportBadges badges={data.displayedBadges} visible={prefs.showBadges} />
      <WalletDNAMarkerStrip stamps={placedStamps} visible={prefs.showStamps} />
    </div>
  );
}
