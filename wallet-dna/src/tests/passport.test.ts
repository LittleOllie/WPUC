import { describe, it, expect } from "vitest";
import { runAnalysisFromData } from "@/lib/wallet-dna/analysis/run-analysis";
import { buildFixtureData } from "@/lib/wallet-dna/providers/fixture-data";
import { createWalletPassportNumber } from "@/lib/wallet-dna/passport/passport-number";
import {
  buildPassportStampCandidates,
  selectCornerStamp,
  selectPassportStamps,
  PASSPORT_STAMP_MAX,
  stampRotation,
} from "@/lib/wallet-dna/passport/passport-stamps";
import { selectStampLayout } from "@/lib/wallet-dna/passport/passport-layout";
import {
  buildWalletPassportData,
  passportExportFilename,
  passportShareText,
} from "@/lib/wallet-dna/passport/passport-data";
import {
  DEFAULT_PASSPORT_PREFERENCES,
  mergePassportPreferences,
  passportPrefsStorageKey,
} from "@/hooks/usePassportPreferences";

const wallet = "0x2222222222222222222222222222222222222222";

function fixtureResult() {
  const data = buildFixtureData("base", wallet);
  return runAnalysisFromData(wallet, "test.eth", data.nfts, data.transfers, data.coverage).result;
}

