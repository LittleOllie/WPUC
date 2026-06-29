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
import { playGooEnterTransition } from "./goo-transition.js";
import { beginLabReveal, mountHeaderInHero, resetLabRevealState } from "./lab-reveal.js";

const $ = (sel, root = document) => root.querySelector(sel);

/** Resolve asset path using document <base> (never import.meta — breaks in IDE preview). */
function assetUrl(relativePath) {
  if (!relativePath) return "";
  if (/^(https?:|data:|blob:)/i.test(relativePath)) return relativePath;
  const clean = relativePath.replace(/^\//, "");
  return new URL(clean, document.baseURI).href;
}

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

  function syncImageLayout() {
    const w = root.clientWidth;
    const h = root.clientHeight;
    beforeImg.style.width = `${w}px`;
    beforeImg.style.height = `${h}px`;
  }

  const afterImg = $(".danks-ba__after", root);
  [beforeImg, afterImg].filter(Boolean).forEach((img) => {
    img.addEventListener("error", () => {
      console.warn("[Danks Prompts] Image failed to load:", img.getAttribute("src"));
    });
    img.addEventListener("load", () => {
      syncImageLayout();
      applySmartFit(img);
    });
    if (img.complete && img.naturalWidth) {
      applySmartFit(img);
    }
  });

  /** Square NFTs fill the frame; wider/taller prompts letterbox cleanly */
  function applySmartFit(img) {
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return;
    const ratio = nw / nh;
    const isSquareish = ratio >= 0.92 && ratio <= 1.08;
    img.classList.toggle("danks-ba__img--cover", isSquareish);
    img.classList.toggle("danks-ba__img--contain", !isSquareish);
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
    syncImageLayout();
    setPct(pct);
  });
  ro.observe(root);
  syncImageLayout();
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
      <img class="danks-ba__after" src="${assetUrl(prompt.afterImage)}" alt="${afterAlt}" decoding="async" />
      <div class="danks-ba__clip">
        <img class="danks-ba__before" src="${assetUrl(prompt.beforeImage)}" alt="${beforeAlt}" decoding="async" />
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
        <img src="${assetUrl(item.image)}" alt="Community creation using ${escapeHtml(item.promptUsed)}" loading="lazy" decoding="async" />
      </div>
      <figcaption>
        <span class="danks-community-card__creator">${escapeHtml(item.creator)}</span>
        <span class="danks-community-card__prompt">${escapeHtml(item.promptUsed)}</span>
      </figcaption>
    </figure>
  `
  ).join("");
}

function headerImageSrc() {
  if (!PAGE_ASSETS.headerImage) return "";
  return PAGE_ASSETS.headerVersion
    ? `${assetUrl(PAGE_ASSETS.headerImage)}?v=${PAGE_ASSETS.headerVersion}`
    : assetUrl(PAGE_ASSETS.headerImage);
}

function applyPageAssets() {
  const page = document.body;

  const headerSrc = headerImageSrc();
  const headerHtml = headerSrc
    ? `<div class="danks-gloop-header-wrap">
        <img src="${headerSrc}" alt="Danks Prompts" class="danks-gloop-header-img" width="1536" height="1024" decoding="async" />
      </div>`
    : "";

  const splashHeader = $("#danks-splash-header");
  if (splashHeader && headerHtml) {
    splashHeader.innerHTML = headerHtml;
  }

  const headerSlot = $("#danks-header-image");
  if (headerSlot && headerHtml) {
    headerSlot.innerHTML = "";
    headerSlot.classList.remove("danks-hero__title-placeholder");
    page?.classList.add("danks-page--has-art");
  }
}

function applyLabBackground() {
  const page = document.body;
  const bg = $(".danks-page__bg");
  if (bg && PAGE_ASSETS.backgroundImage) {
    bg.style.backgroundImage = `url("${assetUrl(PAGE_ASSETS.backgroundImage)}")`;
    bg.classList.add("danks-page__bg--image");
    bg.classList.remove("danks-page__bg--splash");
    page?.classList.add("danks-page--has-art");
  }
}

function applySplashBackground() {
  const page = document.body;
  const bg = $(".danks-page__bg");
  if (bg) {
    bg.style.backgroundImage = "";
    bg.classList.remove("danks-page__bg--image");
    bg.classList.add("danks-page__bg--splash");
    page?.classList.remove("danks-page--has-art");
  }
}

const SPLASH_KEY = "danks-gloop-entered";

function preloadGloopTexture() {
  if (!PAGE_ASSETS.backgroundImage) return;
  const img = new Image();
  img.decoding = "async";
  img.src = assetUrl(PAGE_ASSETS.backgroundImage);
}

function showMainApp() {
  const splash = $("#danks-splash");
  const main = $("#danks-main");
  applyLabBackground();
  mountHeaderInHero();
  document.body.classList.remove("danks-page--splash", "danks-page--entering", "danks-page--revealing");
  splash?.classList.add("danks-splash--hidden");
  splash?.classList.remove("danks-splash--melting");
  if (main) {
    main.classList.remove("danks-main--hidden", "danks-main--content-hidden");
    main.classList.add("danks-main--content-visible");
    main.setAttribute("aria-hidden", "false");
  }
  splash?.setAttribute("aria-hidden", "true");
  try {
    sessionStorage.setItem(SPLASH_KEY, "1");
  } catch {
    /* ignore */
  }
}

function showSplash() {
  const splash = $("#danks-splash");
  const main = $("#danks-main");
  const enterBtn = $("#danks-enter-btn");

  applySplashBackground();
  resetLabRevealState();
  main?.classList.add("danks-main--hidden");
  main?.classList.remove("danks-main--content-visible");
  main?.setAttribute("aria-hidden", "true");

  splash?.classList.remove("danks-splash--hidden");
  splash?.classList.remove("danks-splash--melting");
  splash?.setAttribute("aria-hidden", "false");

  document.body.classList.add("danks-page--splash");
  document.body.classList.remove("danks-page--entering", "danks-page--revealing");

  if (enterBtn) enterBtn.disabled = false;

  try {
    sessionStorage.removeItem(SPLASH_KEY);
  } catch {
    /* ignore */
  }

  window.scrollTo(0, 0);
}

function bindBackToSplash() {
  const backBtn = $("#danks-back-btn");
  if (!backBtn) return;

  backBtn.addEventListener("click", () => {
    showSplash();
  });
}

function bindSplashEnter() {
  const btn = $("#danks-enter-btn");
  const splash = $("#danks-splash");
  const main = $("#danks-main");
  if (!btn || !splash || !main) return;

  const alreadyEntered = (() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) === "1";
    } catch {
      return false;
    }
  })();

  if (alreadyEntered) {
    showMainApp();
  } else {
    applySplashBackground();
    document.body.classList.add("danks-page--splash");
  }

  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add("danks-splash__enter--hide");
    document.body.classList.add("danks-page--entering");

    let finished = false;
    let revealStarted = false;

    const startReveal = () => {
      if (revealStarted) return;
      revealStarted = true;
      beginLabReveal({
        applyLabBackground,
        splashKey: SPLASH_KEY,
        onComplete: () => {
          window.clearTimeout(safety);
          document.body.classList.remove("danks-page--entering");
          done();
        },
      });
    };

    const done = () => {
      if (finished) return;
      finished = true;
      btn.disabled = false;
    };

    const safety = window.setTimeout(() => {
      if (finished) return;
      startReveal();
    }, 7000);

    playGooEnterTransition({
      getTextureUrl: () => assetUrl(PAGE_ASSETS.backgroundImage),
      onMidpoint: startReveal,
      onComplete: () => {
        /* goo canvas cleared — lab reveal continues independently */
      },
    });
  });
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
  bindSplashEnter();
  bindBackToSplash();
  preloadGloopTexture();
  initBubbles();

  const walletEl = $("#danks-wallet-address");
  if (walletEl) walletEl.textContent = DANKS_WALLET;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
