/**
 * Dual liquid puff — smoky vapor from the two beakers the characters hold.
 * Origins track .hero-bg cover positioning on every frame and resize.
 */

import {
  getBeakerOrigin,
  getCurrentViewportSize,
  initBgCoverTracking,
} from "./bg-cover-point.js";

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

const RAINBOW = {
  id: "rainbow",
  beakerId: "left",
  getOrigin(w, h) {
    return getBeakerOrigin("left", w, h);
  },
  smokeTints: ["255, 210, 140", "160, 230, 150"],
  trailTint: "255, 230, 185",
  veilTint: "200, 235, 175",
  halo: ["255, 220, 155", "175, 240, 165"],
  blobStops: [
    [0, "255, 248, 215", 0.85],
    [0.22, "255, 205, 110", 0.75],
    [0.48, "130, 210, 105", 0.65],
    [0.74, "75, 175, 220", 0.45],
    [1, "150, 85, 210", 0.15],
  ],
  spreadDir: { x: 1, y: -1 },
  phase: 1.1,
};

const PURPLE = {
  id: "purple",
  beakerId: "right",
  getOrigin(w, h) {
    return getBeakerOrigin("right", w, h);
  },
  smokeTints: ["225, 200, 250", "190, 150, 235"],
  trailTint: "230, 200, 255",
  veilTint: "200, 160, 245",
  halo: ["210, 170, 245", "185, 140, 230"],
  blobStops: [
    [0, "245, 225, 255", 0.85],
    [0.25, "215, 165, 252", 0.75],
    [0.55, "165, 85, 235", 0.65],
    [0.82, "120, 50, 195", 0.45],
    [1, "90, 35, 160", 0.15],
  ],
  spreadDir: { x: -1, y: -1 },
  phase: 2.4,
};

const SOURCES = [RAINBOW, PURPLE];

