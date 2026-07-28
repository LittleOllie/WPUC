import type { PlacedStamp } from "@/lib/wallet-dna/passport/passport-layout";
import type { WalletPassportData, WalletPassportPreferences } from "@/lib/wallet-dna/types";
import { accentForPersonality } from "@/lib/wallet-dna/theme";
import { WalletPassportBackground } from "@/components/wallet-dna/passport/WalletPassportBackground";
import { WalletPassportBadges } from "@/components/wallet-dna/passport/WalletPassportBadges";
import { WalletPassportHeader } from "@/components/wallet-dna/passport/WalletPassportHeader";
import { WalletPassportIdentity } from "@/components/wallet-dna/passport/WalletPassportIdentity";
import { getPassportOllieClassName } from "@/lib/wallet-dna/ollie-images";
import { WalletPassportOllie } from "@/components/wallet-dna/passport/WalletPassportOllie";
import { WalletPassportScores } from "@/components/wallet-dna/passport/WalletPassportScores";
import { WalletDNAMarkerStrip } from "@/components/wallet-dna/passport/WalletDNAMarkerStrip";
import { WalletDNACornerStamp } from "@/components/wallet-dna/passport/WalletDNACornerStamp";

type Props = {
  data: WalletPassportData;
  prefs: WalletPassportPreferences;
  placedStamps: PlacedStamp[];
  siteUrl: string;
};

export function WalletPassportLandscape({ data, prefs, placedStamps, siteUrl }: Props) {
  const accent = accentForPersonality(data.personalityId);

  return (
    <div
      className="wdna-dna-card wdna-dna-card--landscape wdna-dna-card--flagship"
      style={{ ["--dna-accent" as string]: accent.accent, ["--dna-glow" as string]: accent.glow }}
    >
      <WalletPassportBackground siteUrl={siteUrl} />

      <header className="wdna-dna-card__topbar">
        <WalletPassportHeader compact />
      </header>

      <div className="wdna-dna-card__body wdna-dna-card__body--flagship">
        <div className="wdna-dna-card__ollie-stage">
          <WalletPassportOllie
            key={data.personalityId}
            variant={data.ollieVariant}
            personalityId={data.personalityId}
            visible={prefs.showOllie}
            large
            className={`wdna-passport-ollie--flagship${getPassportOllieClassName(data.ollieVariant)}`}
          />
        </div>

        <div className="wdna-dna-card__panel">
          <div className="wdna-dna-card__headline">
            <p className="wdna-dna-card__eyebrow">You&apos;re a</p>
            <h2 className="wdna-dna-card__personality">{data.personalityName}</h2>
            {data.traitCombo && (
              <p className="wdna-dna-card__combo" title="Top DNA score combination">
                {data.traitCombo}
              </p>
            )}
            <p className="wdna-dna-card__summary">{data.personalitySummary}</p>
          </div>

          <WalletPassportScores scores={data.scores} visible={prefs.showScores} layout="row" />

          <div className="wdna-dna-card__traits">
            <WalletPassportBadges badges={data.displayedBadges} visible={prefs.showBadges} />
            <WalletDNAMarkerStrip stamps={placedStamps} visible={prefs.showStamps} compact />
          </div>

          <WalletPassportIdentity data={data} prefs={prefs} layout="footer" />

          {prefs.showPassportNumber && (
            <p className="wdna-dna-card__id-line" title="Decorative profile ID — not proof of ownership">
              DNA ID {data.passportNumber}
            </p>
          )}
        </div>
      </div>

      <WalletDNACornerStamp visible={prefs.showStamps} />
    </div>
  );
}
