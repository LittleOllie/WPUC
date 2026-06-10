import { loadCollectionIndex } from "./lib/collections.js";
import { createLoadingRotator } from "./lib/loadingMessages.js";
import { findTwins } from "./lib/search.js";

const screens = {
  search: document.getElementById("screen-search"),
  loading: document.getElementById("screen-loading"),
  results: document.getElementById("screen-results"),
};

const collectionSelect = document.getElementById("collection-select");
const tokenInput = document.getElementById("token-input");
const findBtn = document.getElementById("find-btn");
const searchError = document.getElementById("search-error");
const loadingMessage = document.getElementById("loading-message");
const featuredCard = document.getElementById("featured-card");
const twinList = document.getElementById("twin-list");
const searchAgainBtn = document.getElementById("search-again-btn");

let collections = [];
let stopLoadingRotator = null;

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

function updateFindEnabled() {
  const slug = collectionSelect.value;
  const token = tokenInput.value.trim().replace(/^#/, "");
  findBtn.disabled = !slug || !/^\d+$/.test(token);
}

function renderFeatured(result) {
  const { collection, token } = result;
  featuredCard.innerHTML = `
    <div class="ntf-nft-stage">
      <img src="${escapeAttr(token.image)}" alt="NFT #${escapeHtml(token.id)}" loading="eager" decoding="async" />
    </div>
    <div class="ntf-feature-meta">
      <div class="ntf-feature-meta__collection">${escapeHtml(collection.name)}</div>
      <div class="ntf-feature-meta__token">#${escapeHtml(token.id)}</div>
    </div>
  `;
}

function renderTwins(result) {
  twinList.innerHTML = "";

  for (const twin of result.twins) {
    const card = document.createElement("article");
    card.className = "ntf-twin-card";
    card.innerHTML = `
      <div class="ntf-twin-card__row">
        <div class="ntf-twin-thumb">
          <img src="${escapeAttr(twin.image)}" alt="" loading="lazy" decoding="async" />
        </div>
        <div>
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

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
      toggle.textContent = open ? "Show Why" : "Hide Why";
      panel.classList.toggle("is-open", !open);
      panel.hidden = open;
    });

    twinList.appendChild(card);
  }
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

async function boot() {
  try {
    collections = await loadCollectionIndex();
    collectionSelect.innerHTML = collections.length
      ? `<option value="">Choose a collection…</option>${collections
          .map((c) => `<option value="${escapeAttr(c.slug)}">${escapeHtml(c.name)}</option>`)
          .join("")}`
      : `<option value="">No collections yet</option>`;
    collectionSelect.disabled = collections.length === 0;
  } catch {
    collectionSelect.innerHTML = `<option value="">Could not load collections</option>`;
    setSearchError("Collections could not be loaded. Try again later.");
  }
  updateFindEnabled();
}

collectionSelect.addEventListener("change", () => {
  setSearchError("");
  updateFindEnabled();
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

findBtn.addEventListener("click", async () => {
  const slug = collectionSelect.value;
  const tokenId = tokenInput.value.trim().replace(/^#/, "");
  if (!slug || !tokenId) return;

  setSearchError("");
  showScreen("loading");
  stopLoadingRotator?.();
  stopLoadingRotator = createLoadingRotator((msg) => {
    loadingMessage.textContent = msg;
  });

  const minWait = new Promise((r) => window.setTimeout(r, 1200));

  try {
    const [result] = await Promise.all([findTwins(slug, tokenId), minWait]);
    stopLoadingRotator?.();
    stopLoadingRotator = null;
    renderFeatured(result);
    renderTwins(result);
    showScreen("results");
  } catch (error) {
    stopLoadingRotator?.();
    stopLoadingRotator = null;
    showScreen("search");

    const code = error?.message || "";
    if (code === "INVALID_TOKEN_ID") {
      setSearchError("Enter a valid NFT number (digits only).");
    } else if (code === "NO_TWINS_FOUND") {
      setSearchError("No twins found for that token. Try another number.");
    } else if (code === "COLLECTION_NOT_FOUND") {
      setSearchError("That collection is not available yet.");
    } else {
      setSearchError("Something went wrong. Please try again.");
    }
  }
});

searchAgainBtn.addEventListener("click", () => {
  showScreen("search");
});

void boot();