function drawSmokeWisp(ctx, x, y, radius, alpha, tint) {
  if (radius <= 0 || alpha <= 0) return;

  const grad = ctx.createRadialGradient(x, y - radius * 0.2, 0, x, y, radius);
  grad.addColorStop(0, `rgba(${tint}, ${alpha * 0.55})`);
  grad.addColorStop(0.35, `rgba(${tint}, ${alpha * 0.28})`);
  grad.addColorStop(0.7, `rgba(${tint}, ${alpha * 0.1})`);
  grad.addColorStop(1, `rgba(${tint}, 0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y, radius * 1.15, radius * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLiquidBlob(ctx, cx, cy, radius, wobble, time, alpha, palette, smoky) {
  if (radius <= 0) return;

  if (smoky) {
    drawSmokeWisp(ctx, cx, cy - radius * 0.08, radius * 1.35, alpha * 0.35, palette.halo[0]);
    drawSmokeWisp(
      ctx,
      cx + radius * 0.12 * palette.spreadDir.x,
      cy - radius * 0.15,
      radius * 1.1,
      alpha * 0.22,
      palette.halo[1]
    );
  }

  const points = 40;
  ctx.beginPath();

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const edge =
      1 +
      Math.sin(angle * 4 + time * 9 + palette.phase) * 0.08 * wobble +
      Math.cos(angle * 6 - time * 7 + palette.phase) * 0.06 * wobble +
      Math.sin(angle * 9 + time * 5 + palette.phase) * 0.04 * wobble;
    const r = radius * edge;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();

  const grad = ctx.createRadialGradient(
    cx - radius * 0.18 * palette.spreadDir.x,
    cy - radius * 0.28,
    radius * 0.04,
    cx,
    cy,
    radius * 1.12
  );

  for (const [stop, rgb, mult] of palette.blobStops) {
    grad.addColorStop(stop, `rgba(${rgb}, ${alpha * mult})`);
  }

  ctx.fillStyle = grad;
  ctx.fill();
}

function createSmokeField(count, originX, originY, spread, palette) {
  return Array.from({ length: count }, (_, i) => {
    const slot = i / count;
    return {
      relX: (Math.random() - 0.5) * spread,
      relY: (Math.random() - 0.5) * spread * 0.4,
      x: originX + (Math.random() - 0.5) * spread,
      y: originY + (Math.random() - 0.5) * spread * 0.4,
      vx: (Math.random() - 0.35) * 1.4 * palette.spreadDir.x,
      vy: -0.6 - Math.random() * 1.8,
      size: 10 + Math.random() * 28,
      grow: 0.45 + Math.random() * 0.7,
      alpha: 0.12 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
      drift: 0.6 + Math.random() * 1.8,
      tint: palette.smokeTints[slot < 0.5 ? 0 : 1],
      born: Math.random() * 0.12,
    };
  });
}

function syncSmokeOrigins(particles, originX, originY) {
  for (const p of particles) {
    p.x = originX + p.relX;
    p.y = originY + p.relY;
  }
}

function updateAndDrawSmoke(ctx, particles, originX, originY, t, intensity, vmin) {
  const active = t > 0.02 && intensity > 0;

  for (const p of particles) {
    if (!active || t < p.born) continue;

    const life = Math.min(1, (t - p.born) / 0.88);
    const fade = life < 0.15 ? life / 0.15 : 1 - easeOutCubic(Math.max(0, (life - 0.35) / 0.65));

    p.x = originX + p.relX + p.vx * intensity * life * 18 + Math.sin(t * 8 + p.phase) * p.drift * life;
    p.y = originY + p.relY + p.vy * intensity * life * 22;
    p.vx *= 0.992;
    p.vy *= 0.996;

    const size = p.size + life * vmin * p.grow * intensity;
    const alpha = p.alpha * fade * intensity * 0.9;

    drawSmokeWisp(ctx, p.x, p.y, size, alpha, p.tint);

    if (life > 0.2) {
      drawSmokeWisp(
        ctx,
        p.x + Math.sin(t * 6 + p.phase) * size * 0.25,
        p.y - size * 0.35,
        size * 0.65,
        alpha * 0.55,
        p.tint
      );
    }
  }
}

function drawSourceFrame(ctx, palette, t, puff, spread, w, h, vmin, coverRadius, smokeParticles) {
  const { x: originX, y: originY } = palette.getOrigin(w, h);
  const smokeIntensity = 0.35 + puff * 0.45 + spread * 0.55;
  const puffRadius = vmin * (0.02 + puff * 0.14);
  const mainRadius = puffRadius * (0.35 + spread * 2.8) + spread * coverRadius;

  syncSmokeOrigins(smokeParticles, originX, originY);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  updateAndDrawSmoke(ctx, smokeParticles, originX, originY, t, smokeIntensity, vmin);
  ctx.restore();

  if (t < 0.32) {
    const rise = easeOutCubic(Math.min(1, t / 0.14));
    const trailY = originY - rise * vmin * 0.06;

    for (let i = 0; i < 4; i++) {
      const slot = i / 3;
      drawSmokeWisp(
        ctx,
        originX + Math.sin(t * 10 + i + palette.phase) * vmin * 0.012,
        trailY - slot * vmin * 0.035,
        vmin * (0.025 + slot * 0.02),
        0.35 - slot * 0.08,
        palette.trailTint
      );
    }

    drawLiquidBlob(
      ctx,
      originX,
      trailY,
      vmin * 0.018 + rise * vmin * 0.02,
      1.5,
      t * 14,
      0.85,
      palette,
      true
    );
  }

  const driftX = spread * w * 0.1 * palette.spreadDir.x;
  const driftY = originY - puff * vmin * 0.02 - spread * vmin * 0.04;

  drawLiquidBlob(ctx, originX + driftX * 0.15, driftY, mainRadius, 1.1 - spread * 0.35, t * 10, 0.92, palette, true);

  if (spread > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    drawSmokeWisp(
      ctx,
      originX + driftX,
      originY - spread * h * 0.12,
      mainRadius * 1.15,
      0.28 + spread * 0.2,
      palette.veilTint
    );
    ctx.restore();

    drawLiquidBlob(
      ctx,
      originX + driftX,
      originY - spread * h * 0.1,
      mainRadius * 0.9,
      0.8,
      t * 8 + 1.2,
      0.42,
      palette,
      true
    );
  }
}

function ensureSmokeFields(w, h, vmin, smokeState) {
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const layoutKey = `${mobile ? "m" : "d"}:${w}x${h}`;
  if (smokeState.key === layoutKey) return smokeState.fields;

  const perSource = mobile ? 18 : 26;
  smokeState.key = layoutKey;
  smokeState.fields = SOURCES.map((palette) => {
    const { x, y } = palette.getOrigin(w, h);
    return createSmokeField(perSource, x, y, vmin * 0.08, palette);
  });
  return smokeState.fields;
}

/**
 * @param {() => void} onComplete
 */
export async function playPurpleLiquidTransition(onComplete) {
  await initBgCoverTracking();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const curtain = document.getElementById("home-liquid-curtain");
    if (curtain) {
      curtain.classList.add("home-liquid-curtain--active");
      curtain.style.background = "linear-gradient(135deg, #9333ea 0%, #2563eb 100%)";
      curtain.style.opacity = "1";
    }
    setTimeout(() => {
      try {
        sessionStorage.setItem("lo-playground-enter", "1");
      } catch {
        /* ignore */
      }
      onComplete();
    }, 500);
    return;
  }

  const curtain = document.getElementById("home-liquid-curtain");
  if (!curtain) {
    onComplete();
    return;
  }

  let canvas = curtain.querySelector("canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    curtain.appendChild(canvas);
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    onComplete();
    return;
  }

  curtain.classList.add("home-liquid-curtain--active");

  const SMOKE_MS = 2200;
  const HOLD_MS = 850;
  const COVER_GRADIENT = "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)";
  const start = performance.now();
  let raf = 0;
  const smokeState = { key: "", fields: null };

  function invalidateLayout() {
    smokeState.key = "";
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { w, h } = getCurrentViewportSize();
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    invalidateLayout();
  }

  function onViewportChange() {
    resize();
  }

  resize();
  window.addEventListener("resize", onViewportChange, { passive: true });
  window.addEventListener("orientationchange", onViewportChange, { passive: true });
  window.visualViewport?.addEventListener("resize", onViewportChange, { passive: true });
  window.visualViewport?.addEventListener("scroll", onViewportChange, { passive: true });

  const mobileMq = window.matchMedia("(max-width: 768px)");
  if (mobileMq.addEventListener) {
    mobileMq.addEventListener("change", onViewportChange);
  } else {
    mobileMq.addListener(onViewportChange);
  }

  function cleanupListeners() {
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("orientationchange", onViewportChange);
    window.visualViewport?.removeEventListener("resize", onViewportChange);
    window.visualViewport?.removeEventListener("scroll", onViewportChange);
    if (mobileMq.removeEventListener) {
      mobileMq.removeEventListener("change", onViewportChange);
    } else {
      mobileMq.removeListener(onViewportChange);
    }
  }

  function finishTransition() {
    const { w, h } = getCurrentViewportSize();
    cancelAnimationFrame(raf);
    cleanupListeners();
    ctx.clearRect(0, 0, w, h);
    canvas.style.display = "none";
    curtain.style.background = COVER_GRADIENT;
    setTimeout(() => {
      try {
        sessionStorage.setItem("lo-playground-enter", "1");
      } catch {
        /* ignore */
      }
      onComplete();
    }, HOLD_MS);
  }

  function frame(now) {
    const t = Math.min(1, (now - start) / SMOKE_MS);
    const { w, h } = getCurrentViewportSize();
    const vmin = Math.min(w, h);
    const coverRadius = Math.hypot(w, h) * 0.62;
    const smokeBySource = ensureSmokeFields(w, h, vmin, smokeState);

    let puff = 0;
    let spread = 0;

    if (t < 0.32) {
      puff = easeOutBack(t / 0.32);
    } else {
      puff = 1;
      spread = easeInOutCubic((t - 0.32) / 0.68);
    }

    ctx.clearRect(0, 0, w, h);

    SOURCES.forEach((palette, i) => {
      drawSourceFrame(ctx, palette, t, puff, spread, w, h, vmin, coverRadius, smokeBySource[i]);
    });

    if (spread > 0.55) {
      const merge = easeInOutCubic((spread - 0.55) / 0.45);
      drawSmokeWisp(ctx, w * 0.5, h * 0.5, vmin * (0.5 + merge * 1.8), 0.15 + merge * 0.25, "185, 175, 245");
    }

    if (t < 1) {
      raf = requestAnimationFrame(frame);
    } else {
      finishTransition();
    }
  }

  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    cleanupListeners();
  };
}
