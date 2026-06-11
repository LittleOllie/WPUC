import { loadCollectionIndex } from "./lib/collections.js";
import { createLoadingRotator } from "./lib/loadingMessages.js";
import { findTwins } from "./lib/search.js";
import { imageUrlCandidates } from "./lib/imageUrls.js";
import { playTwinReveal, preloadImage, REVEAL_TOTAL_MS } from "./lib/twinReveal.js";

const screens = {
  search: document.getElementById("screen-search"),
  loading: document.getElementById("screen-loading"),
  results: document.getElementById("screen-results"),
};

const collectionSelect = document.getElementById("collection-select");
const collectionSelectTrigger = document.getElementById("collection-select-trigger");
const collectionSelectLabel = document.getElementById("collection-select-label");
const collectionSelectMenu = document.getElementById("collection-select-menu");
const tokenInput = document.getElementById("token-input");
const findBtn = document.getElementById("find-btn");
const searchError = document.getElementById("search-error");
const loadingMessage = document.getElementById("loading-message");
const duoHero = document.getElementById("duo-hero");
const moreTwinsTitle = document.getElementById("more-twins-title");
const compareHint = document.getElementById("compare-hint");
const twinList = document.getElementById("twin-list");
const searchAgainBtn = document.getElementById("search-again-btn");
const resultsBackBtn = document.getElementById("results-back-btn");
const resultsQuickSearch = document.getElementById("results-quick-search");
const resultsTokenInput = document.getElementById("results-token-input");
const resultsError = document.getElementById("results-error");
const revealStage = document.getElementById("ntf-reveal-stage");
const loadingBar = document.getElementById("loading-bar");
const loadingSpinner = document.querySelector(".ntf-spinner");

function createLoadingProgress(barEl) {
  let value = 0;
  let creepTimer = null;
  let animateFrame = null;

  const apply = (next) => {
    value = Math.max(0, Math.min(100, next));
    barEl.style.setProperty("--progress", `${value}%`);
    barEl.setAttribute("aria-valuenow", String(Math.round(value)));
  };

  const stopCreep = () => {
    if (creepTimer) {
      clearInterval(creepTimer);
      creepTimer = null;
    }
  };

  const stopAnimate = () => {
    if (animateFrame) {
      cancelAnimationFrame(animateFrame);
      animateFrame = null;
    }
  };

  return {
    reset() {
      stopCreep();
      stopAnimate();
      apply(0);
    },
    set(target) {
      stopAnimate();
      apply(target);
    },
    startCreep(max = 28, step = 0.35) {
      stopCreep();
      creepTimer = window.setInterval(() => {
        if (value < max) apply(value + step);
      }, 60);
    },
    stopCreep,
    animateTo(target, durationMs) {
      stopAnimate();
      stopCreep();
      const start = value;
      const delta = target - start;
      if (!delta) return Promise.resolve();

      const startTime = performance.now();
      return new Promise((resolve) => {
        const tick = (now) => {
          const t = Math.min(1, (now - startTime) / durationMs);
          apply(start + delta * t);
          if (t < 1) {
            animateFrame = requestAnimationFrame(tick);
          } else {
            animateFrame = null;
            resolve();
          }
        };
        animateFrame = requestAnimationFrame(tick);
      });
    },
  };
}

const loadingProgress = createLoadingProgress(loadingBar);

let collections = [];
let stopLoadingRotator = null;
/** @type {Awaited<ReturnType<typeof findTwins>> | null} */
let lastResult = null;
let selectedTwinIndex = 0;

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle("is-active", key === name);
  }
}

function setSearchError(message) {
  if (!message) {
    searchError.hidden = true;
    searchError.textContent = "";
    return;
  }
  searchError.hidden = false;
  searchError.textContent = message;
}

function setResultsError(message) {
  if (!message) {
    resultsError.hidden = true;
    resultsError.textContent = "";
    return;
  }
  resultsError.hidden = false;
  resultsError.textContent = message;
}

