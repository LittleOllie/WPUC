// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { buildFixtureData } from "@/lib/wallet-dna/providers/fixture-data";
import { runAnalysisFromData } from "@/lib/wallet-dna/analysis/run-analysis";
import { buildWalletPassportData } from "@/lib/wallet-dna/passport/passport-data";
import { DEFAULT_PASSPORT_PREFERENCES } from "@/hooks/usePassportPreferences";
import { WalletPassport } from "@/components/wallet-dna/passport/WalletPassport";
import { WalletPassportControls } from "@/components/wallet-dna/passport/WalletPassportControls";

const wallet = "0x2222222222222222222222222222222222222222";

afterEach(() => cleanup());

function renderPassport(format: "landscape" | "square" | "portrait") {
  const data = buildFixtureData("base", wallet);
  const { result } = runAnalysisFromData(wallet, null, data.nfts, data.transfers, data.coverage);
  const passportData = buildWalletPassportData(result, format, "standard");
  const prefs = { ...DEFAULT_PASSPORT_PREFERENCES, format };
  return render(
    <WalletPassport data={passportData} prefs={prefs} siteUrl="https://littleollielabs.com" />,
  );
}

describe("WalletPassport preview", () => {
  it("renders landscape layout", () => {
    renderPassport("landscape");
    expect(screen.getByAltText("Little Ollie")).toBeTruthy();
    expect(document.querySelector(".wdna-dna-card__wordmark-accent")?.textContent).toBe("DNA");
    expect(screen.queryByText("Collector profile")).toBeNull();
  });

  it("renders square layout", () => {
    const { container } = renderPassport("square");
    expect(container.querySelector(".wdna-dna-card--square")).toBeTruthy();
  });

  it("renders portrait layout", () => {
    const { container } = renderPassport("portrait");
    expect(container.querySelector(".wdna-dna-card--portrait")).toBeTruthy();
  });

  it("shows DNA ID", () => {
    renderPassport("landscape");
    expect(screen.getByText(/DNA ID WD-/)).toBeTruthy();
  });

  it("shows powered by footer", () => {
    renderPassport("landscape");
    expect(screen.getByText("Powered By Little Ollie Labs")).toBeTruthy();
  });
});

describe("WalletPassportControls", () => {
  it("renders marker density options", () => {
    render(
      <WalletPassportControls
        prefs={DEFAULT_PASSPORT_PREFERENCES}
        onChange={() => {}}
        onCycleLayout={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Marker density/i)).toBeTruthy();
    expect(screen.getByText("Standard")).toBeTruthy();
  });
});
