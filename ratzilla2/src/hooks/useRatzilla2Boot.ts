import { useEffect } from "react";
import { useTunnelRats } from "./useTunnelRats";

const STORY = [
  "SIGNAL LOST...",
  "STATIC ON THE LINE.",
  "CAN YOU HEAR THAT?",
  "SOMETHING IN THE TUNNEL.",
  "FOOTSTEPS. THEN SILENCE.",
  "RED LIGHT FLICKERS.",
  "THEY ARE RUNNING NOW.",
  "THE INFECTION IS SPREADING.",
  "CLOSER. KEEP WATCHING.",
  "DO NOT LOOK DOWN.",
  "IT KNOWS YOU'RE LISTENING.",
  "THE CITY BELOW IS WAKING.",
  "RATZILLA IS NEAR.",
  "COMING SOON.",
];

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useRatzilla2Boot() {
  useTunnelRats();

  useEffect(() => {
    const stage = document.getElementById("rz2Stage");
    const soonEl = document.getElementById("rz2Soon");
    const cursorEl = document.getElementById("rz2Cursor");
    const soonWrap = soonEl?.closest(".rz2-soon");
    const flicker = document.getElementById("rz2Flicker");

    if (!stage || !soonEl) return;

    let phraseIdx = -1;
    let typingStop = false;

    function triggerFlicker() {
      if (!flicker) return;
      flicker.classList.remove("is-on");
      void flicker.offsetWidth;
      flicker.classList.add("is-on");
      window.setTimeout(() => flicker.classList.remove("is-on"), 380);
    }

    function nextStoryLine() {
      phraseIdx = (phraseIdx + 1) % STORY.length;
      return STORY[phraseIdx];
    }

    function textGlitch() {
      if (Math.random() > 0.28) return;
      soonWrap?.classList.add("is-glitch");
      window.setTimeout(() => soonWrap?.classList.remove("is-glitch"), 200);
    }

    async function erase(text: string) {
      for (let i = text.length; i >= 0; i--) {
        if (typingStop) return;
        soonEl.textContent = text.slice(0, i);
        await delay(rand(24, 52));
        if (Math.random() < 0.04) textGlitch();
      }
    }

    async function type(text: string) {
      cursorEl?.classList.remove("is-off");
      for (let i = 0; i <= text.length; i++) {
        if (typingStop) return;
        soonEl.textContent = text.slice(0, i);
        const ch = text[i - 1] || "";
        let wait = rand(48, 105);
        if (ch === "." || ch === "/") wait = rand(220, 480);
        else if (ch === " ") wait = rand(70, 130);
        if (Math.random() < 0.05) wait += rand(250, 600);
        if (Math.random() < 0.07) textGlitch();
        await delay(wait);
      }
      await delay(rand(1600, 3000));
    }

    async function typeLoop() {
      while (!typingStop) {
        const line = nextStoryLine();
        await type(line);
        if (typingStop) break;
        await delay(rand(350, 800));
        await erase(line);
        await delay(rand(600, 1200));
      }
    }

    function cinematicBoot() {
      window.setTimeout(() => triggerFlicker(), 400);
      window.setTimeout(() => triggerFlicker(), 900);

      window.setTimeout(() => {
        stage.classList.add("is-live");
      }, 200);

      window.setTimeout(() => {
        void typeLoop();
      }, 4800);
    }

    function scheduleAmbient() {
      const tick = () => {
        if (Math.random() < 0.14) triggerFlicker();
        else if (Math.random() < 0.2) textGlitch();
        window.setTimeout(tick, rand(12000, 28000));
      };
      window.setTimeout(tick, rand(16000, 22000));
    }

    let parallaxRaf = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      cancelAnimationFrame(parallaxRaf);
      parallaxRaf = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        stage.style.setProperty("--rz2-px", String(x));
        stage.style.setProperty("--rz2-py", String(y));
        stage.setAttribute("data-parallax", "1");
      });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    cinematicBoot();
    scheduleAmbient();

    return () => {
      typingStop = true;
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);
}
