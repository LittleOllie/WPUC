/**
 * Danks Prompts — main app logic
 */

import {
  DANKS_WALLET,
  PAGE_ASSETS,
  FEATURED_PROMPT,
  VAULT_PROMPTS,
  COMMUNITY_CREATIONS,
  getAllPrompts,
} from "./prompts.js";

const $ = (sel, root = document) => root.querySelector(sel);

/** Copy text with clipboard API + textarea fallback (mobile-safe). */
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

function flashButton(btn, successLabel, defaultLabel, ms = 2000) {
  if (!btn) return;
  btn.textContent = successLabel;
  btn.disabled = true;
  btn.classList.add("danks-btn--success");
  window.setTimeout(() => {
    btn.textContent = defaultLabel;
    btn.disabled = false;
    btn.classList.remove("danks-btn--success");
  }, ms);
}

function bindCopyButtons() {
  document.addEventListener("click", async (e) => {
    const walletBtn = e.target.closest("[data-copy-wallet]");
    if (walletBtn) {
      const ok = await copyText(DANKS_WALLET);
      flashButton(walletBtn, ok ? "Copied!" : "Copy failed", walletBtn.dataset.copyWalletLabel || "Copy Wallet");
      return;
    }

    const promptBtn = e.target.closest("[data-copy-prompt-id]");
    if (!promptBtn) return;
    const prompt = promptById.get(promptBtn.getAttribute("data-copy-prompt-id"));
    if (!prompt) return;
    const ok = await copyText(prompt.promptText);
    flashButton(promptBtn, ok ? "Copied!" : "Copy failed", "Copy Prompt");
  });
}