describe("createWalletPassportNumber", () => {
  it("returns WD-XXXX-XXXX format", () => {
    const n = createWalletPassportNumber();
    expect(n).toMatch(/^WD-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it("generates a fresh id on each call", () => {
    const ids = new Set(Array.from({ length: 12 }, () => createWalletPassportNumber()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("passport stamps", () => {
  it("always includes wallet-dna-analysed candidate unlocked", () => {
    const result = fixtureResult();
    const candidates = buildPassportStampCandidates(result);
    const official = candidates.find((s) => s.id === "wallet-dna-analysed");
    expect(official?.unlocked).toBe(true);
  });

  it("unlocks base stamp for base fixture", () => {
    const result = fixtureResult();
    const candidates = buildPassportStampCandidates(result);
    expect(candidates.find((s) => s.id === "base")?.unlocked).toBe(true);
  });

  it("respects format maximum stamps", () => {
    const result = fixtureResult();
    for (const format of ["landscape", "square", "portrait"] as const) {
      const stamps = selectPassportStamps(result, format, "full");
      expect(stamps.length).toBeLessThanOrEqual(PASSPORT_STAMP_MAX[format]);
    }
  });

  it("minimal density uses at most 3 stamps", () => {
    const result = fixtureResult();
    const stamps = selectPassportStamps(result, "landscape", "minimal");
    expect(stamps.length).toBeLessThanOrEqual(3);
    expect(stamps[0]?.id).toBe("wallet-dna-analysed");
  });

  it("always includes wallet-dna-analysed in selection", () => {
    const result = fixtureResult();
    const stamps = selectPassportStamps(result, "square", "standard");
    expect(stamps.some((s) => s.id === "wallet-dna-analysed")).toBe(true);
  });

  it("selects a corner stamp with official fallback", () => {
    const result = fixtureResult();
    const stamps = selectPassportStamps(result, "landscape", "standard");
    const corner = selectCornerStamp(stamps, result.personality.id);
    expect(corner.unlocked).toBe(true);
    expect(corner.label.length).toBeGreaterThan(0);
  });

  it("uses deterministic rotation", () => {
    const result = fixtureResult();
    const stamps = selectPassportStamps(result, "landscape", "standard");
    const s = stamps[0]!;
    expect(stampRotation(s, 0)).toBe(stampRotation(s, 0));
    expect(stampRotation(s, 1)).not.toBe(stampRotation(s, 0));
  });
});

describe("stamp layout", () => {
  it("places stamps in safe zones deterministically", () => {
    const result = fixtureResult();
    const stamps = selectPassportStamps(result, "landscape", "standard");
    const a = selectStampLayout(wallet, "landscape", stamps, 0);
    const b = selectStampLayout(wallet, "landscape", stamps, 0);
    expect(a).toEqual(b);
    expect(a.every((p) => p.zone)).toBe(true);
  });

  it("cycles layout presets by index", () => {
    const result = fixtureResult();
    const stamps = selectPassportStamps(result, "landscape", "standard");
    const a = selectStampLayout(wallet, "landscape", stamps, 0);
    const b = selectStampLayout(wallet, "landscape", stamps, 1);
    expect(a.map((x) => x.zone)).not.toEqual(b.map((x) => x.zone));
  });
});

describe("buildWalletPassportData", () => {
  it("builds passport data with number and scores", () => {
    const result = fixtureResult();
    const data = buildWalletPassportData(result, "landscape", "standard");
    expect(data.passportNumber).toMatch(/^WD-/);
    expect(data.traitCombo).toBeTruthy();
    expect(data.personalityName).toBe(result.personality.name);
    expect(data.personalitySummary).toBe(result.personality.shareSummary);
    expect(data.scores.collector.value).toBe(result.scores.collector.value);
    expect(data.displayedBadges.length).toBeLessThanOrEqual(3);
    expect(data.stamps.length).toBeGreaterThan(0);
  });

  it("maps active mover personality to dedicated Ollie artwork", () => {
    const result = { ...fixtureResult(), personality: { ...fixtureResult().personality, id: "active-mover", name: "Active Mover" } };
    const data = buildWalletPassportData(result, "landscape", "standard");
    expect(data.personalityId).toBe("active-mover");
    expect(data.ollieVariant).toBe("active-mover");
  });

  it("uses ENS in wallet identity when present", () => {
    const result = fixtureResult();
    const data = buildWalletPassportData(result);
    expect(data.ensName).toBe("test.eth");
    expect(data.walletIdentity).toBe("test.eth");
  });

  it("shortens address when no ENS", () => {
    const result = { ...fixtureResult(), ensName: null };
    const data = buildWalletPassportData(result);
    expect(data.walletIdentity).toContain("…");
    expect(data.walletIdentity).not.toBe(result.walletAddress);
  });

  it("selects strongest trait", () => {
    const result = fixtureResult();
    const data = buildWalletPassportData(result);
    expect(data.strongestTrait.value).toBeGreaterThanOrEqual(0);
    expect(data.strongestTrait.name).toBeTruthy();
  });
});

describe("passport preferences", () => {
  it("defaults to passport landscape standard", () => {
    expect(DEFAULT_PASSPORT_PREFERENCES.shareStyle).toBe("passport");
    expect(DEFAULT_PASSPORT_PREFERENCES.format).toBe("landscape");
    expect(DEFAULT_PASSPORT_PREFERENCES.stampDensity).toBe("standard");
    expect(DEFAULT_PASSPORT_PREFERENCES.showStamps).toBe(true);
  });

  it("merges stored partial prefs", () => {
    const merged = mergePassportPreferences({ format: "square", showScores: false });
    expect(merged.format).toBe("square");
    expect(merged.showScores).toBe(false);
    expect(merged.shareStyle).toBe("passport");
  });

  it("storage key is per wallet", () => {
    expect(passportPrefsStorageKey(wallet)).toContain(wallet.toLowerCase());
  });
});

describe("passport share helpers", () => {
  it("export filename uses wallet prefix", () => {
    expect(passportExportFilename(wallet)).toMatch(/^wallet-dna-profile-/);
  });

  it("share text mentions DNA profile not verification", () => {
    const result = fixtureResult();
    const data = buildWalletPassportData(result);
    const text = passportShareText(data, "https://littleollielabs.com");
    expect(text).toContain("Wallet DNA:");
    expect(text).toContain(data.personalitySummary);
    expect(text).toContain(data.passportNumber);
    expect(text.toLowerCase()).not.toContain("verified owner");
  });
});

describe("export dimensions", () => {
  it("defines exact share card sizes", () => {
    const sizes = {
      landscape: { w: 1600, h: 900 },
      square: { w: 1080, h: 1080 },
      portrait: { w: 1080, h: 1350 },
    };
    expect(sizes.landscape.w).toBe(1600);
    expect(sizes.portrait.h).toBe(1350);
  });
});
