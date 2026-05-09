import { createTimeline } from "./src/timeline.js";
import { createRunnerGame } from "./src/game.js";

const canvas = document.getElementById("gameCanvas");
const startOverlay = document.getElementById("startOverlay");
const settingsOverlay = document.getElementById("settingsOverlay");
const finishOverlay = document.getElementById("finishOverlay");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const accessibilityBtn = document.getElementById("accessibilityBtn");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");

const countdownEl = document.getElementById("countdown");
const promptEl = document.getElementById("prompt");
const promptTextEl = document.getElementById("promptText");
const promptSubEl = document.getElementById("promptSub");
const distancePill = document.getElementById("distancePill");
const muteBtn = document.getElementById("muteBtn");

const speedRange = document.getElementById("speedRange");
const speedLabel = document.getElementById("speedLabel");
const bigPrompts = document.getElementById("bigPrompts");
const reducedMotion = document.getElementById("reducedMotion");

const appRoot = document.getElementById("appRoot");

let game = null;

function setHidden(el, hidden) {
  el.classList.toggle("hidden", !!hidden);
  el.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function showPrompt({ text, sub, color }) {
  promptTextEl.textContent = text;
  promptSubEl.textContent = sub || "";
  promptTextEl.style.color = color || "#ffffff";
  promptEl.classList.remove("hidden");
  promptEl.classList.remove("pop");
  void promptEl.offsetWidth;
  promptEl.classList.add("pop");
}

function hidePrompt() {
  promptEl.classList.add("hidden");
}

function setCountdown(nOrText, visible) {
  if (visible) {
    countdownEl.textContent = String(nOrText);
    countdownEl.classList.remove("hidden");
  } else {
    countdownEl.classList.add("hidden");
  }
}

function setDistance(meters) {
  const m = Math.max(0, meters | 0);
  distancePill.textContent = `${m} m`;
}

function applySettingsToDom() {
  const speed = Number(speedRange.value);
  speedLabel.textContent = `${speed.toFixed(2)}×`;
  appRoot.classList.toggle("big-prompts", !!bigPrompts.checked);
  document.documentElement.style.setProperty("--reduced-motion", reducedMotion.checked ? "1" : "0");
}

function openSettings() {
  setHidden(settingsOverlay, false);
  setHidden(startOverlay, true);
}

function closeSettings() {
  setHidden(settingsOverlay, true);
  setHidden(startOverlay, false);
}

function stopGameIfAny() {
  if (!game) return;
  game.stop();
  game = null;
}

async function startRun() {
  stopGameIfAny();

  setHidden(finishOverlay, true);
  setHidden(startOverlay, true);
  setHidden(settingsOverlay, true);
  hidePrompt();

  const speed = Number(speedRange.value);
  const isReducedMotion = !!reducedMotion.checked || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const timeline = createTimeline({ speed });

  game = createRunnerGame({
    canvas,
    timeline,
    speed,
    reducedMotion: isReducedMotion,
    onPrompt: showPrompt,
    onPromptHide: hidePrompt,
    onDistance: setDistance,
    onCountdown: setCountdown,
    onFinish: ({ message }) => {
      stopGameIfAny();
      document.getElementById("finishLine").textContent = message || "Perfect run. High five!";
      setHidden(finishOverlay, false);
      setHidden(startOverlay, true);
      setHidden(settingsOverlay, true);
    },
  });

  await game.start();
}

function setMutedUI(muted) {
  muteBtn.textContent = muted ? "Sound: Off" : "Sound: On";
}

function wireUi() {
  applySettingsToDom();

  startBtn.addEventListener("click", () => startRun());
  restartBtn.addEventListener("click", () => {
    setHidden(finishOverlay, true);
    setHidden(startOverlay, false);
  });

  accessibilityBtn.addEventListener("click", openSettings);
  settingsCloseBtn.addEventListener("click", closeSettings);

  speedRange.addEventListener("input", () => {
    applySettingsToDom();
  });
  bigPrompts.addEventListener("change", applySettingsToDom);
  reducedMotion.addEventListener("change", applySettingsToDom);

  muteBtn.addEventListener("click", () => {
    if (!game) {
      const next = muteBtn.textContent.includes("On");
      setMutedUI(next);
      return;
    }
    const muted = game.toggleMute();
    setMutedUI(muted);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!settingsOverlay.classList.contains("hidden")) closeSettings();
    }
  });

  window.addEventListener("blur", () => {
    if (game) game.pause();
  });
  window.addEventListener("focus", () => {
    if (game) game.resume();
  });
}

wireUi();

