import { useMemo } from "react";
import type { WalletPassportData, WalletPassportPreferences } from "@/lib/wallet-dna/types";
import { selectStampLayout } from "@/lib/wallet-dna/passport/passport-layout";
import { WalletPassportLandscape } from "@/components/wallet-dna/passport/WalletPassportLandscape";
import { WalletPassportPortrait } from "@/components/wallet-dna/passport/WalletPassportPortrait";
import { WalletPassportSquare } from "@/components/wallet-dna/passport/WalletPassportSquare";

type Props = {
  data: WalletPassportData;
  prefs: WalletPassportPreferences;
  siteUrl: string;
};

export function WalletPassport({ data, prefs, siteUrl }: Props) {
  const placedStamps = useMemo(
    () =>
      selectStampLayout(data.walletAddress, prefs.format, data.stamps, prefs.stampLayoutIndex),
    [data.walletAddress, data.stamps, prefs.format, prefs.stampLayoutIndex],
  );

  if (prefs.format === "square") {
    return (
      <WalletPassportSquare
        data={data}
        prefs={prefs}
        placedStamps={placedStamps}
        siteUrl={siteUrl}
      />
    );
  }
  if (prefs.format === "portrait") {
    return (
      <WalletPassportPortrait
        data={data}
        prefs={prefs}
        placedStamps={placedStamps}
        siteUrl={siteUrl}
      />
    );
  }
  return (
    <WalletPassportLandscape
      data={data}
      prefs={prefs}
      placedStamps={placedStamps}
      siteUrl={siteUrl}
    />
  );
}
