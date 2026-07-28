import type { ShareCardFormat, WalletPassportStamp } from "@/lib/wallet-dna/types";
import { stampRotation } from "@/lib/wallet-dna/passport/passport-stamps";
import { stableHash } from "@/lib/wallet-dna/utils/helpers";

export type StampZone =
  | "upper-right"
  | "lower-right"
  | "lower-left"
  | "diagonal-edge"
  | "score-corner"
  | "identity-bg";

export type PlacedStamp = {
  stamp: WalletPassportStamp;
  zone: StampZone;
  rotation: number;
  size: "small" | "medium" | "large";
  opacity: number;
};

const ZONE_ORDER: Record<ShareCardFormat, StampZone[][]> = {
  landscape: [
    ["upper-right", "diagonal-edge", "lower-right"],
    ["lower-left", "score-corner", "identity-bg"],
    ["upper-right", "lower-right", "lower-left", "diagonal-edge", "score-corner", "identity-bg"],
  ],
  square: [
    ["upper-right", "lower-left", "lower-right"],
    ["diagonal-edge", "score-corner", "identity-bg"],
    ["upper-right", "lower-left", "lower-right", "diagonal-edge", "score-corner"],
  ],
  portrait: [
    ["upper-right", "lower-right", "lower-left"],
    ["diagonal-edge", "score-corner", "identity-bg", "upper-right"],
    ["lower-right", "lower-left", "diagonal-edge", "score-corner", "identity-bg", "upper-right", "lower-right"],
  ],
};

const SIZE_CYCLE: Array<"small" | "medium" | "large"> = ["medium", "small", "large", "medium", "small"];

export function selectStampLayout(
  walletAddress: string,
  format: ShareCardFormat,
  stamps: WalletPassportStamp[],
  layoutIndex: number,
): PlacedStamp[] {
  const presets = ZONE_ORDER[format];
  const preset = presets[layoutIndex % presets.length] ?? presets[0]!;
  const seed = stableHash(`${walletAddress}:${format}:layout:${layoutIndex}`);

  return stamps.map((stamp, i) => {
    const zone = preset[i % preset.length]!;
    const size = SIZE_CYCLE[(seed + i) % SIZE_CYCLE.length]!;
    const opacity = 0.82 + ((seed + i * 7) % 15) / 100;
    return {
      stamp,
      zone,
      rotation: stampRotation(stamp, layoutIndex),
      size,
      opacity: Math.min(0.95, opacity),
    };
  });
}

/** CSS class suffix for zone positioning */
export const STAMP_ZONE_CLASS: Record<StampZone, string> = {
  "upper-right": "zone-upper-right",
  "lower-right": "zone-lower-right",
  "lower-left": "zone-lower-left",
  "diagonal-edge": "zone-diagonal-edge",
  "score-corner": "zone-score-corner",
  "identity-bg": "zone-identity-bg",
};
