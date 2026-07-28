"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { WalletDNAResult } from "@/lib/wallet-dna/types";
import {
  buildWalletPassportData,
  passportExportFilename,
  passportShareText,
} from "@/lib/wallet-dna/passport/passport-data";
import { prepareShareCardForExport } from "@/lib/wallet-dna/share-export";
import { FLAGSHIP_PROFILE_PREFS } from "@/hooks/usePassportPreferences";
import { WalletPassport } from "@/components/wallet-dna/passport/WalletPassport";

const EXPORT_SIZE = { w: 1600, h: 900 };

type ExportState = "idle" | "preparing" | "ready" | "partial";

type Props = {
  result: WalletDNAResult;
  hideHeader?: boolean;
  passportNumber: string;
  dnaIdSeed: string;
  onPassportRefresh?: () => void;
};

export function WalletShareStudio({
  result,
  hideHeader = false,
  passportNumber,
  dnaIdSeed,
  onPassportRefresh,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [previewScale, setPreviewScale] = useState(0.55);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://littleollielabs.com";
  const passportData = useMemo(
    () => buildWalletPassportData(result, "landscape", "standard", dnaIdSeed, passportNumber),
    [result, dnaIdSeed, passportNumber],
  );
  const prefs = FLAGSHIP_PROFILE_PREFS;

  const updatePreviewScale = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { w, h } = EXPORT_SIZE;
    const available = viewport.clientWidth - 24;
    const scaleW = available / w;
    const scaleH = (window.innerHeight * 0.5) / h;
    setPreviewScale(Math.min(0.85, Math.max(0.32, Math.min(scaleW, scaleH))));
  }, []);

  useEffect(() => {
    updatePreviewScale();
    window.addEventListener("resize", updatePreviewScale);
    return () => window.removeEventListener("resize", updatePreviewScale);
  }, [updatePreviewScale]);

  async function exportPng() {
    if (!cardRef.current) return;
    setExportState("preparing");

    const liveCard = cardRef.current;
    const { w, h } = EXPORT_SIZE;
    const clone = liveCard.cloneNode(true) as HTMLDivElement;
    clone.style.transform = "none";
    clone.style.width = `${w}px`;
    clone.style.height = `${h}px`;
    clone.style.position = "relative";
    clone.style.overflow = "visible";
    clone.classList.add("wdna-share-card--export");

    const sandbox = document.createElement("div");
    sandbox.setAttribute("aria-hidden", "true");
    sandbox.className = "wdna-share-export-sandbox";
    sandbox.style.cssText = `position:fixed;top:0;left:0;width:${w}px;height:${h}px;z-index:-1;pointer-events:none;overflow:visible;`;
    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const imagesOk = await prepareShareCardForExport(clone, liveCard);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      const dataUrl = await toPng(clone, {
        width: w,
        height: h,
        pixelRatio: 2,
        cacheBust: false,
        skipFonts: true,
        skipAutoScale: true,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = passportExportFilename(result.walletAddress);
      a.click();
      onPassportRefresh?.();
      setExportState(imagesOk ? "ready" : "partial");
    } catch (e) {
      console.error("Wallet DNA share export failed", e);
      setExportState("partial");
    } finally {
      document.body.removeChild(sandbox);
    }
  }

  function shareX() {
    const text = passportShareText(passportData, siteUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const { w, h } = EXPORT_SIZE;
  const scaledH = Math.ceil(h * previewScale);

  return (
    <section className={`wdna-section wdna-share-studio wdna-share-studio--flagship${hideHeader ? " wdna-share-studio--embedded" : ""}`}>
      {!hideHeader && (
        <>
          <h3 className="wdna-section__title">
            Wallet <span className="wdna-collapse__title-accent">DNA</span> Profile Card
          </h3>
          <p className="wdna-section__lead">
            Your shareable collector identity — one recognisable card, every time. Not proof of ownership.
          </p>
        </>
      )}

      <div className="wdna-share-studio__preview-block">
        <h4 className="wdna-share-studio__label">Live preview</h4>
        <p className="wdna-sr-preview" id="share-preview-desc">
          Wallet DNA profile for {passportData.personalityName}. {passportData.personalitySummary}
        </p>

        <div
          ref={viewportRef}
          className="wdna-share-preview-viewport wdna-share-preview-viewport--flagship"
          style={{ height: scaledH + 24 }}
        >
          <div
            className="wdna-share-preview-scaler"
            style={{ width: w, height: h, transform: `scale(${previewScale})` }}
          >
            <div
              ref={cardRef}
              className="wdna-share-card wdna-share-card--landscape wdna-share-card--dna"
              style={{ width: w, height: h }}
              role="img"
              aria-labelledby="share-preview-desc"
            >
              <WalletPassport data={passportData} prefs={prefs} siteUrl={siteUrl} />
            </div>
          </div>
        </div>
      </div>

      {exportState === "preparing" && <p className="wdna-export-status">Preparing image…</p>}
      {exportState === "ready" && (
        <p className="wdna-export-status wdna-export-status--ok">Download ready</p>
      )}
      {exportState === "partial" && (
        <p className="wdna-export-status wdna-export-status--warn">Export failed — try again</p>
      )}

      <div className="wdna-share-actions wdna-share-actions--flagship">
        <button
          type="button"
          className="wdna-btn"
          disabled={exportState === "preparing"}
          onClick={exportPng}
        >
          Download PNG
        </button>
        <button type="button" className="wdna-btn wdna-btn--x" onClick={shareX}>
          Share to X
        </button>
      </div>
    </section>
  );
}
