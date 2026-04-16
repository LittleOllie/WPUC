/**
 * Shared GIF branding utilities for Quirkies + OGT (+ FlexGrid).
 * Browser-only: attaches to `window.LO_GIF_BRANDING`.
 *
 * When editing, copy this file to: quirkies/public/, OGT/public/, quirkies/, OGT/
 * (same-folder loads avoid broken ../../shared on some hosts).
 */
(function (global) {
  "use strict";

  var WATERMARK_TEXT = "LO Labs";

  /** Bump when watermark look changes so in-memory caches refresh. */
  var WM_RENDER_REV = 4;

  var wmCache = {
    w: null,
    rev: null,
    font: null,
    fontSize: 0,
    pad: 0,
  };

  var finalCache = {
    w: null,
    h: null,
    rev: null,
    idata: null,
  };

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function resolveUiFontFamily() {
    try {
      if (typeof document !== "undefined" && document.body) {
        var fam = window.getComputedStyle(document.body).fontFamily || "";
        if (fam) return fam;
      }
    } catch (e) {
      /* ignore */
    }
    return "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  }

  function getWatermarkStyle(canvasWidth) {
    var w = Math.max(1, Math.round(Number(canvasWidth) || 0));
    if (wmCache.w === w && wmCache.rev === WM_RENDER_REV && wmCache.font) {
      return wmCache;
    }
    // Slightly smaller type + lower alpha reads clearly “lighter” on dark frames.
    var fontSize = Math.max(11, Math.round(w * 0.04));
    var pad = Math.max(4, Math.round(w * 0.026));
    var font =
      "800 " +
      fontSize +
      "px " +
      resolveUiFontFamily();
    wmCache = {
      w: w,
      rev: WM_RENDER_REV,
      font: font,
      fontSize: fontSize,
      pad: pad,
    };
    return wmCache;
  }

  /**
   * Bottom-right subtle watermark. Draw AFTER artwork on the same 2D context.
   */
  function drawWatermark(ctx, canvasWidth, canvasHeight) {
    if (!ctx) return;
    var w = Math.max(1, Math.round(Number(canvasWidth) || 0));
    var h = Math.max(1, Math.round(Number(canvasHeight) || 0));
    var s = getWatermarkStyle(w);

    var x = w - s.pad;
    var yBottom = h - s.pad;

    ctx.save();
    ctx.font = s.font;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#FFFFFF";
    /* Clearly lighter than earlier builds (~0.2–0.3); still legible on #0B0F1A. */
    ctx.globalAlpha = 0.09;
    var blur = Math.max(1, Math.round(s.fontSize * 0.07));
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.round(blur * 0.2));
    ctx.fillText(WATERMARK_TEXT, x, Math.max(s.fontSize + 2, yBottom));
    ctx.restore();
  }

  function createFinalFrameImageData(canvasWidth, canvasHeight) {
    var w = Math.max(1, Math.round(Number(canvasWidth) || 0));
    var h = Math.max(1, Math.round(Number(canvasHeight) || 0));
    if (
      finalCache.w === w &&
      finalCache.h === h &&
      finalCache.rev === WM_RENDER_REV &&
      finalCache.idata
    ) {
      return finalCache.idata;
    }

    var canvas =
      typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!canvas) {
      throw new Error("Canvas not supported.");
    }
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported.");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);

    var fontFam = resolveUiFontFamily();

    var sizeLo = Math.round(h * 0.08);
    var sizeBuild = Math.round(h * 0.04);
    var sizeUrl = Math.round(h * 0.05);
    var sizeHandle = Math.round(h * 0.03);

    var sLo = clamp(sizeLo, 22, 200);
    var sBuild = clamp(sizeBuild, 14, 120);
    var sUrl = clamp(sizeUrl, 16, 140);
    var sHandle = clamp(sizeHandle, 12, 90);

    var lines = [
      { text: "LO Labs", weight: 700, size: sLo, alpha: 1 },
      { text: "Build yours ↓", weight: 500, size: sBuild, alpha: 1 },
      { text: "littleollielabs.com/flexgrid", weight: 600, size: sUrl, alpha: 1 },
      { text: "@littleollienft", weight: 400, size: sHandle, alpha: 0.6 },
    ];

    var baseGap = Math.round(h * 0.018);
    var extraGapAfterLo = Math.round(h * 0.02);

    var blockHeights = [];
    var i;
    for (i = 0; i < lines.length; i++) {
      var gap = i === 0 ? extraGapAfterLo : baseGap;
      blockHeights.push({ lineH: Math.round(lines[i].size * 1.25), gap: gap });
    }

    var total = 0;
    for (i = 0; i < lines.length; i++) {
      total += blockHeights[i].lineH;
      if (i !== lines.length - 1) total += blockHeights[i].gap;
    }

    var padY = Math.round(h * 0.1);
    var startY = clamp(Math.round((h - total) / 2), padY, h - padY - total);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#000000";

    var y = startY;
    var x = Math.round(w / 2);
    for (i = 0; i < lines.length; i++) {
      var l = lines[i];
      ctx.font = l.weight + " " + l.size + "px " + fontFam;
      ctx.globalAlpha = l.alpha;
      ctx.fillText(l.text, x, y);
      y += blockHeights[i].lineH;
      if (i !== lines.length - 1) y += blockHeights[i].gap;
    }
    ctx.globalAlpha = 1;

    // Spec: watermark on every frame — include the final CTA card too.
    drawWatermark(ctx, w, h);

    var idata = ctx.getImageData(0, 0, w, h);
    finalCache = { w: w, h: h, rev: WM_RENDER_REV, idata: idata };
    return idata;
  }

  function finalFrameDelayMs(nftDelayMs) {
    var d = Math.round(Number(nftDelayMs) || 0);
    if (!isFinite(d) || d < 1) d = 1;
    return Math.round(d * 1.5) + 500;
  }

  global.LO_GIF_BRANDING = {
    WATERMARK_TEXT: WATERMARK_TEXT,
    drawWatermark: drawWatermark,
    createFinalFrameImageData: createFinalFrameImageData,
    finalFrameDelayMs: finalFrameDelayMs,
  };
})(typeof window !== "undefined" ? window : globalThis);
