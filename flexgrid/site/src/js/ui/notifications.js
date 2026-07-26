/**
 * User-facing toast notifications (deduplicated).
 */

import { escapeHtml } from "../core/escapeHtml.js";

const recent = new Map();
const DEDUPE_MS = 8000;

let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement("div");
  container.id = "flexgridToastHost";
  container.className = "flexgrid-toast-host";
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-relevant", "additions");
  document.body.appendChild(container);
  return container;
}

/**
 * @param {string} message Plain-language message (escaped when rendered).
 * @param {"info"|"warn"|"error"} [level]
 * @param {{ dedupeKey?: string, durationMs?: number }} [opts]
 */
export function showToast(message, level = "info", opts = {}) {
  const text = String(message || "").trim();
  if (!text) return;

  const dedupeKey = opts.dedupeKey || `${level}:${text}`;
  const now = Date.now();
  const last = recent.get(dedupeKey);
  if (last && now - last < DEDUPE_MS) return;
  recent.set(dedupeKey, now);

  const host = ensureContainer();
  const el = document.createElement("div");
  el.className = `flexgrid-toast flexgrid-toast--${level}`;
  el.setAttribute("role", level === "error" ? "alert" : "status");
  el.innerHTML = `<span class="flexgrid-toast__text">${escapeHtml(text)}</span>`;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "flexgrid-toast__close";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  close.addEventListener("click", () => el.remove());
  el.appendChild(close);

  host.appendChild(el);

  const duration = opts.durationMs ?? (level === "error" ? 12000 : 7000);
  window.setTimeout(() => {
    el.classList.add("flexgrid-toast--hide");
    window.setTimeout(() => el.remove(), 320);
  }, duration);
}

/** Map technical errors to user-friendly copy where possible. */
export function userMessageForError(error, context = "") {
  const msg = String(error?.message || error || "").trim();
  const ctx = String(context || "").toLowerCase();

  if (/rate.?limit|too many requests|429/i.test(msg)) {
    return "You have reached the current request limit. Please wait a moment and try again.";
  }
  if (error?.name === "AbortError" || /timed out|timeout/i.test(msg)) {
    if (ctx.includes("apechain") || /apechain/i.test(msg)) {
      return "ApeChain is responding slowly. Please try again shortly.";
    }
    return "The request took too long. Please try again.";
  }
  if (/invalid wallet|wallet address/i.test(msg)) {
    return "We couldn't load NFTs from this wallet. Check the wallet address and try again.";
  }
  if (/configuration not available|config/i.test(msg) && ctx.includes("config")) {
    return "FlexGrid could not connect to its server configuration. Try again in a moment.";
  }
  if (/gif|media recorder|mp4|webm/i.test(msg) || ctx.includes("export")) {
    if (/media recorder|mp4|webm/i.test(msg)) {
      return "Video export failed in this browser. Try PNG or GIF export instead.";
    }
    return "GIF export failed in this browser. Try PNG export instead.";
  }
  if (/some nft images|missing|retry missing/i.test(msg)) {
    return "Some NFT images could not be loaded. You can retry missing tiles.";
  }
  if (msg) return msg;
  return "Something went wrong. Please try again.";
}

export function clearToastDedupe() {
  recent.clear();
}