function updateFindEnabled() {
  const slug = collectionSelect.value;
  const token = tokenInput.value.trim().replace(/^#/, "");
  findBtn.disabled = !slug || !/^\d+$/.test(token);
}

function attachImageFallback(img, url) {
  const candidates = imageUrlCandidates(url);
  if (!candidates.length) return;

  let index = 0;
  img.src = candidates[0];
  img.addEventListener("error", () => {
    index += 1;
    if (index < candidates.length) {
      img.src = candidates[index];
    }
  });
}

function bindImageFallbacks(root) {
  root.querySelectorAll("img[data-image-src]").forEach((img) => {
    attachImageFallback(img, img.dataset.imageSrc || "");
  });
}

function renderNftCard({ image, collectionName, tokenId, label, accent }) {
  const accentClass = accent ? " ntf-duo-card--accent" : "";

  return `
    <article class="ntf-duo-card${accentClass}">
      <div class="ntf-duo-card__label">${escapeHtml(label)}</div>
      <div class="ntf-nft-stage">
        <img
          src="${escapeAttr(image)}"
          data-image-src="${escapeAttr(image)}"
          alt="NFT #${escapeHtml(tokenId)}"
          loading="eager"
          decoding="async"
        />
      </div>
      <div class="ntf-duo-card__meta">
        <div class="ntf-duo-card__collection">${escapeHtml(collectionName)}</div>
        <div class="ntf-duo-card__token">#${escapeHtml(tokenId)}</div>
      </div>
    </article>
  `;
}

function renderDuoHero(result, twinIndex = 0) {
  const { collection, token, twins } = result;
  const twin = twins[twinIndex];
  if (!twin) return;

  duoHero.innerHTML = `
    <div class="ntf-duo-hero__grid">
      ${renderNftCard({
        image: token.image,
        collectionName: collection.name,
        tokenId: token.id,
        label: "Your NFT",
        accent: false,
      })}
      <div class="ntf-duo-hero__vs" aria-hidden="true">×</div>
      ${renderNftCard({
        image: twin.image,
        collectionName: collection.name,
        tokenId: twin.id,
        label: `#${twinIndex + 1} Twin`,
        accent: true,
      })}
    </div>
    <p class="ntf-duo-hero__match">${twin.score.toFixed(1)}% Match</p>
    <p class="ntf-duo-hero__summary">${escapeHtml(twin.summary)}</p>
  `;

  bindImageFallbacks(duoHero);
}

function updateTwinSelection() {
  twinList.querySelectorAll(".ntf-twin-card").forEach((card) => {
    const index = Number(card.dataset.twinIndex);
    const active = index === selectedTwinIndex;
    card.classList.toggle("ntf-twin-card--active", active);
    card.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function selectTwin(index) {
  if (!lastResult?.twins[index]) return;
  selectedTwinIndex = index;
  renderDuoHero(lastResult, index);
  updateTwinSelection();
}

function renderTwinCard(twin, rank, twinIndex) {
  const card = document.createElement("article");
  card.className = "ntf-twin-card";
  card.dataset.twinIndex = String(twinIndex);
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-pressed", twinIndex === selectedTwinIndex ? "true" : "false");
  if (twinIndex === selectedTwinIndex) {
    card.classList.add("ntf-twin-card--active");
  }

  card.innerHTML = `
    <div class="ntf-twin-card__row">
      <div class="ntf-twin-thumb">
        <span class="ntf-twin-rank">#${rank}</span>
        <img
          src="${escapeAttr(twin.image)}"
          data-image-src="${escapeAttr(twin.image)}"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
      <div class="ntf-twin-card__body">
        <div class="ntf-twin-score">${twin.score.toFixed(1)}% Match</div>
        <div class="ntf-twin-token">#${escapeHtml(twin.id)}</div>
        <div class="ntf-twin-summary">${escapeHtml(twin.summary)}</div>
      </div>
    </div>
    <button type="button" class="ntf-why-toggle" aria-expanded="false">Show Why</button>
    <div class="ntf-why-panel" hidden></div>
  `;

  const toggle = card.querySelector(".ntf-why-toggle");
  const panel = card.querySelector(".ntf-why-panel");
  panel.innerHTML = twin.breakdown
    .map((row) => {
      const cls = row.match ? "ntf-why-row--match" : "ntf-why-row--diff";
      const icon = row.match ? "✓" : "✗";
      return `<div class="${cls}">${icon} ${escapeHtml(row.label)}</div>`;
    })
    .join("");

  const thumbImg = card.querySelector(".ntf-twin-thumb img");
  if (thumbImg) attachImageFallback(thumbImg, twin.image);

  const pickTwin = () => selectTwin(twinIndex);

  card.querySelector(".ntf-twin-card__row")?.addEventListener("click", pickTwin);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      if (event.target === toggle) return;
      event.preventDefault();
      pickTwin();
    }
  });

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", open ? "false" : "true");
    toggle.textContent = open ? "Show Why" : "Hide Why";
    panel.classList.toggle("is-open", !open);
    panel.hidden = open;
  });

  return card;
}

function renderTwinList(result) {
  twinList.innerHTML = "";
  const { twins } = result;

  if (!twins.length) {
    moreTwinsTitle.hidden = true;
    compareHint.hidden = true;
    return;
  }

  moreTwinsTitle.hidden = false;
  compareHint.hidden = twins.length < 2;

  for (let i = 0; i < twins.length; i += 1) {
    twinList.appendChild(renderTwinCard(twins[i], i + 1, i));
  }
}

function renderResults(result) {
  lastResult = result;
  selectedTwinIndex = 0;
  renderDuoHero(result, 0);
  renderTwinList(result);
  setResultsError("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function getCollectionLabel(slug) {
  if (!slug) {
    return collections.length ? "Choose a collection…" : "No collections yet";
  }
  return collections.find((collection) => collection.slug === slug)?.name || slug;
}

function closeCollectionMenu() {
  collectionSelectMenu.hidden = true;
  collectionSelectTrigger.setAttribute("aria-expanded", "false");
}

function openCollectionMenu() {
  collectionSelectMenu.hidden = false;
  collectionSelectTrigger.setAttribute("aria-expanded", "true");
}

function setCollectionValue(slug, { silent = false } = {}) {
  const nextSlug = slug || "";
  collectionSelect.value = nextSlug;
  collectionSelectLabel.textContent = getCollectionLabel(nextSlug);
  collectionSelectMenu.querySelectorAll(".ntf-select-menu__option").forEach((option) => {
    const active = option.dataset.slug === nextSlug;
    option.classList.toggle("is-active", active);
    option.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (!silent) {
    setSearchError("");
    updateFindEnabled();
    collectionSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function renderCollectionPicker() {
  const placeholder = collections.length ? "Choose a collection…" : "No collections yet";
  collectionSelect.innerHTML = collections.length
    ? `<option value="">${placeholder}</option>${collections
        .map((collection) => `<option value="${escapeAttr(collection.slug)}">${escapeHtml(collection.name)}</option>`)
        .join("")}`
    : `<option value="">${placeholder}</option>`;

  collectionSelectMenu.innerHTML = collections
    .map(
      (collection) => `
        <li role="presentation">
          <button
            type="button"
            class="ntf-select-menu__option"
            role="option"
            data-slug="${escapeAttr(collection.slug)}"
            aria-selected="false"
          >
            ${escapeHtml(collection.name)}
          </button>
        </li>
      `,
    )
    .join("");

  const disabled = collections.length === 0;
  collectionSelect.disabled = disabled;
  collectionSelectTrigger.disabled = disabled;
  setCollectionValue(collectionSelect.value || "", { silent: true });
}

async function boot() {
  try {
    collections = await loadCollectionIndex();
    renderCollectionPicker();
  } catch {
    collections = [];
    collectionSelect.innerHTML = `<option value="">Could not load collections</option>`;
    collectionSelectMenu.innerHTML = "";
    collectionSelectLabel.textContent = "Could not load collections";
    collectionSelect.disabled = true;
    collectionSelectTrigger.disabled = true;
    setSearchError("Collections could not be loaded. Try again later.");
  }
  updateFindEnabled();
}

collectionSelect.addEventListener("change", () => {
  setSearchError("");
  updateFindEnabled();
});

collectionSelectTrigger.addEventListener("click", () => {
  if (collectionSelectTrigger.disabled) return;
  if (collectionSelectMenu.hidden) {
    openCollectionMenu();
  } else {
    closeCollectionMenu();
  }
});

collectionSelectMenu.addEventListener("click", (event) => {
  const option = event.target.closest(".ntf-select-menu__option");
  if (!option) return;
  setCollectionValue(option.dataset.slug || "");
  closeCollectionMenu();
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".ntf-select-wrap")) return;
  closeCollectionMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCollectionMenu();
});

tokenInput.addEventListener("input", () => {
  setSearchError("");
  updateFindEnabled();
});

tokenInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !findBtn.disabled) {
    event.preventDefault();
    findBtn.click();
  }
});

function resolveSearchErrorMessage(error) {
  const code = error?.message || "";
  if (code === "INVALID_TOKEN_ID") {
    return "Enter a valid NFT number (digits only).";
  }
  if (code === "NO_TWINS_FOUND") {
    return "No twins found for that token. Try another number.";
  }
  if (code === "COLLECTION_NOT_FOUND") {
    return "That collection is not available yet.";
  }
  return "Something went wrong. Please try again.";
}

async function runTwinSearch(slug, tokenId, { onErrorScreen = "search" } = {}) {
  if (!slug || !tokenId) return;

  setSearchError("");
  setResultsError("");
  showScreen("loading");
  revealStage.hidden = true;
  loadingBar.hidden = false;
  loadingSpinner.hidden = true;
  loadingProgress.reset();
  loadingProgress.startCreep(30);
  stopLoadingRotator?.();
  stopLoadingRotator = createLoadingRotator((msg) => {
    loadingMessage.textContent = msg;
  });

  try {
    const result = await findTwins(slug, tokenId);
    const topTwin = result.twins[0];
    if (!topTwin) throw new Error("NO_TWINS_FOUND");

    loadingProgress.stopCreep();
    await loadingProgress.animateTo(42, 320);
    loadingMessage.textContent = "Loading artwork...";

    await Promise.race([
      Promise.all([
        preloadImage(result.token.image),
        preloadImage(topTwin.image),
      ]),
      new Promise((resolve) => window.setTimeout(resolve, 7000)),
    ]);
    await loadingProgress.animateTo(58, 280);
    loadingMessage.textContent = "Twin found!";

    stopLoadingRotator?.();
    stopLoadingRotator = null;

    const revealDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 400
      : REVEAL_TOTAL_MS;

    await Promise.all([
      playTwinReveal({
        sourceImage: result.token.image,
        twinImage: topTwin.image,
      }),
      loadingProgress.animateTo(100, revealDuration),
    ]);

    renderResults(result);
    setCollectionValue(slug, { silent: true });
    tokenInput.value = tokenId;
    resultsTokenInput.value = "";
    updateFindEnabled();
    showScreen("results");
  } catch (error) {
    stopLoadingRotator?.();
    stopLoadingRotator = null;
    loadingProgress.reset();
    revealStage.hidden = true;
    loadingBar.hidden = false;
    loadingSpinner.hidden = true;

    const message = resolveSearchErrorMessage(error);
    if (onErrorScreen === "results") {
      showScreen("results");
      setResultsError(message);
    } else {
      showScreen("search");
      setSearchError(message);
    }
  }
}

findBtn.addEventListener("click", () => {
  const slug = collectionSelect.value;
  const tokenId = tokenInput.value.trim().replace(/^#/, "");
  void runTwinSearch(slug, tokenId);
});

function goToSearch() {
  setResultsError("");
  showScreen("search");
}

function submitResultsQuickSearch() {
  const slug = lastResult?.collection?.slug;
  const entered = resultsTokenInput.value.trim().replace(/^#/, "");
  const tokenId = entered || lastResult?.token?.id;
  if (!slug || !/^\d+$/.test(String(tokenId || ""))) {
    setResultsError("Enter a valid NFT number (digits only).");
    return;
  }
  void runTwinSearch(slug, tokenId, { onErrorScreen: "results" });
}

searchAgainBtn.addEventListener("click", submitResultsQuickSearch);
resultsBackBtn.addEventListener("click", goToSearch);

resultsTokenInput.addEventListener("input", () => {
  setResultsError("");
});

resultsQuickSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  submitResultsQuickSearch();
});

void boot();