function bindScrollLinks() {
  document.querySelectorAll("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = el.getAttribute("data-scroll-to");
      const target = id ? document.getElementById(id) : null;
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

/** Before/after drag slider — pointer events for touch + mouse */
function initBeforeAfterSlider(root) {
  const clip = $(".danks-ba__clip", root);
  const beforeImg = $(".danks-ba__before", root);
  const handle = $(".danks-ba__handle", root);
  if (!clip || !beforeImg || !handle) return;

  let pct = 50;
  let dragging = false;

  function syncBeforeWidth() {
    const w = root.clientWidth;
    beforeImg.style.width = `${w}px`;
  }

  function setPct(value) {
    pct = Math.max(4, Math.min(96, value));
    clip.style.width = `${pct}%`;
    handle.style.left = `${pct}%`;
    handle.setAttribute("aria-valuenow", String(Math.round(pct)));
  }

  function pctFromEvent(clientX) {
    const rect = root.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function onPointerDown(e) {
    dragging = true;
    root.setPointerCapture(e.pointerId);
    setPct(pctFromEvent(e.clientX));
    handle.focus();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    setPct(pctFromEvent(e.clientX));
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try {
      root.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerUp);

  handle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPct(pct - 4);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPct(pct + 4);
    }
  });

  const ro = new ResizeObserver(() => {
    syncBeforeWidth();
    setPct(pct);
  });
  ro.observe(root);
  syncBeforeWidth();
  setPct(pct);
}

function initAllSliders() {
  document.querySelectorAll(".danks-ba").forEach(initBeforeAfterSlider);
}

function createBeforeAfterHtml(prompt, labelPrefix = "") {
  const beforeAlt = `${labelPrefix}${prompt.title} — before example`;
  const afterAlt = `${labelPrefix}${prompt.title} — after example`;
  return `
    <div class="danks-ba" role="group" aria-label="${prompt.title} before and after comparison">
      <img class="danks-ba__after" src="${prompt.afterImage}" alt="${afterAlt}" loading="lazy" decoding="async" />
      <div class="danks-ba__clip">
        <img class="danks-ba__before" src="${prompt.beforeImage}" alt="${beforeAlt}" loading="lazy" decoding="async" />
      </div>
      <div class="danks-ba__handle" role="slider" aria-label="Drag to compare before and after" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0">
        <span class="danks-ba__knob" aria-hidden="true"></span>
      </div>
      <span class="danks-ba__tag danks-ba__tag--before">Before</span>
      <span class="danks-ba__tag danks-ba__tag--after">After</span>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createPromptCardHtml(prompt, { featured = false } = {}) {
  const cardClass = featured ? "danks-prompt-card danks-prompt-card--featured" : "danks-prompt-card";
  const tag = featured ? `<span class="danks-tag danks-tag--featured">Featured</span>` : `<span class="danks-tag">${escapeHtml(prompt.category)}</span>`;
  return `
    <article class="${cardClass}" id="prompt-${prompt.id}" data-prompt-id="${prompt.id}">
      <div class="danks-prompt-card__head">
        ${tag}
        <h3 class="danks-prompt-card__title">${escapeHtml(prompt.title)}</h3>
        <p class="danks-prompt-card__desc">${escapeHtml(prompt.description)}</p>
      </div>
      <div class="danks-ba-frame">
        ${createBeforeAfterHtml(prompt)}
      </div>
      <div class="danks-prompt-card__actions">
        <button type="button" class="danks-btn danks-btn--blob" data-copy-prompt-id="${prompt.id}">Copy Prompt</button>
        <button type="button" class="danks-btn danks-btn--ghost" data-expand-prompt="${prompt.id}">View Prompt</button>
      </div>
    </article>
  `;
}

function renderPrompts() {
  const featuredMount = $("#danks-featured-mount");
  const vaultMount = $("#danks-vault-grid");
  if (featuredMount) {
    featuredMount.innerHTML = createPromptCardHtml(FEATURED_PROMPT, { featured: true });
  }
  if (vaultMount) {
    vaultMount.innerHTML = VAULT_PROMPTS.map((p) => createPromptCardHtml(p)).join("");
  }
}

function renderCommunity() {
  const mount = $("#danks-community-grid");
  if (!mount) return;
  mount.innerHTML = COMMUNITY_CREATIONS.map(
    (item) => `
    <figure class="danks-community-card">
      <div class="danks-community-card__img-wrap">
        <!-- REPLACE LATER: community example image -->
        <img src="${item.image}" alt="Community creation using ${escapeHtml(item.promptUsed)}" loading="lazy" decoding="async" />
      </div>
      <figcaption>
        <span class="danks-community-card__creator">${escapeHtml(item.creator)}</span>
        <span class="danks-community-card__prompt">${escapeHtml(item.promptUsed)}</span>
      </figcaption>
    </figure>
  `
  ).join("");
}

function applyPageAssets() {
  const page = document.body;
  const bg = $(".danks-page__bg");
  if (bg && PAGE_ASSETS.backgroundImage) {
    bg.style.backgroundImage = `url("${PAGE_ASSETS.backgroundImage}")`;
    bg.classList.add("danks-page__bg--image");
    page?.classList.add("danks-page--has-art");
  }

  const headerSlot = $("#danks-header-image");
  if (headerSlot && PAGE_ASSETS.headerImage) {
    headerSlot.innerHTML = `<img src="${PAGE_ASSETS.headerImage}" alt="Danks Prompts" class="danks-hero__title-img" width="1536" height="1024" decoding="async" />`;
    headerSlot.classList.remove("danks-hero__title-placeholder");
    page?.classList.add("danks-page--has-art");
  }
}

const promptById = new Map(getAllPrompts().map((p) => [p.id, p]));

function bindExpandModal() {
  const dialog = $("#danks-prompt-modal");
  const titleEl = $("#danks-modal-title");
  const bodyEl = $("#danks-modal-body");
  const copyBtn = $("#danks-modal-copy");
  const closeBtn = $("#danks-modal-close");

  if (!dialog) return;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-expand-prompt]");
    if (!btn) return;
    const id = btn.getAttribute("data-expand-prompt");
    const prompt = promptById.get(id);
    if (!prompt) return;

    if (titleEl) titleEl.textContent = prompt.title;
    if (bodyEl) bodyEl.textContent = prompt.promptText;
    if (copyBtn) copyBtn.setAttribute("data-copy-prompt-id", id);

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  });

  closeBtn?.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
}

function bindRandomPrompt() {
  const btn = $("#danks-random-btn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const all = getAllPrompts();
    const pick = all[Math.floor(Math.random() * all.length)];
    const card = document.getElementById(`prompt-${pick.id}`);
    if (!card) return;

    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("danks-prompt-card--glow");
    void card.offsetWidth;
    card.classList.add("danks-prompt-card--glow");
    window.setTimeout(() => card.classList.remove("danks-prompt-card--glow"), 2400);
  });
}

function bindDonatedBtn() {
  const btn = $("#danks-donated-btn");
  const msg = $("#danks-donated-msg");
  if (!btn || !msg) return;

  btn.addEventListener("click", () => {
    msg.hidden = false;
    msg.textContent = "🫧 Gloop thanks! Danks appreciates the love.";
    window.setTimeout(() => {
      msg.hidden = true;
    }, 4000);
  });
}

function initBubbles() {
  const layer = $("#danks-bubbles");
  if (!layer) return;
  const count = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 12;
  for (let i = 0; i < count; i++) {
    const b = document.createElement("span");
    b.className = "danks-bubble";
    b.style.setProperty("--x", `${Math.random() * 100}%`);
    b.style.setProperty("--size", `${8 + Math.random() * 22}px`);
    b.style.setProperty("--dur", `${12 + Math.random() * 18}s`);
    b.style.setProperty("--delay", `${Math.random() * -20}s`);
    layer.appendChild(b);
  }
}

function init() {
  applyPageAssets();
  renderPrompts();
  renderCommunity();
  initAllSliders();
  bindCopyButtons();
  bindScrollLinks();
  bindExpandModal();
  bindRandomPrompt();
  bindDonatedBtn();
  initBubbles();

  const walletEl = $("#danks-wallet-address");
  if (walletEl) walletEl.textContent = DANKS_WALLET;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
