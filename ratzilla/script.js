/**
 * RATZILLA — cinematic coming-soon (self-contained)
 */
(function () {
  "use strict";

  const PHRASES = [
    "SIGNAL DETECTED...",
    "THE CITY BELOW IS WAKING.",
    "BLACKWATER IS OPENING.",
    "ACCESS COMING SOON.",
    "THE INFECTION SPREADS SOON.",
    "ENTER BLACKWATER // SOON.",
  ];

  const COORDS = [
    "47.21°N // 122.88°W",
    "GRID:7F-A9 // DEPTH:-42m",
    "NODE:BLACKWATER-0x7C",
    "SECTOR 7G // LOCKED",
    "ENCRYPT://RATZILLA.SIG",
  ];

  const stage = document.getElementById("rzStage");
  const curtain = document.getElementById("rzCurtain");
  const typeEl = document.getElementById("rzType");
  const cursorEl = document.getElementById("rzCursor");
  const terminal = typeEl?.closest(".rz-terminal");
  const signal = document.getElementById("rzSignal");
  const logo = document.getElementById("rzLogo");
  const flash = document.getElementById("rzFlash");
  const coords = document.getElementById("rzCoords");
  const warning = document.getElementById("rzWarning");
  const jitter = document.getElementById("rzJitter");
  const eyes = document.getElementById("rzEyes");
  const muteBtn = document.getElementById("rzMute");
  const audio = document.getElementById("rzAudio");

  if (!stage || !typeEl) return;

  let phraseIdx = -1;
  let typingStop = false;
  let audioCtx;
  let humNode;

  console.log(
    "%c▓ RATZILLA // UNAUTHORIZED SIGNAL INTERCEPT ▓",
    "color:#b82028;font-family:monospace;font-size:11px;",
  );
  console.log(
    "%cThe city below is already awake.",
    "color:#6a6460;font-family:monospace;font-size:10px;",
  );

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function pickPhrase() {
    if (PHRASES.length < 2) return PHRASES[0];
    let i = Math.floor(Math.random() * PHRASES.length);
    while (i === phraseIdx) i = Math.floor(Math.random() * PHRASES.length);
    phraseIdx = i;
    return PHRASES[i];
  }

  function glitchBurst() {
    if (Math.random() > 0.28) return;
    terminal?.classList.add("is-glitch");
    jitter?.classList.add("is-on");
    if (Math.random() < 0.15) logo?.classList.add("is-glitch");
    setTimeout(() => {
      terminal?.classList.remove("is-glitch");
      jitter?.classList.remove("is-on");
      logo?.classList.remove("is-glitch");
    }, 200);
  }

  async function erase(text) {
    for (let i = text.length; i >= 0; i--) {
      if (typingStop) return;
      typeEl.textContent = text.slice(0, i);
      await delay(rand(24, 52));
      if (Math.random() < 0.04) glitchBurst();
    }
  }

  async function type(text) {
    cursorEl?.classList.remove("is-off");
    for (let i = 0; i <= text.length; i++) {
      if (typingStop) return;
      typeEl.textContent = text.slice(0, i);
      const ch = text[i - 1] || "";
      let wait = rand(48, 105);
      if (ch === "." || ch === "/") wait = rand(220, 480);
      else if (ch === " ") wait = rand(70, 130);
      if (Math.random() < 0.05) wait += rand(250, 600);
      if (Math.random() < 0.07) glitchBurst();
      await delay(wait);
    }
    await delay(rand(1600, 3000));
  }

  async function typeLoop() {
    while (!typingStop) {
      const line = pickPhrase();
      await type(line);
      if (typingStop) break;
      await delay(rand(350, 800));
      await erase(line);
      await delay(rand(600, 1200));
    }
  }

  function cinematicBoot() {
    setTimeout(() => {
      flash?.classList.add("is-on");
      setTimeout(() => flash?.classList.remove("is-on"), 380);
    }, 1200);

    setTimeout(() => {
      stage.classList.add("is-live");
    }, 280);

    setTimeout(() => typeLoop(), 5200);
  }

  function triggerFlash() {
    flash?.classList.remove("is-on");
    void flash?.offsetWidth;
    flash?.classList.add("is-on");
    setTimeout(() => flash?.classList.remove("is-on"), 420);
  }

  function showCoords() {
    if (!coords) return;
    coords.textContent = COORDS[Math.floor(Math.random() * COORDS.length)];
    coords.classList.remove("is-on");
    void coords.offsetWidth;
    coords.classList.add("is-on");
    setTimeout(() => coords.classList.remove("is-on"), 2400);
  }

  function showWarning() {
    if (!warning) return;
    warning.classList.remove("is-on");
    void warning.offsetWidth;
    warning.classList.add("is-on");
    setTimeout(() => warning.classList.remove("is-on"), 3200);
  }

  function showEyes() {
    if (!eyes) return;
    eyes.classList.remove("is-on");
    void eyes.offsetWidth;
    eyes.classList.add("is-on");
    setTimeout(() => eyes.classList.remove("is-on"), 1200);
  }

  function scheduleAmbient() {
    const tick = () => {
      const r = Math.random();
      if (r < 0.1) triggerFlash();
      else if (r < 0.17) showCoords();
      else if (r < 0.2) showWarning();
      else if (r < 0.23) showEyes();
      else if (r < 0.28) glitchBurst();
      setTimeout(tick, rand(9000, 24000));
    };
    setTimeout(tick, rand(14000, 20000));
  }

  function startHum() {
    const src = audio?.querySelector("source");
    if (src?.getAttribute("src")) {
      audio.volume = 0.32;
      return audio.play().catch(() => {});
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
      humNode = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const lp = audioCtx.createBiquadFilter();
      humNode.type = "sawtooth";
      humNode.frequency.value = 38;
      lp.type = "lowpass";
      lp.frequency.value = 110;
      gain.gain.value = 0.014;
      humNode.connect(lp);
      lp.connect(gain);
      gain.connect(audioCtx.destination);
      humNode.start();
    } catch {
      /* no audio */
    }
  }

  function stopHum() {
    audio?.pause();
    try {
      humNode?.stop();
    } catch {
      /* noop */
    }
    humNode = null;
    audioCtx?.close?.().catch(() => {});
    audioCtx = null;
  }

  muteBtn?.addEventListener("click", () => {
    const muted = muteBtn.classList.toggle("is-muted");
    if (muted) stopHum();
    else startHum();
  });

  signal?.addEventListener("click", () => {
    signal.classList.add("is-hit");
    triggerFlash();
    setTimeout(() => signal.classList.remove("is-hit"), 500);
  });

  let parallaxRaf = 0;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      cancelAnimationFrame(parallaxRaf);
      parallaxRaf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        stage.style.setProperty("--rz-px", String(x));
        stage.style.setProperty("--rz-py", String(y));
        stage.setAttribute("data-parallax", "1");
      });
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopHum();
  });

  function lockLogoVisible() {
    logo?.classList.add("is-revealed");
  }

  logo?.addEventListener("animationend", (e) => {
    if (e.animationName === "rz-logo-reveal") lockLogoVisible();
  });

  /* Fallback if reveal animation is skipped (reduced motion, etc.) */
  setTimeout(lockLogoVisible, 6800);

  cinematicBoot();
  scheduleAmbient();
})();
