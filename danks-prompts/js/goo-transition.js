/**
 * Canvas gloop enter transition — textured drips like GloopBG
 */

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * @param {{ getTextureUrl: () => string, onMidpoint: () => void, onComplete: () => void }} opts
 */
export function playGooEnterTransition({ getTextureUrl, onMidpoint, onComplete }) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    onMidpoint();
    onComplete();
    return;
  }

  const curtain = document.getElementById("danks-goo-curtain");
  if (!curtain) {
    onMidpoint();
    onComplete();
    return;
  }

  let canvas = document.getElementById("danks-goo-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "danks-goo-canvas";
    canvas.className = "danks-goo-canvas";
    canvas.setAttribute("aria-hidden", "true");
    curtain.appendChild(canvas);
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    onMidpoint();
    onComplete();
    return;
  }

  const tex = new Image();
  tex.decoding = "async";
  tex.src = getTextureUrl();

  const DRIP_COUNT = window.innerWidth < 480 ? 16 : 24;
  const drips = Array.from({ length: DRIP_COUNT }, (_, i) => {
    const slot = (i + 0.5) / DRIP_COUNT;
    const centerBoost = 1 - Math.abs(slot - 0.5) * 0.55;
    return {
      x: clamp(slot + Math.sin(i * 2.1) * 0.035, 0.03, 0.97),
      w: (0.038 + (i % 5) * 0.011 + Math.sin(i) * 0.007) * (0.85 + centerBoost * 0.45),
      speed: 0.88 + (i % 4) * 0.11,
      delay: (i % 7) * 0.024 + (i % 3) * 0.012,
      phase: Math.random() * Math.PI * 2,
      wobble: 5 + (i % 4) * 3.5,
      bulge: 0.82 + (i % 3) * 0.14,
      len: 0,
    };
  });

  const droplets = Array.from({ length: 10 }, (_, i) => ({
    x: 0.08 + (i / 9) * 0.84 + Math.sin(i * 1.9) * 0.03,
    r: 4 + (i % 3) * 3,
    delay: 0.35 + i * 0.07,
    fall: 0,
    speed: 0.55 + (i % 4) * 0.12,
  }));

  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let midCalled = false;
  let finished = false;

  const PACE = 1.3;

  const FILL_AT = 1.15 * PACE;
  const END_AT = FILL_AT + 0.22;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function paintTexture() {
    if (tex.complete && tex.naturalWidth) {
      const sx = w / tex.naturalWidth;
      const sy = h / tex.naturalHeight;
      const scale = Math.max(sx, sy);
      const iw = tex.naturalWidth * scale;
      const ih = tex.naturalHeight * scale;
      const ox = (w - iw) / 2;
      const oy = (h - ih) / 2;
      ctx.drawImage(tex, ox, oy, iw, ih);
      return;
    }

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#6ec8ff");
    g.addColorStop(0.35, "#4a9eff");
    g.addColorStop(0.7, "#1e6fd4");
    g.addColorStop(1, "#0a2d6e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function addGloss(x0, y0, x1, y1, alpha = 1) {
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, `rgba(255,255,255,${0.28 * alpha})`);
    lg.addColorStop(0.45, `rgba(255,255,255,${0.06 * alpha})`);
    lg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lg;
    ctx.fill();
  }

  function traceDrip(drip, time, maxLen) {
    const cx = drip.x * w;
    const half = (drip.w * w) / 2;
    const tipY = maxLen;
    const steps = Math.max(14, Math.floor(tipY / 8));

    ctx.beginPath();
    ctx.moveTo(cx - half, 0);

    for (let i = 0; i <= steps; i++) {
      const y = (tipY * i) / steps;
      const taper = 1 - (y / (h * 1.25)) * 0.38;
      const wob =
        Math.sin(y * 0.017 + drip.phase + time * 4.8) * drip.wobble * taper +
        Math.sin(y * 0.042 + drip.phase * 1.7 + time * 2) * drip.wobble * 0.4 * taper;
      const bulge = half * drip.bulge * (1 + Math.sin(y * 0.011 + drip.phase) * 0.14);
      ctx.lineTo(cx + bulge + wob, y);
    }

    const dripTip = tipY + half * 0.62;
    ctx.bezierCurveTo(cx + half * 1.15, tipY + half * 0.38, cx + half * 0.5, dripTip, cx, dripTip);
    ctx.bezierCurveTo(cx - half * 0.5, dripTip, cx - half * 1.15, tipY + half * 0.38, cx - half, tipY);

    for (let i = steps; i >= 0; i--) {
      const y = (tipY * i) / steps;
      const taper = 1 - (y / (h * 1.25)) * 0.38;
      const wob =
        Math.sin(y * 0.019 + drip.phase + time * 4.1) * drip.wobble * 0.78 * taper +
        Math.sin(y * 0.048 + drip.phase) * drip.wobble * 0.28 * taper;
      const bulge = half * drip.bulge * (1 + Math.sin(y * 0.013 + drip.phase + 1) * 0.11);
      ctx.lineTo(cx - bulge + wob, y);
    }

    ctx.closePath();
  }

  function strokeDripRim(drip, time, maxLen) {
    traceDrip(drip, time, maxLen);
    ctx.strokeStyle = "rgba(6, 28, 72, 0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    traceDrip(drip, time, maxLen);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function traceCeiling(ceilH, time) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= w; x += 10) {
      const wave =
        Math.sin(x * 0.022 + time * 3.2) * 10 +
        Math.sin(x * 0.007 + time * 1.8) * 16 +
        Math.sin(x * 0.04 + time * 5) * 4;
      ctx.lineTo(x, ceilH + wave);
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
  }

  function traceFlood(lip, time) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= w; x += 8) {
      const wave =
        Math.sin(x * 0.014 + time * 3.8) * 12 +
        Math.sin(x * 0.0055 + time * 2.1) * 22 +
        Math.sin(x * 0.03 + time * 6) * 5;
      ctx.lineTo(x, lip + wave);
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
  }

  function drawDroplet(d, time) {
    const cx = d.x * w;
    const cy = d.fall * h;
    const r = d.r * (1 + Math.sin(time * 8 + d.x * 20) * 0.08);

    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.92, r * 1.15, 0, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    paintTexture();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.35, r * 0.45, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fill();
  }

  function drawFrame(elapsed) {
    try {
      const time = elapsed / 1000;
      const fillT = clamp((time - 0.36) / 0.8, 0, 1);
      const ceilingH = easeOutCubic(fillT) * h * 0.26;
      const floodT = clamp((time - 0.64) / 0.68, 0, 1);
      const floodH = easeInOutCubic(floodT) * h;

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = "#0c4cb8";
      ctx.fillRect(0, 0, w, h);

      for (const drip of drips) {
        const local = Math.max(0, time - drip.delay);
        drip.len = easeOutCubic(clamp(local * drip.speed * 0.56, 0, 1)) * h * 1.15;
      }

      for (const drip of drips) {
        if (drip.len < 3) continue;
        traceDrip(drip, time, drip.len);
        ctx.save();
        ctx.clip();
        paintTexture();
        ctx.restore();
        ctx.save();
        traceDrip(drip, time, drip.len);
        ctx.clip();
        addGloss(0, 0, w * 0.4, h, 0.9);
        ctx.restore();
        strokeDripRim(drip, time, drip.len);
      }

      if (ceilingH > 2) {
        traceCeiling(ceilingH, time);
        ctx.save();
        ctx.clip();
        paintTexture();
        ctx.restore();
        traceCeiling(ceilingH, time);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (floodH > 0) {
        traceFlood(floodH, time);
        ctx.save();
        ctx.clip();
        paintTexture();
        ctx.restore();
        ctx.save();
        traceFlood(floodH, time);
        ctx.clip();
        addGloss(0, floodH - 50, w, floodH + 40, 0.85);
        ctx.restore();
      }

      for (const d of droplets) {
        const local = Math.max(0, time - d.delay);
        d.fall = easeOutCubic(clamp(local * d.speed, 0, 1)) * 0.35;
        if (time < FILL_AT && d.fall > 0.02 && d.fall < 0.34) {
          drawDroplet(d, time);
        }
      }

      if (!midCalled && time >= FILL_AT) {
        midCalled = true;
        onMidpoint();
      }
    } catch (err) {
      console.error("Gloop transition error:", err);
      if (!midCalled) {
        midCalled = true;
        onMidpoint();
      }
      finish();
      onComplete();
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    curtain.classList.remove("danks-goo-curtain--active");
    curtain.setAttribute("aria-hidden", "true");
    ctx.clearRect(0, 0, w, h);
  }

  function onResize() {
    resize();
  }

  function startAnim() {
    resize();
    curtain.classList.add("danks-goo-curtain--active");
    curtain.setAttribute("aria-hidden", "false");
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      drawFrame(elapsed);
      if (finished) return;
      if (elapsed / 1000 < END_AT) {
        raf = requestAnimationFrame(tick);
      } else {
        finish();
        onComplete();
      }
    }

    raf = requestAnimationFrame(tick);
  }

  window.addEventListener("resize", onResize);

  const begin = () => {
    if (tex.naturalWidth) startAnim();
    else {
      onMidpoint();
      onComplete();
    }
  };

  if (tex.complete) begin();
  else {
    tex.onload = begin;
    tex.onerror = () => {
      onMidpoint();
      onComplete();
    };
  }
}
