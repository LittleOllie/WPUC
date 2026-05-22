/**
 * RATZILLA2 — cinematic tunnel transmission (isolated)
 */
(function () {
  "use strict";

  const TEXT = "COMING SOON";

  const stage = document.getElementById("rz2Stage");
  const curtain = document.getElementById("rz2Curtain");
  const soonEl = document.getElementById("rz2Soon");
  const cursorEl = document.getElementById("rz2Cursor");
  const soonWrap = soonEl?.closest(".rz2-soon");
  const flicker = document.getElementById("rz2Flicker");

  const ratRun = document.getElementById("rz2RatRun");
  const ratTrack = document.getElementById("rz2RatTrack");
  const ratVideo = document.getElementById("rz2RatVideo");
  const ratSource = document.getElementById("rz2RatSource");

  if (!stage || !soonEl) return;

  let typingStop = false;
  let ratRaf = 0;
  let ratCrossingTimer = 0;
  let ratFrameSize = { width: 1, height: 1 };
  const RAT_MAX_ACTIVE = 4;

  function applyWhiteKey(
    imageData,
    { threshold = 218, softness = 38, maxSaturation = 48 } = {},
  ) {
    const d = imageData.data;
    const soft = Math.max(1, softness);

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      const sat = max - min;

      if (min <= threshold - soft || sat > maxSaturation) continue;

      let alpha;
      if (min >= threshold) {
        alpha = 0;
      } else {
        alpha = Math.round(255 * ((min - (threshold - soft)) / soft));
      }

      d[i + 3] = Math.min(d[i + 3], alpha);
    }

    return imageData;
  }

  function darkenSilhouette(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a < 12) continue;
      d[i] = Math.round(d[i] * 0.32);
      d[i + 1] = Math.round(d[i + 1] * 0.3);
      d[i + 2] = Math.round(d[i + 2] * 0.3);
      d[i + 3] = Math.min(255, Math.round(a * 0.92));
    }
    return imageData;
  }

  function canvasSizeForVideo(video, maxWidth = 440) {
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    const scale = Math.min(1, maxWidth / vw);
    return {
      width: Math.max(1, Math.round(vw * scale)),
      height: Math.max(1, Math.round(vh * scale)),
    };
  }

  function initRatRun() {
    if (!ratVideo || !ratSource || !ratTrack) return;

    const srcCtx = ratSource.getContext("2d", { willReadFrequently: true });
    if (!srcCtx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let activeCount = 0;

    function drawSourceFrame() {
      if (ratVideo.readyState < 2) return;
      ratFrameSize = canvasSizeForVideo(ratVideo, 440);
      const { width, height } = ratFrameSize;
      if (ratSource.width !== width || ratSource.height !== height) {
        ratSource.width = width;
        ratSource.height = height;
      }
      srcCtx.clearRect(0, 0, width, height);
      srcCtx.drawImage(ratVideo, 0, 0, width, height);
      try {
        const frame = srcCtx.getImageData(0, 0, width, height);
        applyWhiteKey(frame, {
          threshold: 228,
          softness: 36,
          maxSaturation: 42,
        });
        darkenSilhouette(frame);
        srcCtx.putImageData(frame, 0, 0);
      } catch {
        /* skip frame if canvas busy */
      }
    }

    function syncMoverCanvases() {
      const movers = ratTrack.querySelectorAll(".rz2-rat-run__mover");
      movers.forEach((mover) => {
        const canvas = mover.querySelector("canvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx || ratSource.width < 1) return;
        if (canvas.width !== ratSource.width) {
          canvas.width = ratSource.width;
          canvas.height = ratSource.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(ratSource, 0, 0);
      });
    }

    function loop() {
      drawSourceFrame();
      syncMoverCanvases();
      ratRaf = requestAnimationFrame(loop);
    }

    function startLoop() {
      cancelAnimationFrame(ratRaf);
      ratRaf = requestAnimationFrame(loop);
    }

    function spawnCrossing() {
      if (activeCount >= RAT_MAX_ACTIVE) return;

      const ltr = Math.random() < 0.5;
      const duration = rand(3400, 4800);
      const offLeft = "-48%";
      const offRight = "148%";

      const mover = document.createElement("div");
      mover.className = `rz2-rat-run__mover ${ltr ? "is-ltr" : "is-rtl"}`;

      const canvas = document.createElement("canvas");
      canvas.className = "rz2-rat-run__canvas";
      canvas.width = ratFrameSize.width;
      canvas.height = ratFrameSize.height;
      mover.appendChild(canvas);
      ratTrack.appendChild(mover);
      activeCount += 1;

      mover.style.transition = "none";
      mover.style.left = ltr ? offLeft : offRight;
      mover.style.opacity = "0";
      void mover.offsetWidth;

      mover.style.transition = `left ${duration}ms linear, opacity 0.32s ease`;
      requestAnimationFrame(() => {
        mover.style.left = ltr ? offRight : offLeft;
        mover.style.opacity = "1";
      });

      const fadeTimer = window.setTimeout(() => {
        mover.style.opacity = "0";
      }, duration * 0.92);

      const doneTimer = window.setTimeout(() => {
        window.clearTimeout(fadeTimer);
        mover.remove();
        activeCount = Math.max(0, activeCount - 1);
      }, duration + 120);
    }

    function scheduleCrossing() {
      if (reducedMotion) return;
      window.clearTimeout(ratCrossingTimer);
      ratCrossingTimer = window.setTimeout(() => {
        let batch = 1;
        const roll = Math.random();
        if (roll < 0.42) batch = 2;
        else if (roll < 0.52) batch = 3;

        for (let i = 0; i < batch; i += 1) {
          window.setTimeout(() => spawnCrossing(), i * rand(180, 520));
        }
        scheduleCrossing();
      }, rand(350, 1200));
    }

    function startPlayback() {
      ratRun?.classList.add("is-ready");
      drawSourceFrame();
      if (reducedMotion) return;
      ratVideo.play().catch(() => {});
      startLoop();
      window.setTimeout(scheduleCrossing, rand(400, 900));
    }

    ratVideo.addEventListener("loadeddata", startPlayback, { once: true });
    ratVideo.addEventListener("error", () => {
      ratRun?.classList.remove("is-ready");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        ratVideo.pause();
        cancelAnimationFrame(ratRaf);
        ratRaf = 0;
        window.clearTimeout(ratCrossingTimer);
        ratTrack.innerHTML = "";
        activeCount = 0;
      } else if (!reducedMotion && ratVideo.readyState >= 2) {
        ratVideo.play().catch(() => {});
        startLoop();
        scheduleCrossing();
      }
    });

    ratVideo.src = "assets/ratrun2.MP4";
    ratVideo.load();
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function triggerFlicker() {
    if (!flicker) return;
    flicker.classList.remove("is-on");
    void flicker.offsetWidth;
    flicker.classList.add("is-on");
    setTimeout(() => flicker.classList.remove("is-on"), 380);
  }

  function textGlitch() {
    if (Math.random() > 0.35) return;
    soonWrap?.classList.add("is-glitch");
    setTimeout(() => soonWrap?.classList.remove("is-glitch"), 220);
  }

  async function typeComingSoon() {
    cursorEl?.classList.remove("is-off");
    for (let i = 0; i <= TEXT.length; i++) {
      if (typingStop) return;
      soonEl.textContent = TEXT.slice(0, i);
      let wait = rand(95, 180);
      const ch = TEXT[i - 1] || "";
      if (ch === " ") wait = rand(120, 220);
      if (Math.random() < 0.06) wait += rand(280, 520);
      if (Math.random() < 0.05) textGlitch();
      await delay(wait);
    }
  }

  function cinematicBoot() {
    setTimeout(() => triggerFlicker(), 400);
    setTimeout(() => triggerFlicker(), 900);

    setTimeout(() => {
      stage.classList.add("is-live");
    }, 200);

    setTimeout(() => typeComingSoon(), 4800);
  }

  function scheduleAmbient() {
    const tick = () => {
      if (Math.random() < 0.14) triggerFlicker();
      else if (Math.random() < 0.2) textGlitch();
      setTimeout(tick, rand(12000, 28000));
    };
    setTimeout(tick, rand(16000, 22000));
  }

  let parallaxRaf = 0;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      cancelAnimationFrame(parallaxRaf);
      parallaxRaf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        stage.style.setProperty("--rz2-px", String(x));
        stage.style.setProperty("--rz2-py", String(y));
        stage.setAttribute("data-parallax", "1");
      });
    },
    { passive: true },
  );

  cinematicBoot();
  scheduleAmbient();
  initRatRun();
})();
