/* Little Ollie Flex Grid (SAFE export for file:// + Multi-Wallet)
   - GRID loads via Worker proxy + IPFS gateway fallback
   - Guards against DOUBLE-PROXY
   - Alchemy metadata fallback per token after image failures
   - IMPORTANT:
     - Grid display can fall back to DIRECT urls (for reliability) if Worker fails.
     - Export stays PROXY-first to keep canvas untainted.
   - SECURITY: API keys loaded from secure config (see config.js)
*/

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

// ✅ Global toggle (was incorrectly inside getIpfsPath before)
const SHOW_ERROR_PANEL = false; // set true only when debugging

// ---------- Guided glow (onboarding highlight) ----------
function setGuideGlow(ids = []) {
  const all = [
    "walletInput",
    "addWalletBtn",
    "loadBtn",
    "controlsPanel",
    "collectionsList",
  ];

  // clear glow everywhere
  all.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("guideGlow");
  });

  // apply glow to current targets
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("guideGlow");
  });
}

// Call this any time state changes
function updateGuideGlow() {
  const hasWallets = state.wallets.length > 0;
  const hasLoadedWallets = state.collections.length > 0;
  const controlsVisible =
    !!document.getElementById("controlsPanel") &&
    $("controlsPanel")?.style.display !== "none";
  const hasSelectedCollections = state.selectedKeys && state.selectedKeys.size > 0;
  const hasTwoOrMoreSelected = state.selectedKeys && state.selectedKeys.size >= 2;

  const gridHasTiles = document.querySelectorAll("#grid .tile").length > 0;
  const exportEnabled = !!$("gridExportBtn") && $("gridExportBtn").disabled === false;

  // Clear primaryCTA from all CTA buttons
  ["loadBtn", "gridBuildBtn", "gridExportBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("primaryCTA");
  });

  // Empty states
  const walletEmpty = $("walletEmptyState");
  const walletHint = document.querySelector(".walletHint");
  if (walletEmpty) walletEmpty.style.display = hasWallets ? "none" : "";
  if (walletHint) walletHint.style.display = hasWallets ? "" : "none";

  const collEmpty = $("collectionsEmptyState");
  if (collEmpty && (controlsVisible || hasLoadedWallets)) {
    collEmpty.style.display = state.collections.length > 0 ? "" : "none";
  } else if (collEmpty) collEmpty.style.display = "none";

  // 1) No wallets yet -> highlight input + add
  if (!hasWallets) {
    setGuideGlow(["walletInput", "addWalletBtn"]);
    return;
  }

  // 2) Wallet(s) added but not loaded yet -> highlight Load wallet(s) (pulse)
  if (hasWallets && !hasLoadedWallets) {
    setGuideGlow(["loadBtn"]);
    const loadBtn = $("loadBtn");
    if (loadBtn) loadBtn.classList.add("primaryCTA");
    return;
  }

  // 3) Wallets loaded, no/minimal selection -> highlight collections area (panel + list)
  if (controlsVisible && !hasTwoOrMoreSelected) {
    setGuideGlow(["controlsPanel", "collectionsList"]);
    return;
  }

  // 4) Two or more collections selected -> highlight build
  if (hasTwoOrMoreSelected && !gridHasTiles) {
    setGuideGlow(["gridBuildBtn"]);
    const buildBtn = $("gridBuildBtn");
    if (buildBtn) buildBtn.classList.add("primaryCTA");
    return;
  }

  // 5) Grid built -> highlight export
  if (gridHasTiles) {
    setGuideGlow(["gridExportBtn"]);
    const exportBtn = $("gridExportBtn");
    if (exportBtn) exportBtn.classList.add("primaryCTA");
    return;
  }

  setGuideGlow([]);
}

const state = {
  collections: [],
  selectedKeys: new Set(),
  selectedSortByCollection: {},
  wallets: [],
  chain: "eth",
  host: "eth-mainnet.g.alchemy.com",
  walletCollapsed: true,
  collectionsCollapsed: true,
  traitOrderCollapsed: true,
};
state.imageLoadState = { total: 0, loaded: 0, failed: 0, retrying: 0 };

// ---- Export watermark (single source of truth) ----
const EXPORT_WATERMARK_TEXT = "⚡ Powered by Little Ollie";

// Configuration (loaded securely - see loadConfig() below)
let ALCHEMY_KEY = null;
let IMG_PROXY = null;
let configLoaded = false;

const ALCHEMY_HOST = {
  eth: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
  apechain: null,
};

const WORKER_BASE = "https://loflexgrid.littleollienft.workers.dev";

// ---------- Build cache-buster (GRID only) ----------
let BUILD_ID = Date.now();

// ---------- Image load limiter (prevents Worker/IPFS stampede) ----------
function createLimiter(max = 3) {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= max || queue.length === 0) return;
    active++;

    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

// 12 concurrent image loads — faster grid; Worker can handle it
let gridImgLimit = createLimiter(12);

// ---------- Image loading tune ----------
const IMG_LOAD = {
  gridTimeoutMs: 12000,  // fail fast so slow URLs don't block others
  gridDirectTimeoutMs: 8000,
  retriesPerCandidate: 0,  // skip extra gateway retries for speed
  backoffMs: 200,
};

// Prefer reliable gateways first (you can reorder later)
const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://ipfs.filebase.io/ipfs/",
];

function setImgCORS(imgEl, enabled) {
  try {
    if (!imgEl) return;
    if (enabled) {
      imgEl.crossOrigin = "anonymous";
    } else {
      imgEl.removeAttribute("crossorigin");
      imgEl.crossOrigin = null;
    }
  } catch (_) {}
}

// ---------- Timeout wrapper for image loading ----------
const PLACEHOLDER_DATA_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23333' width='1' height='1'/%3E%3C/svg%3E";

function loadImgWithTimeout(imgEl, src, timeout = 25000) {
  return Promise.race([
    new Promise((resolve, reject) => {
      const clean = () => {
        imgEl.onload = null;
        imgEl.onerror = null;
      };
      imgEl.onload = () => {
        clean();
        resolve(true);
      };
      imgEl.onerror = () => {
        if (!imgEl.dataset.retry) {
          imgEl.dataset.retry = "1";
          const fallbackSrc = src.replace("nftstorage.link", "cloudflare-ipfs.com");
          if (fallbackSrc !== src) {
            imgEl.src = fallbackSrc;
            return;
          }
        }
        imgEl.src = PLACEHOLDER_DATA_URL;
        imgEl.onerror = null;
        clean();
        reject(new Error("Image failed: " + src));
      };

      try {
        imgEl.removeAttribute("src");
      } catch (e) {}
      imgEl.src = src;
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Image load timeout")), timeout)
    ),
  ]);
}

function loadImgWithLimiter(imgEl, src, timeout = 25000) {
  return gridImgLimit(() => loadImgWithTimeout(imgEl, src, timeout));
}

// Non-limited (for direct fallback)
function loadImgNoLimit(imgEl, src, timeout = 20000) {
  return loadImgWithTimeout(imgEl, src, timeout);
}

// ---------- UI helpers ----------
const errorLog = {
  errors: [],
  maxErrors: 50,
};

function addError(error, context = "") {
  const timestamp = new Date().toLocaleTimeString();
  const errorEntry = {
    timestamp,
    message: error?.message || String(error),
    context,
    stack: error?.stack,
    fullError: error,
  };

  errorLog.errors.unshift(errorEntry);
  if (errorLog.errors.length > errorLog.maxErrors) {
    errorLog.errors = errorLog.errors.slice(0, errorLog.maxErrors);
  }

  updateErrorLogDisplay();
}

function updateErrorLogDisplay() {
  const errorLogEl = $("errorLog");
  const errorLogContent = $("errorLogContent");

  // ✅ hide the panel for normal users
  if (!SHOW_ERROR_PANEL) {
    if (errorLogEl) errorLogEl.style.display = "none";
    return;
  }

  if (!errorLogEl || !errorLogContent) return;

  if (errorLog.errors.length === 0) {
    errorLogEl.style.display = "none";
    return;
  }

  errorLogEl.style.display = "block";
  errorLogContent.innerHTML = errorLog.errors
    .map((err) => {
      const contextText = err.context
        ? ` <span style="opacity: 0.7;">[${escapeHtml(err.context)}]</span>`
        : "";
      const stackText =
        err.stack && window.location.hostname === "localhost"
          ? `<div style="margin-top: 4px; padding-left: 12px; opacity: 0.6; font-size: 10px;">${err.stack
              .split("\n")
              .slice(0, 3)
              .map((line) => escapeHtml(line))
              .join("<br>")}</div>`
          : "";
      return `
      <div style="padding: 6px 0; border-bottom: 1px solid rgba(244, 67, 54, 0.2);">
        <div style="color: #f44336; font-weight: 700;">
          <span style="opacity: 0.7; font-size: 10px;">[${escapeHtml(err.timestamp)}]</span>${contextText}
        </div>
        <div style="margin-top: 2px; color: #ffcdd2;">${escapeHtml(err.message)}</div>
        ${stackText}
      </div>
    `;
    })
    .join("");
}

function clearErrorLog() {
  errorLog.errors = [];
  updateErrorLogDisplay();
}

function showConnectionStatus(connected) {
  const statusEl = $("connectionStatus");
  const lightEl = $("connectionLight");
  const textEl = $("connectionText");

  if (!statusEl) return;

  statusEl.style.display = "flex";

  if (connected) {
    statusEl.style.background = "rgba(76, 175, 80, 0.15)";
    statusEl.style.borderColor = "rgba(76, 175, 80, 0.3)";
    if (lightEl) {
      lightEl.style.background = "#4CAF50";
      lightEl.style.boxShadow = "0 0 8px rgba(76, 175, 80, 0.6)";
    }
    if (textEl) {
      textEl.textContent = "Connected";
      textEl.style.color = "#4CAF50";
    }
  } else {
    statusEl.style.background = "rgba(244, 67, 54, 0.15)";
    statusEl.style.borderColor = "rgba(244, 67, 54, 0.3)";
    if (lightEl) {
      lightEl.style.background = "#f44336";
      lightEl.style.boxShadow = "0 0 8px rgba(244, 67, 54, 0.6)";
    }
    if (textEl) {
      textEl.textContent = "Not Connected";
      textEl.style.color = "#f44336";
    }
  }
}

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

function showLoading(message = "Loading…", progress = "", pct = null) {
  const overlay = $("loadingOverlay");
  const textEl = document.getElementById("loadingOverlayText");
  const progressEl = document.getElementById("loadingOverlayProgress");
  const barEl = document.getElementById("loadingOverlayBar");
  if (overlay) {
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");
  }
  if (textEl) textEl.textContent = message;
  if (progressEl) progressEl.textContent = progress || "";
  if (barEl) {
    const w = pct != null ? Math.min(100, Math.max(0, Number(pct))) : 0;
    barEl.style.width = w + "%";
    barEl.setAttribute("aria-valuenow", String(Math.round(w)));
  }
}

function hideLoading() {
  const overlay = $("loadingOverlay");
  if (overlay) {
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
  }
}

function updateImageProgress() {
  const { total, loaded, failed, retrying } = state.imageLoadState;

  const barWrap = document.getElementById("imageProgressBarWrap");
  const bar = document.getElementById("imageProgressBar");
  const retryBtn = document.getElementById("retryBtn");
  const stageFooter = document.getElementById("stageFooter");
  const gridStatusText = document.getElementById("gridStatusText");
  const gridStatusProgressWrap = document.getElementById("gridStatusProgressWrap");
  const gridStatusProgress = document.getElementById("gridStatusProgress");
  const gridStatusRetryArea = document.getElementById("gridStatusRetryArea");

  if (total === 0) {
    if (barWrap) barWrap.style.display = "none";
    if (retryBtn) retryBtn.classList.remove("pulseAlert");
    if (stageFooter) stageFooter.style.display = "none";
    return;
  }

  const progress = Math.round((loaded / total) * 100);
  const isComplete = loaded >= total && failed === 0;
  let statusMsg = isComplete
    ? `✨ All ${total} images loaded`
    : `Loading images: ${loaded}/${total}`;
  if (failed > 0) statusMsg += ` • ${failed} failed`;
  if (retrying > 0) statusMsg += ` • retrying...`;

  setStatus(statusMsg);

  /* Below-grid status bar */
  if (stageFooter) stageFooter.style.display = "flex";
  if (gridStatusText) gridStatusText.textContent = statusMsg;
  if (gridStatusProgressWrap) gridStatusProgressWrap.style.display = loaded < total ? "" : "none";
  if (gridStatusProgress) {
    gridStatusProgress.style.width = progress + "%";
    gridStatusProgress.setAttribute("aria-valuenow", String(progress));
  }
  if (gridStatusRetryArea) {
    gridStatusRetryArea.style.display = failed > 0 ? "flex" : "none";
  }

  /* Legacy left-panel elements */
  if (barWrap) barWrap.style.display = "";
  if (bar) bar.style.width = progress + "%";

  if (retryBtn) {
    if (failed > 0) retryBtn.classList.add("pulseAlert");
    else retryBtn.classList.remove("pulseAlert");
  }
}

function showControlsPanel(show) {
  const el = $("controlsPanel");
  if (el) el.style.display = show ? "" : "none";
}

function syncGridFooterButtons(buildDisabled, exportDisabled) {
  const gridBuild = $("gridBuildBtn");
  const gridExport = $("gridExportBtn");
  if (gridBuild != null) gridBuild.disabled = buildDisabled ?? state.selectedKeys.size === 0;
  if (gridExport != null) gridExport.disabled = exportDisabled ?? true;
}
function enableButtons() {
  const loadBtn = $("loadBtn");
  const buildBtn = $("gridBuildBtn");
  const exportBtn = $("gridExportBtn");

  const hasWallets = state.wallets.length > 0;
  if (loadBtn) loadBtn.disabled = !hasWallets;
  const buildDisabled = state.selectedKeys.size === 0;
  if (buildBtn) buildBtn.disabled = buildDisabled;
  if (exportBtn) exportBtn.disabled = true;
  syncGridFooterButtons(buildDisabled, true);

  updateGuideGlow();
}

function setGridColumns(cols) {
  const grid = $("grid");
  if (grid) grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
}

function safeText(s) {
  return (s || "").toString();
}

// ---------- URL helpers ----------
function isAlreadyProxied(url) {
  return typeof url === "string" && !!IMG_PROXY && url.startsWith(IMG_PROXY);
}

function getIpfsPath(url) {
  if (!url) return "";
  const s = String(url).trim();

  if (s.startsWith("ipfs://")) {
    let p = s.slice("ipfs://".length);
    p = p.replace(/^ipfs\//, "");
    return p.replace(/^\/+/, "");
  }

  try {
    const u = new URL(s);
    const idx = u.pathname.indexOf("/ipfs/");
    if (idx !== -1) {
      return u.pathname.slice(idx + "/ipfs/".length).replace(/^\/+/, "");
    }
  } catch (e) {}

  return "";
}

function normalizeImageUrl(url) {
  if (!url) return "";
  if (isAlreadyProxied(url)) return url;

  const ipfsPath = getIpfsPath(url);
  if (ipfsPath) return "https://nftstorage.link/ipfs/" + ipfsPath;

  try {
    const u = new URL(String(url));
    return u.toString();
  } catch (e) {
    return String(url);
  }
}

function safeProxyUrl(src) {
  if (!src) return "";
  if (!IMG_PROXY) return normalizeImageUrl(src); // ✅ if config not loaded yet, don't crash
  if (isAlreadyProxied(src)) return src;

  const direct = normalizeImageUrl(src);
  if (isAlreadyProxied(direct)) return direct;

  return IMG_PROXY + encodeURIComponent(direct);
}

function gridProxyUrl(src) {
  const prox = safeProxyUrl(src);
  return prox + (prox.includes("?") ? "&" : "?") + "b=" + BUILD_ID;
}

function exportProxyUrl(src) {
  return safeProxyUrl(src);
}

// ---------- Watermark helpers (DOM + Export) ----------
function syncWatermarkDOMToOneTile() {
  const wm = document.getElementById("wmGrid"); // <img>
  const grid = document.getElementById("grid");
  if (!wm || !grid) return;

  const firstTile = grid.querySelector(".tile");
  if (!firstTile) {
    wm.style.display = "none";
    return;
  }

  const gridWrap = grid.parentElement; // .gridWrap
  if (wm.parentElement !== gridWrap) gridWrap.appendChild(wm);

  wm.style.display = "block";
  wm.style.position = "absolute";
  wm.style.left = "0px";
  wm.style.top = "0px";
  wm.style.zIndex = "9999";
  wm.style.pointerEvents = "none";

  const tileW = firstTile.getBoundingClientRect().width || 0;
  const w = Math.max(40, Math.floor(tileW));
  wm.style.width = w + "px";
  wm.style.height = "auto";
}

// ---------- Wallet list ----------
function normalizeWallet(w) {
  return (w || "").trim().replace(/\s+/g, "").toLowerCase();
}

function addWallet() {
  const input = $("walletInput");
  const w = normalizeWallet(input ? input.value : "");

  if (!w) return setStatus("👋 Paste a wallet address first.");
  if (!/^0x[a-f0-9]{40}$/.test(w))
    return setStatus("That doesn’t look like a valid 0x wallet address.");
  if (state.wallets.includes(w)) return setStatus("Already got that one!");

  state.wallets.push(w);

  if (input) {
    input.value = "";
    input.blur();
  }

  renderWalletList();
  syncWalletHeader();
  enableButtons();
  updateGuideGlow();
  setStatus(`✅ Nice! Wallet added (${state.wallets.length} total)`);
}

function removeWallet(w) {
  state.wallets = state.wallets.filter((x) => x !== w);
  renderWalletList();
  syncWalletHeader();
  enableButtons();
  updateGuideGlow();
    setStatus(`Bye bye wallet — ${state.wallets.length} remaining`);
}

function renderWalletList() {
  const wrap = $("walletList");
  if (!wrap) return;

  if (!state.wallets.length) {
    wrap.style.display = "none";
    wrap.innerHTML = "";
    return;
  }

  wrap.style.display = "";
  wrap.innerHTML = "";

  state.wallets.forEach((w) => {
    const row = document.createElement("div");
    row.className = "walletChip";

    const left = document.createElement("div");
    left.style.minWidth = "0";

    const addr = document.createElement("div");
    addr.className = "walletAddr";
    addr.textContent = w;

    const meta = document.createElement("div");
    meta.className = "walletMeta";
    meta.textContent = "Ready to load";

    left.appendChild(addr);
    left.appendChild(meta);

    const btns = document.createElement("div");
    btns.className = "chipBtns";

    const rm = document.createElement("button");
    rm.className = "btnSmall";
    rm.type = "button";
    rm.textContent = "🗑 Remove";
    rm.addEventListener("click", () => removeWallet(w));

    btns.appendChild(rm);

    row.appendChild(left);
    row.appendChild(btns);
    wrap.appendChild(row);
  });
}

// ---------- Collections ----------
function renderCollectionsList() {
  const wrap = $("collectionsList");
  if (!wrap) return;

  wrap.innerHTML = "";

  state.collections.forEach((c) => {
    const row = document.createElement("div");
    row.className = "collectionItem";
    if (state.selectedKeys.has(c.key)) row.classList.add("selected");

    row.addEventListener("click", () => {
      if (state.selectedKeys.has(c.key)) {
        state.selectedKeys.delete(c.key);
        row.classList.remove("selected");
      } else {
        state.selectedKeys.add(c.key);
        row.classList.add("selected");
      }

      const buildBtn = $("gridBuildBtn");
      const exportBtn = $("gridExportBtn");
      if (buildBtn) buildBtn.disabled = state.selectedKeys.size === 0;
      if (exportBtn) exportBtn.disabled = true;
      syncGridFooterButtons(state.selectedKeys.size === 0, true);

      renderTraitFiltersForSelected();
      updateGuideGlow();
    });

    const label = document.createElement("div");
    label.style.minWidth = "0";

    const count = (c.count ?? c.nfts?.length ?? 0);
    const displayName = shortenForDisplay(c.name) || "Unknown Collection";
    const labelText = `${displayName} (${count} owned)`;

    const name = document.createElement("div");
    name.className = "collectionName";
    name.textContent = labelText;

    label.appendChild(name);
    row.appendChild(label);
    wrap.appendChild(row);
  });

  renderTraitFiltersForSelected();
}

function setAllCollections(checked) {
  state.selectedKeys.clear();
  if (checked) state.collections.forEach((c) => state.selectedKeys.add(c.key));
  renderCollectionsList();

  const buildBtn = $("gridBuildBtn");
  const exportBtn = $("gridExportBtn");
  if (buildBtn) buildBtn.disabled = state.selectedKeys.size === 0;
  if (exportBtn) exportBtn.disabled = true;
  syncGridFooterButtons(state.selectedKeys.size === 0, true);

  updateGuideGlow();
}

function getSelectedCollections() {
  return state.collections.filter((c) => state.selectedKeys.has(c.key));
}

/** Build traitsByCollection: { [key]: { "Hat": { "Crown": 5, "Beanie": 3 }, ... } } */
function buildTraitsByCollection(collection) {
  const traits = {};
  const nfts = collection.nfts || [];
  for (const nft of nfts) {
    const attrs = getNFTAttributes(nft);
    for (const a of attrs) {
      const tt = (a?.trait_type || a?.traitType || a?.type || "").toString().trim();
      const val = String(a?.value ?? a?.trait_value ?? a?.display_value ?? "").trim();
      if (!tt) continue;
      if (!traits[tt]) traits[tt] = {};
      traits[tt][val] = (traits[tt][val] || 0) + 1;
    }
  }
  return traits;
}

/** Update trait sort state when dropdown changes. Triggers Build Grid glow until rebuilt. */
function onTraitChange(collectionKey, trait) {
  state.selectedSortByCollection[collectionKey] = trait;
  setBuildGridNeedsRebuild(true);
}

function setBuildGridNeedsRebuild(needs) {
  state.buildGridNeedsRebuild = !!needs;
  const btn = $("gridBuildBtn");
  if (!btn) return;
  if (needs) btn.classList.add("buildGridGlow");
  else btn.classList.remove("buildGridGlow");
}

/** Re-render grid using already-loaded NFTs. Instantly reorders when trait changes. */
function updateGrid() {
  const grid = $("grid");
  const nftTileCount = grid ? Array.from(grid.children).filter((c) => c.classList.contains("tile") && (c.dataset.kind === "nft" || c.dataset.kind === "missing")).length : 0;
  const chosen = getSelectedCollections();
  if (!chosen.length) return;
  if (nftTileCount > 0) {
    reorderGrid();
  } else {
    buildGrid();
  }
}

/** Render per-collection trait sort dropdown (one per collection, trait type only). */
function renderTraitFiltersForSelected() {
  const container = document.getElementById("collectionTraitControls");
  if (!container) return;

  const chosen = getSelectedCollections();
  container.innerHTML = "";

  if (!chosen.length) return;

  chosen.forEach((c) => {
    const traitsByType = buildTraitsByCollection(c);
    const traitTypes = Object.keys(traitsByType).sort();

    const block = document.createElement("div");
    block.className = "collection-trait-control";

    const nameEl = document.createElement("div");
    nameEl.className = "collection-name";
    nameEl.textContent = shortenForDisplay(c.name) || "Collection";

    const select = document.createElement("select");
    select.className = "input trait-type";
    select.dataset.key = c.key;

    const toTitleCase = (s) =>
      !s ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const options = [
      { value: "", label: "Original" },
      ...traitTypes.map((t) => ({ value: t, label: toTitleCase(t) })),
    ];
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });

    const selectedTrait = state.selectedSortByCollection[c.key] || "";
    select.value = selectedTrait;

    block.appendChild(nameEl);
    block.appendChild(select);
    container.appendChild(block);
  });
}

/** Get attributes array from NFT (handles multiple metadata structures). */
function getNFTAttributes(nft) {
  const attrs =
    nft?.rawMetadata?.attributes ||
    nft?.rawMetadata?.metadata?.attributes ||
    nft?.metadata?.attributes ||
    nft?.contractMetadata?.openSea?.traits ||
    [];
  if (Array.isArray(attrs)) return attrs;
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
    return Object.entries(attrs).map(([k, v]) => ({ trait_type: k, value: v }));
  }
  return [];
}

/** Trait name variants for fuzzy matching (e.g. BG → Background). */
const TRAIT_VARIANTS = {
  bg: ["bg", "background", "backgrounds", "back", "background color", "base"],
  background: ["background", "backgrounds", "bg", "back", "background color", "base"],
  backgrounds: ["backgrounds", "background", "bg", "back", "background color", "base"],
  "background color": ["background color", "background", "backgrounds", "bg"],
  base: ["base", "background", "backgrounds", "bg"],
};

const BACKGROUND_TRAIT_PRIORITY = ["background", "backgrounds", "bg", "background color", "base", "back"];

/** Find the background trait type for a collection (for default sort on first build). */
function getDefaultBackgroundTrait(traitTypes) {
  const lower = (traitTypes || []).map((t) => String(t).trim().toLowerCase());
  for (const want of BACKGROUND_TRAIT_PRIORITY) {
    const idx = lower.findIndex((t) => t === want || t.includes(want));
    if (idx >= 0) return traitTypes[idx];
  }
  return "";
}

function getTraitMatchNames(selectedTrait) {
  const norm = String(selectedTrait || "").trim().toLowerCase();
  if (!norm) return [];
  if (TRAIT_VARIANTS[norm]) return TRAIT_VARIANTS[norm];
  return [norm];
}

function sortCollection(nfts, trait) {
  if (!trait || !nfts?.length) return nfts || [];

  const matchNames = getTraitMatchNames(trait);
  return [...nfts].sort((a, b) => {
    const getVal = (nft) => {
      const list = getNFTAttributes(nft);
      for (const x of list) {
        const tt = (x?.trait_type || x?.traitType || x?.type || "").toString().trim().toLowerCase();
        if (matchNames.includes(tt)) {
          const val = x?.value ?? x?.trait_value ?? x?.display_value ?? "";
          return String(val).trim();
        }
      }
      return "";
    };
    const aVal = getVal(a);
    const bVal = getVal(b);
    return aVal.toLowerCase().localeCompare(bVal.toLowerCase(), undefined, { sensitivity: "base" });
  });
}

/** Apply per-collection trait sorting. Returns flat array of grid items.
 *  IMPORTANT: Each collection stays in its own block — never interleaved. */
function getSortedItemsForGrid(selectedCollections) {
  const all = [];
  for (const collection of selectedCollections) {
    const trait = state.selectedSortByCollection[collection.key] || "";
    const sorted = sortCollection(collection.nfts || [], trait);
    for (const nft of sorted) {
      const item = nftToGridItem(nft, collection.key);
      all.push(item);
    }
  }
  return all;
}

/** Fallback: fetch NFTs from Zora API when Alchemy returns nothing (e.g. OGenie) */
async function fetchNFTsFromZora({ wallet, contractAddress }) {
  const query = `query($owner: String!, $contract: String!, $after: String) {
    tokens(
      networks: [{network: ETHEREUM, chain: MAINNET}]
      pagination: {limit: 100, after: $after}
      where: {ownerAddresses: [$owner], collectionAddresses: [$contract]}
    ) {
      nodes {
        token {
          collectionAddress
          tokenId
          name
          image { url }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const all = [];
  let after = null;
  for (let page = 0; page < 25; page++) {
    const res = await fetch("https://api.zora.co/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { owner: wallet, contract: contractAddress, after },
      }),
    });
    if (!res.ok) break;
    const json = await res.json().catch(() => ({}));
    const nodes = json?.data?.tokens?.nodes ?? [];
    for (const n of nodes) {
      const t = n?.token;
      if (!t?.tokenId) continue;
      const img = t?.image;
      const imgUrl = typeof img === "object" && img ? img?.url : null;
      all.push({
        contract: { address: (t.collectionAddress || contractAddress).toLowerCase(), name: "" },
        contractAddress: (t.collectionAddress || contractAddress).toLowerCase(),
        tokenId: String(t.tokenId),
        name: t?.name || `#${t.tokenId}`,
        image: imgUrl ? { cachedUrl: imgUrl, originalUrl: imgUrl } : null,
      });
    }
    const hasNext = json?.data?.tokens?.pageInfo?.hasNextPage;
    if (!hasNext) break;
    after = json?.data?.tokens?.pageInfo?.endCursor;
  }
  return all;
}

/** Add a collection by contract address (for collections Alchemy's discovery misses, e.g. OGenie) */
async function addCollectionByContract(contractInput) {
  const addr = (contractInput || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    const statusEl = $("addContractStatus");
    if (statusEl) statusEl.textContent = "Enter a valid contract address (0x + 40 hex chars)";
    return;
  }

  const normAddr = addr.toLowerCase();
  const statusEl = $("addContractStatus");
  const setAddStatus = (msg) => { if (statusEl) statusEl.textContent = msg || ""; };

  if (!state.wallets?.length) {
    setAddStatus("Load wallets first, then add a collection.");
    return;
  }
  if (!configLoaded) {
    setAddStatus("Configuration not loaded.");
    return;
  }

  try {
    setAddStatus("Fetching…");
    let allNfts = [];
    const chain = state.chain || "eth";
    for (const wallet of state.wallets) {
      const url = `${WORKER_BASE}/api/nfts?owner=${encodeURIComponent(wallet)}&chain=${chain}&contractAddresses=${encodeURIComponent(normAddr)}`;
      const res = await fetch(url).catch(() => null);
      const json = res?.ok ? await res.json().catch(() => ({})) : {};
      const nfts = json.nfts || [];
      allNfts.push(...nfts);
    }

    if (allNfts.length === 0 && (state.chain === "eth" || state.host?.includes("eth"))) {
      setAddStatus("Trying Zora…");
      for (const wallet of state.wallets) {
        const nfts = await fetchNFTsFromZora({ wallet, contractAddress: normAddr }).catch(() => []);
        allNfts.push(...nfts);
      }
    }

    if (allNfts.length === 0) {
      setAddStatus("No NFTs found for this contract in your wallet(s). Try another chain or contract.");
      return;
    }

    const validNfts = allNfts.filter((n) => n && typeof n === "object");
    const normalized = validNfts.map(normalizeNFT);
    const deduped = dedupeNFTs(normalized);
    const expanded = expandNFTs(deduped);
    const newGrouped = groupByCollection(expanded);
    const newCol = newGrouped.find((c) => c.key === normAddr) || newGrouped[0];

    if (!newCol) {
      setAddStatus("Could not parse collection.");
      return;
    }

    state.collections = state.collections || [];
    const existing = state.collections.find((c) => c.key === normAddr);
    if (existing) {
      const nftKey = (n) =>
        n?._instanceId ||
        `${(n?.contract?.address || n?.collection?.address || n?.contractAddress || "").toString().toLowerCase()}:${(n?.tokenId ?? n?.token_id ?? n?.id ?? "").toString()}`;
      const seen = new Set(existing.nfts.map(nftKey));
      for (const nft of newCol.nfts) {
        const k = nftKey(nft);
        if (!seen.has(k)) {
          seen.add(k);
          existing.nfts.push(nft);
        }
      }
      existing.count = existing.nfts.length;
    } else {
      state.collections.push(newCol);
      state.collections.sort((a, b) => (b.nfts?.length ?? 0) - (a.nfts?.length ?? 0));
    }

    renderCollectionsList();
    setAddStatus(`Added ${newCol.name}: ${newCol.count} NFT(s) ✅`);
    const inputEl = $("addContractInput");
    if (inputEl) inputEl.value = "";
  } catch (err) {
    setAddStatus("Error: " + (err?.message || "Could not add collection."));
    addError(err, "Add Collection by Contract");
  }
}

// ---------- Grid helpers ----------
function flattenItems(chosen) {
  return getSortedItemsForGrid(chosen);
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// ==========================
// Trait Group Sort (instant reorder)
// ==========================
state.currentGridItems = [];

function getGridChoice() {
  const v = $("gridSize")?.value || "auto";

  if (v === "custom") {
    const cols = clampInt($("customCols")?.value, 2, 50, 6);
    const rows = clampInt($("customRows")?.value, 2, 50, 6);
    const cap = rows * cols;
    return { mode: "fixed", cap, rows, cols };
  }

  if (v === "auto") return { mode: "auto" };

  const cap = Math.max(1, Number(v));
  const side = Math.round(Math.sqrt(cap));
  return { mode: "fixed", cap, rows: side, cols: side };
}

// ---------- Build grid ----------
function buildGrid() {
  gridImgLimit = createLimiter(3);
  BUILD_ID = Date.now();

  state.imageLoadState = {
    total: 0,
    loaded: 0,
    failed: 0,
    retrying: 0,
  };

  const chosen = getSelectedCollections();
  const exportBtn = $("gridExportBtn");

  const gridInputNfts = chosen.flatMap((c) => c.nfts || []);
  console.log("GRID INPUT NFT COUNT", gridInputNfts.length);

  if (!chosen.length) {
    setStatus("🎯 Pick at least one collection to build your grid!");
    if (exportBtn) exportBtn.disabled = true;
    syncGridFooterButtons(true, true);
    return;
  }

  for (const c of chosen) {
    if (!state.selectedSortByCollection[c.key]) {
      const traitsByType = buildTraitsByCollection(c);
      const traitTypes = Object.keys(traitsByType);
      const bgTrait = getDefaultBackgroundTrait(traitTypes);
      if (bgTrait) state.selectedSortByCollection[c.key] = bgTrait;
    }
  }

  let items = flattenItems(chosen);

  const HARD_CAP = 400;
  if (items.length > HARD_CAP) items = items.slice(0, HARD_CAP);

  const choice = getGridChoice();

  let rows, cols, totalSlots, usedItems;

  if (choice.mode === "fixed") {
    rows = choice.rows;
    cols = choice.cols;
    totalSlots = choice.cap;
    usedItems = items.slice(0, totalSlots);
  } else {
    // ✅ Auto = closest square n×n
    const side = Math.ceil(Math.sqrt(items.length));
    rows = side;
    cols = side;
    totalSlots = rows * cols;
    usedItems = items;
  }

  state.currentGridItems = usedItems.slice();

  setGridColumns(cols);

  const grid = $("grid");
  if (!grid) return;
  const oldBar = document.getElementById("traitBar");
  if (oldBar) oldBar.remove();
  renderTraitFiltersForSelected();
  grid.innerHTML = "";

  const stageTitle = $("stageTitle");
  const stageMeta = $("stageMeta");

  if (stageTitle) {
    stageTitle.innerHTML =
      `Little Ollie Flex Grid <span class="titleHint">Edit size • Drag to reorder</span>`;
  }

  if (stageMeta) {
    stageMeta.textContent =
      `${state.wallets.length} wallet(s) • ${chosen.length} collection(s) • ${usedItems.length} NFT(s) • grid ${rows}×${cols}`;
  }

  const nftsWithImages = usedItems.filter((item) => item?.image);
  state.imageLoadState.total = nftsWithImages.length;
  const noImageCount = usedItems.length - nftsWithImages.length;
  if (noImageCount > 0) {
    console.log(`buildGrid: ${noImageCount} tile(s) have no image (using placeholder)`);
  }

  for (let i = 0; i < usedItems.length; i++) grid.appendChild(makeNFTTile(usedItems[i]));
  const remaining = totalSlots - usedItems.length;
  for (let j = 0; j < remaining; j++) grid.appendChild(makeFillerTile());

  const wm = $("wmGrid");
  if (wm) wm.style.display = "block";

  requestAnimationFrame(syncWatermarkDOMToOneTile);

  if (exportBtn) exportBtn.disabled = false;
  syncGridFooterButtons(false, false);

  if (state.imageLoadState.total > 0) updateImageProgress();
  else setStatus("🔥 Your grid is ready! (drag tiles to reorder on desktop)");

  enableDragDrop();
  updateGuideGlow();
  setBuildGridNeedsRebuild(false);

  state.collectionsCollapsed = true;
  collapseCollectionsSection();
}

/** Compute canonical key for item/tile matching. Must match makeNFTTile's dataset.key logic. */
function getGridItemKey(it) {
  if (!it) return "";
  if (it._instanceId) return String(it._instanceId);
  const contract = String(it?.contract || it?.contractAddress || "").trim().toLowerCase();
  const tokenId = String(it?.tokenId ?? "").trim();
  return contract && tokenId ? `${contract}:${tokenId}` : "";
}

/** Reorder grid tiles to match sorted items. Preserves existing DOM nodes (no image reload). */
function reorderGrid() {
  const chosen = getSelectedCollections();
  if (!chosen.length) return;

  let items = getSortedItemsForGrid(chosen);
  const HARD_CAP = 400;
  if (items.length > HARD_CAP) items = items.slice(0, HARD_CAP);

  const choice = getGridChoice();
  let usedItems;
  if (choice.mode === "fixed") {
    usedItems = items.slice(0, choice.cap);
  } else {
    const side = Math.ceil(Math.sqrt(items.length));
    usedItems = items;
  }

  state.currentGridItems = usedItems.slice();

  const grid = $("grid");
  if (!grid) return;

  const tiles = Array.from(grid.children).filter((t) => t.classList.contains("tile"));
  const nftTiles = tiles.filter((t) => t.dataset.kind === "nft" || t.dataset.kind === "missing");
  const fillerTiles = tiles.filter((t) => t.dataset.kind === "empty");

  const keyToTile = new Map();
  const usedKeys = new Set();
  const collKeyNorm = (s) => String(s || "").trim().toLowerCase();

  nftTiles.forEach((t) => {
    const collKey = collKeyNorm(t.dataset.collectionKey);
    const k = (t.dataset.key || "").trim();
    if (!k) return;
    const composite = `${collKey}::${k}`;
    keyToTile.set(composite, t);
    if (!collKey) {
      keyToTile.set(k, t);
      const alt = (t.dataset.contract && t.dataset.tokenId)
        ? `${String(t.dataset.contract).toLowerCase()}:${String(t.dataset.tokenId).trim()}`
        : "";
      if (alt && alt !== k && !usedKeys.has(alt)) {
        usedKeys.add(alt);
        keyToTile.set(alt, t);
      }
    }
  });

  const usedTiles = new Set();
  for (const it of usedItems) {
    const itemKey = getGridItemKey(it);
    const collKey = collKeyNorm(it?.sourceKey);
    let t = keyToTile.get(`${collKey}::${itemKey}`);
    if (!t) t = keyToTile.get(itemKey);
    if (t && !usedTiles.has(t)) {
      usedTiles.add(t);
      grid.appendChild(t);
    }
  }
  fillerTiles.forEach((t) => grid.appendChild(t));
}

// ---------- Image loading + fallbacks ----------
const MISSING_GRACE_MS = 8000;  // shorter grace before marking missing

function makeFillerInner() {
  const d = document.createElement("div");
  d.className = "fillerText";
  d.textContent = ""; // ✅ no LO text
  d.setAttribute("aria-hidden", "true");
  return d;
}

function markMissing(tile, img, rawUrl) {
  try {
    if (img && img.parentNode) img.remove();
  } catch (e) {}

  tile.dataset.kind = "missing";
  tile.classList.remove("isLoaded");
  tile.classList.add("isMissing");
  tile.dataset.rawUrl = rawUrl || tile.dataset.rawUrl || "";

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    console.warn("❌ Tile missing", {
      contract: tile.dataset.contract,
      tokenId: tile.dataset.tokenId,
      src: tile.dataset.src || "",
      rawUrl,
      ipfsPath: tile.dataset.ipfsPath,
    });
  }
}

async function retryMissingTiles() {
  const grid = $("grid");
  if (!grid) return;
  const missing = Array.from(grid.querySelectorAll(".tile.isMissing"));
  if (missing.length === 0) {
    setStatus("✅ All good — no missing tiles to retry!");
    return;
  }
    setStatus(`🔄 Retrying ${missing.length} missing image(s)…`);
  const tasks = missing.map((tile) => {
    const rawUrl = tile.dataset.rawUrl;
    if (!rawUrl) return Promise.resolve();
    tile.classList.remove("isMissing");
    tile.dataset.alchemyTried = "0";
    tile.dataset.retryCount = "0";
    tile.dataset.loadStartedAt = String(Date.now());
    const img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.crossOrigin = "anonymous";
    tile.appendChild(img);
    return loadTileImage(tile, img, rawUrl, 1).catch(() => {});
  });
  await Promise.all(tasks);
  const stillMissing = grid.querySelectorAll(".tile.isMissing").length;
  setStatus(stillMissing > 0 ? `😕 ${stillMissing} still failed` : "✅ Retry complete!");
  updateImageProgress();
}

async function fetchBestAlchemyImage({ contract, tokenId }) {
  const url = `${WORKER_BASE}/api/nft-metadata?contract=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(tokenId)}&chain=${state.chain || "eth"}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Metadata ${res.status}`);
  const meta = await res.json();
  if (meta?.error) throw new Error(meta.error);

  const image =
    meta?.image?.cachedUrl ||
    meta?.image?.pngUrl ||
    meta?.image?.thumbnailUrl ||
    meta?.image?.originalUrl ||
    meta?.rawMetadata?.image ||
    "";

  return image ? normalizeImageUrl(image) : "";
}

async function loadTileImage(tile, img, rawUrl, retryAttempt = 0) {
  const contract = tile.dataset.contract || "";
  const tokenId = tile.dataset.tokenId || "";

  const ipfsPath = getIpfsPath(rawUrl);
  tile.dataset.ipfsPath = ipfsPath || "";

  const directNormalized = normalizeImageUrl(rawUrl);
  if (!directNormalized) {
    markMissing(tile, img, rawUrl);
    state.imageLoadState.failed++;
    updateImageProgress();
    return false;
  }

  const primary = ipfsPath ? "ipfs://" + ipfsPath : directNormalized;
  tile.dataset.src = primary;

  // Strategy 1: Alchemy cached URL (proxy first) — only for valid contract addresses
  if (contract && tokenId && tokenId !== "null" && /^0x[a-f0-9]{40}$/i.test(contract) && tile.dataset.alchemyTried !== "1") {
    tile.dataset.alchemyTried = "1";
    try {
      const metaUrl = await fetchBestAlchemyImage({ contract, tokenId });
      if (metaUrl && metaUrl !== primary) {
        try {
          setImgCORS(img, true);
          await loadImgWithLimiter(img, gridProxyUrl(metaUrl), IMG_LOAD.gridTimeoutMs);
          state.imageLoadState.loaded++;
          updateImageProgress();
          tile.dataset.kind = "loaded";
          tile.classList.remove("isMissing");
          tile.classList.add("isLoaded");
          tile.dataset.src = metaUrl;
          return true;
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Strategy 2: Worker proxy (primary)
  try {
    setImgCORS(img, true);
    await loadImgWithLimiter(img, gridProxyUrl(primary), IMG_LOAD.gridTimeoutMs);
    state.imageLoadState.loaded++;
    updateImageProgress();
    tile.dataset.kind = "loaded";
    tile.classList.remove("isMissing");
    tile.classList.add("isLoaded");
    return true;
  } catch (e1) {
    // Strategy 3: Retry primary via Worker proxy (non-IPFS direct URLs)
    if (!ipfsPath && /^https?:\/\//i.test(primary)) {
      try {
        setImgCORS(img, true);
        await loadImgNoLimit(img, gridProxyUrl(primary), IMG_LOAD.gridDirectTimeoutMs);
        state.imageLoadState.loaded++;
        updateImageProgress();
        tile.dataset.kind = "loaded";
        tile.classList.remove("isMissing");
        tile.classList.add("isLoaded");
        return true;
      } catch (_) {
        // continue
      }
    }

    // Strategy 4: IPFS gateways (via Worker proxy)
    if (ipfsPath) {
      const candidates = IPFS_GATEWAYS.map((g) => g + ipfsPath);

      for (const gatewayUrl of candidates) {
        for (let attempt = 0; attempt <= IMG_LOAD.retriesPerCandidate; attempt++) {
          try {
            setImgCORS(img, true);
            await loadImgWithLimiter(img, gridProxyUrl(gatewayUrl), IMG_LOAD.gridTimeoutMs);
            state.imageLoadState.loaded++;
            updateImageProgress();
            tile.dataset.kind = "loaded";
            tile.classList.remove("isMissing");
            tile.classList.add("isLoaded");
            tile.dataset.src = gatewayUrl;
            return true;
          } catch (_) {
            if (attempt < IMG_LOAD.retriesPerCandidate) {
              await new Promise((r) => setTimeout(r, IMG_LOAD.backoffMs));
            }
          }
        }
      }
    }

    // Grace period before Missing
    const startedAt = Number(tile.dataset.loadStartedAt || Date.now());
    const elapsed = Date.now() - startedAt;

    if (elapsed < MISSING_GRACE_MS) {
      const waitMs = MISSING_GRACE_MS - elapsed;
      state.imageLoadState.retrying++;
      updateImageProgress();

      await new Promise((r) => setTimeout(r, waitMs));

      state.imageLoadState.retrying = Math.max(0, state.imageLoadState.retrying - 1);
      updateImageProgress();

      try {
        setImgCORS(img, true);
        await loadImgWithLimiter(img, gridProxyUrl(primary), IMG_LOAD.gridTimeoutMs);
        state.imageLoadState.loaded++;
        updateImageProgress();
        tile.dataset.kind = "loaded";
        tile.classList.remove("isMissing");
        tile.classList.add("isLoaded");
        return true;
      } catch (_) {}
    }

    markMissing(tile, img, rawUrl);
    state.imageLoadState.failed++;
    updateImageProgress();

    if (retryAttempt === 0) {
      addError(new Error(`Failed to load image: ${String(rawUrl).substring(0, 100)}`), "Image Loading");
    }

    return false;
  }
}

function makeNFTTile(it) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.classList.remove("isLoaded", "isMissing");
  tile.draggable = true;

  const contract = (it?.contract || it?.contractAddress || it?.sourceKey || "").toString().trim().toLowerCase();
  const tokenId = (it?.tokenId ?? "").toString().trim();
  tile.dataset.contract = contract;
  tile.dataset.tokenId = tokenId;
  tile.dataset.collectionKey = (it?.sourceKey || "").toString().trim().toLowerCase();
  tile.dataset.key = getGridItemKey(it);

  const raw = it?.image || "";
  tile.dataset.kind = raw ? "nft" : "empty";
  tile.dataset.alchemyTried = "0";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = ""; // ✅ prevents filename/name text showing
  img.referrerPolicy = "no-referrer";
  img.crossOrigin = "anonymous";

  if (raw) {
    tile.appendChild(img);
    tile.dataset.rawUrl = raw;
    tile.dataset.retryCount = "0";
    tile.dataset.loadStartedAt = String(Date.now());
    loadTileImage(tile, img, raw).catch(() => {});
  } else {
    tile.dataset.src = "";
    tile.dataset.kind = "empty";
    tile.appendChild(makeFillerInner());
  }

  return tile;
}

function makeFillerTile() {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.draggable = true;
  tile.dataset.src = "";
  tile.dataset.kind = "empty";
  tile.appendChild(makeFillerInner());
  return tile;
}

// ---------- Drag & drop ----------
function enableDragDrop() {
  const grid = $("grid");
  if (!grid) return;

  const tiles = Array.from(grid.querySelectorAll(".tile"));
  let dragEl = null;

  tiles.forEach((t) => {
    t.addEventListener("dragstart", (e) => {
      dragEl = t;
      t.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "tile");
    });

    t.addEventListener("dragend", () => {
      t.classList.remove("dragging");
      tiles.forEach((x) => x.classList.remove("dropTarget"));
      dragEl = null;
    });

    t.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragEl || dragEl === t) return;
      t.classList.add("dropTarget");
      e.dataTransfer.dropEffect = "move";
    });

    t.addEventListener("dragleave", () => t.classList.remove("dropTarget"));

    t.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragEl || dragEl === t) return;

      const a = dragEl;
      const b = t;

      const aNext = a.nextSibling === b ? a : a.nextSibling;
      grid.insertBefore(a, b);
      grid.insertBefore(b, aNext);

      tiles.forEach((x) => x.classList.remove("dropTarget"));
    });
  });
}

// ---------- Wallet load ----------
async function loadWallets() {
  const chain = $("chainSelect")?.value || "eth";

  if (chain === "solana") return setStatus("Solana coming soon. For now use ETH or Base.");
  if (chain === "apechain") return setStatus("ApeChain coming soon. For now use ETH or Base.");
  if (!state.wallets.length) return setStatus("👋 Add at least one wallet first!");

  if (!configLoaded) {
    return setStatus(
      "⚠️ Configuration not loaded. " +
        "Ensure the Worker config is available at " + WORKER_BASE + "/api/config/flex-grid"
    );
  }

  const host = ALCHEMY_HOST[chain];
  if (!host) return setStatus("Chain not configured.");

  state.chain = chain;
  state.host = host;

  try {
    showLoading("👀 Little Ollie is checking your wallet...", "", 0);
    setStatus(`Loading NFTs… (${state.wallets.length} wallet(s))`);

    const allNfts = [];
    for (let i = 0; i < state.wallets.length; i++) {
      const w = state.wallets[i];
      const walletPct = state.wallets.length > 0 ? Math.round((i / state.wallets.length) * 100) : 0;
      showLoading("🧺 Gathering your NFTs... This may take a minute.", `Wallet ${i + 1}/${state.wallets.length}`, walletPct);
      setStatus(`Gathering NFTs… wallet ${i + 1}/${state.wallets.length}. This may take a minute.`);
      const nfts = await fetchNFTsFromWorker({ wallet: w, chain });
      allNfts.push(...(nfts || []));
    }

    showLoading("🎨 Sorting your collections...", "", 85);
    console.log("RAW NFT COUNT (all wallets)", allNfts.length);
    console.log("RAW SAMPLE (all)", allNfts.slice(0, 10).map((nft) => ({
      contract: nft?.contract?.address,
      name: nft?.contract?.name || nft?.collection?.name,
      tokenType: nft?.tokenType || nft?.id?.tokenMetadata?.tokenType,
      balance: nft?.balance,
      tokenId: nft?.tokenId,
      idTokenId: nft?.id?.tokenId,
    })));
    const validNfts = allNfts.filter((n) => n && typeof n === "object");
    const normalized = validNfts.map(normalizeNFT);
    const deduped = dedupeNFTs(normalized);
    const expanded = expandNFTs(deduped);
    console.log("EXPANDED NFT COUNT", expanded.length);
    const grouped = groupByCollection(expanded);
    const displayedCount = grouped.reduce((s, c) => s + (c.nfts?.length ?? 0), 0);
    console.log(`NFT load complete: total ${allNfts.length} fetched → ${deduped.length} deduped → ${expanded.length} expanded → ${displayedCount} in ${grouped.length} collections`);

    showLoading("✨ Almost ready...", "", 100);
    state.collections = grouped;
    state.selectedKeys = new Set();

    renderCollectionsList();
    showControlsPanel(true);
    updateGuideGlow();

    const buildBtn = $("gridBuildBtn");
    const exportBtn = $("gridExportBtn");
    if (buildBtn) buildBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;

    const stageTitle = $("stageTitle");
    const stageMeta = $("stageMeta");
    if (stageTitle) stageTitle.textContent = "Wallets loaded";
    if (stageMeta) stageMeta.textContent = "Select collections, then 🧩 Build grid.";

    setStatus(grouped.length > 0
      ? `🎉 Boom! Loaded your wallets — ${grouped.length} collection(s) found`
      : `😅 Hmm... no NFTs found here`);
    showConnectionStatus(true);

    state.walletCollapsed = true;
    collapseWalletSection();

    await new Promise((r) => setTimeout(r, 400));
    hideLoading();
  } catch (err) {
    hideLoading();
    const errorMsg = err?.message || "Error loading NFTs.";
    setStatus(`❌ ${errorMsg} Please try again or check your wallet addresses.`);
    addError(err, "Load Wallets");
    showConnectionStatus(false);
  }
}

/** Shorten long address-like names for display (e.g. 0x3006b9de...ddfb) */
function shortenForDisplay(name) {
  if (typeof name !== "string" || !name) return name || "";
  const s = name.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return s.slice(0, 6) + "..." + s.slice(-4);
  return s;
}

/** Convert raw NFT to grid item format { contract, tokenId, image, name, attributes, sourceKey } */
function nftToGridItem(nft, sourceKey = "") {
  const contractAddr = (
    nft?._contractAddress ||
    nft?.contract?.address ||
    nft?.collection?.address ||
    nft?.contractAddress ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();
  const tokenId = (nft?._tokenId ?? nft?.tokenId ?? nft?.token_id ?? nft?.id?.tokenId ?? nft?.id ?? "").toString().trim();
  const safeTokenId = tokenId && tokenId !== "null" ? tokenId : "0";
  const image = extractImage(nft) || PLACEHOLDER_IMAGE;
  const name = nft?.name || (safeTokenId ? `#${safeTokenId}` : "NFT");
  const attributes =
    nft?.rawMetadata?.attributes ||
    nft?.rawMetadata?.metadata?.attributes ||
    nft?.metadata?.attributes ||
    nft?.contractMetadata?.openSea?.traits ||
    [];
  const item = {
    contract: contractAddr,
    tokenId: safeTokenId,
    image,
    name,
    attributes,
    sourceKey: sourceKey || contractAddr,
  };
  if (nft._instanceId) item._instanceId = nft._instanceId;
  return item;
}

/** Unique key for grouping NFTs. Uses address when present; otherwise derives from name so collections without address don't merge. */
function getCollectionKey(nft) {
  const addr = (
    nft?.contract?.address ||
    nft?.collection?.address ||
    nft?.contractAddress ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (addr) return addr;

  const colName = (
    nft?.contract?.name ||
    nft?.collection?.name ||
    nft?.title ||
    "Unknown Collection"
  )
    .toString()
    .trim();

  const slug = colName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    || "unknown";

  return `unknown_${slug}`;
}

function dedupeNFTs(nfts) {
  const seen = new Set();
  const out = [];
  let dupes = 0;
  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];
    if (!nft || typeof nft !== "object") continue;
    try {
      const collectionKey = nft._contractAddress || getCollectionKey(nft);
      const tokenId = nft._tokenId || (nft?.tokenId ?? nft?.token_id ?? nft?.id?.tokenId ?? nft?.id ?? `_${i}`).toString().trim();
      const safeTokenId = tokenId && tokenId !== "null" ? tokenId : `_${i}`;
      const key = `${collectionKey}:${safeTokenId}`;
      if (seen.has(key)) {
        dupes++;
        continue;
      }
      seen.add(key);
      out.push(nft);
    } catch (e) {
      console.warn("dedupeNFTs: error for NFT, including anyway", e?.message);
      out.push(nft);
    }
  }
  if (dupes > 0) console.log(`dedupeNFTs: ${nfts.length} → ${out.length} unique (${dupes} duplicates)`);
  return out;
}

async function fetchNFTsFromWorker({ wallet, chain }) {
  const chainParam = chain || "eth";
  const url = `${WORKER_BASE}/api/nfts?owner=${encodeURIComponent(wallet)}&chain=${chainParam}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `NFT fetch failed (${res.status})`);
  }
  const json = await res.json();
  const nfts = json.nfts || [];
  console.log("RAW NFT COUNT", nfts.length);
  console.log("RAW SAMPLE", nfts.slice(0, 10).map((nft) => ({
    contract: nft.contract?.address,
    name: nft.contract?.name || nft.collection?.name,
    tokenType: nft.tokenType || nft.id?.tokenMetadata?.tokenType,
    balance: nft.balance,
    tokenId: nft.tokenId,
    idTokenId: nft.id?.tokenId,
  })));
  return nfts;
}

const PLACEHOLDER_IMAGE = "";

/** Normalize NFT into consistent shape with _contractAddress, _tokenId, _tokenType, _balance */
function normalizeNFT(nft) {
  const _contractAddress = (nft.contract?.address || nft.collection?.address || nft.contractAddress || "")
    .toString().trim().toLowerCase() || "unknown";
  const _tokenId = (
    nft.tokenId ??
    nft.token_id ??
    (typeof nft.id === "object" && nft.id !== null ? nft.id?.tokenId : nft.id) ??
    "unknown"
  ).toString().trim();
  const _tokenType = String(nft.tokenType || nft.id?.tokenMetadata?.tokenType || "ERC721").toUpperCase();
  const _balance = Math.max(1, parseInt(nft.balance || "1", 10) || 1);
  return {
    ...nft,
    _contractAddress,
    _tokenId,
    _tokenType,
    _balance,
  };
}

/** Expand ERC1155 by _balance, add _instanceId to all */
function expandNFTs(nfts) {
  const out = [];
  for (const nft of nfts) {
    const addr = nft._contractAddress || (nft.contract?.address || nft.contractAddress || "").toString().toLowerCase();
    const tokenId = nft._tokenId || (nft.tokenId ?? nft.token_id ?? nft.id?.tokenId ?? "").toString();
    const tokenType = String(nft._tokenType || nft.tokenType || "ERC721").toUpperCase();

    if (tokenType === "ERC1155") {
      const balance = nft._balance || Math.max(1, parseInt(nft.balance || "1", 10) || 1);
      for (let i = 0; i < balance; i++) {
        out.push({ ...nft, _instanceId: `${addr}_${tokenId}_${i}` });
      }
    } else {
      out.push({ ...nft, _instanceId: `${addr}_${tokenId}` });
    }
  }
  return out;
}

function extractImage(nft) {
  const candidates = [
    nft?.media?.[0]?.gateway,
    nft?.media?.[0]?.raw,
    nft?.metadata?.image,
    nft?.metadata?.image_url,
    nft?.rawMetadata?.image,
    nft?.tokenUri?.gateway,
    nft?.image?.cachedUrl,
    nft?.image?.pngUrl,
    nft?.image?.thumbnailUrl,
    nft?.image?.originalUrl,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      let url = c.trim();
      if (url.startsWith("ipfs://")) {
        url = "https://nftstorage.link/ipfs/" + url.slice(7);
      }
      return url;
    }
  }
  return PLACEHOLDER_IMAGE;
}

function groupByCollection(nfts) {
  /** collections[key] = { key, name, nfts: [], count: 0 } — group by _contractAddress only */
  const collections = {};

  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];
    if (!nft || typeof nft !== "object") continue;

    const key = nft._contractAddress || (nft.contract?.address || nft.collection?.address || nft.contractAddress || "")
      .toString().trim().toLowerCase() || "unknown";

    if (!collections[key]) {
      collections[key] = {
        key,
        name:
          nft.contract?.name ||
          nft.collection?.name ||
          nft.contractMetadata?.name ||
          nft.contract?.address ||
          "Unknown Collection",
        nfts: [],
        count: 0,
      };
    }
    collections[key].nfts.push(nft);
  }

  Object.keys(collections).forEach((k) => {
    collections[k].count = collections[k].nfts.length;
  });

  const collectionList = Object.values(collections);
  const sorted = collectionList.sort((a, b) => b.count - a.count);

  console.log("COLLECTION COUNT", Object.keys(collections).length);
  Object.values(collections).slice(0, 20).forEach((c) => {
    console.log("COLLECTION", {
      key: c.key,
      name: c.name,
      count: c.count,
      sampleIds: c.nfts.slice(0, 5).map((n) => n._instanceId),
    });
  });

  return sorted;
}

// ---------- Export + helpers ----------
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function loadImageWithRetry(src, tries = 2, timeoutMs = 25000) {
  let lastErr = null;

  for (let i = 0; i < tries; i++) {
    try {
      const img = await Promise.race([
        loadImage(src),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Image load timeout")), timeoutMs)),
      ]);
      return img;
    } catch (e) {
      lastErr = e;
      await sleep(250 + i * 250);
    }
  }
  throw lastErr || new Error("Image failed: " + src);
}

function drawPlaceholder(ctx, x, y, w, h) {
  // Intentionally blank
}

// ✅ WKWebView-safe export handler + browser fallback
async function saveCanvasPNG(canvas, filename = "little-ollie-grid.jpg") {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

  // ✅ iOS Arcade: send to Swift via message handler
  if (window.webkit?.messageHandlers?.flexgrid) {
    window.webkit.messageHandlers.flexgrid.postMessage({
      type: "exportPNG",
      filename,
      dataUrl,
    });
    return;
  }

  // Browser fallback — JPG 0.95 keeps quality, much smaller than PNG
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));

  if (!blob) {
    if (isIOS()) {
      const win = window.open(dataUrl, "_blank");
      if (!win) alert("Popup blocked. Allow popups to save the image.");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  if (isIOS()) {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) alert("Popup blocked. Allow popups to save the image.");
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

function isImgUsable(img) {
  return img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
}

async function exportPNG() {
  try {
    setStatus("📸 Creating your masterpiece...");

    const tiles = [...document.querySelectorAll("#grid .tile")];
    if (!tiles.length) return setStatus("😅 Nothing to export yet — build a grid first!");

    const grid = $("grid");
    const cols = getComputedGridCols(grid);
    const rows = Math.ceil(tiles.length / cols);

    const rect = tiles[0].getBoundingClientRect();
    let tileSize = Math.round(rect.width);
    if (tileSize < 40) tileSize = 120;

    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(3, dpr * 2);

    const pad = 4;

    const outW = Math.round((cols * tileSize + pad * 2) * scale);
    const outH = Math.round((rows * tileSize + pad * 2) * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.imageSmoothingQuality = "high";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);

    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = tiles[i++];
        if (!tile) continue;

        const img = tile.querySelector("img");
        const x = pad + c * tileSize;
        const y = pad + r * tileSize;

        if (!isImgUsable(img)) {
          drawPlaceholder(ctx, x, y, tileSize, tileSize);
          continue;
        }

        try {
          ctx.drawImage(img, x, y, tileSize, tileSize);
        } catch (e) {
          drawPlaceholder(ctx, x, y, tileSize, tileSize);
        }
      }
    }

    // ✅ watermark image (pblo.png) inside first tile region
    try {
      const wmImg = await loadImageWithRetry("src/assets/images/pblo.png", 2, 8000);
      const x = pad;
      const y = pad;
      const w = tileSize;
      const ratio = wmImg.naturalHeight / wmImg.naturalWidth;
      const h = Math.round(w * ratio);
      ctx.drawImage(wmImg, x, y, w, h);
    } catch (e) {
      console.warn("Watermark PNG failed to load for export:", e);
    }

    await saveCanvasPNG(canvas, "lo-grid.jpg");

    setStatus("✨ Saved! Check your downloads");
    updateGuideGlow();
  } catch (err) {
    console.error(err);
    setStatus("😕 Oops, export failed. Try again?");
  }
}

function getComputedGridCols(gridEl) {
  if (!gridEl) return 1;
  const cs = window.getComputedStyle(gridEl);
  const tmpl = cs.gridTemplateColumns || "";

  const m = tmpl.match(/repeat\((\d+),/);
  if (m) return Math.max(1, parseInt(m[1], 10));

  const parts = tmpl.split(" ").filter(Boolean);
  return Math.max(1, parts.length);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------- Collapsible sections ----------
function collapseWalletSection() {
  state.walletCollapsed = true;
  const el = $("walletSection");
  if (el) el.classList.add("collapsed");
  syncWalletHeader();
}
function expandWalletSection() {
  state.walletCollapsed = false;
  const el = $("walletSection");
  if (el) el.classList.remove("collapsed");
  syncWalletHeader();
}
function toggleWalletSection() {
  state.walletCollapsed = !state.walletCollapsed;
  const el = $("walletSection");
  if (el) {
    if (state.walletCollapsed) el.classList.add("collapsed");
    else el.classList.remove("collapsed");
  }
  syncWalletHeader();
}
function syncWalletHeader() {
  const header = $("walletSectionHeader");
  if (!header) return;
  const n = state.wallets?.length ?? 0;
  const label = header.querySelector("span:first-child");
  if (label) label.textContent = n > 0 ? `Wallets (${n})` : "Wallets";
}

function collapseCollectionsSection() {
  state.collectionsCollapsed = true;
  const el = $("collectionsSection");
  if (el) el.classList.add("collapsed");
}
function expandCollectionsSection() {
  state.collectionsCollapsed = false;
  const el = $("collectionsSection");
  if (el) el.classList.remove("collapsed");
}
function toggleCollectionsSection() {
  state.collectionsCollapsed = !state.collectionsCollapsed;
  const el = $("collectionsSection");
  if (el) {
    if (state.collectionsCollapsed) el.classList.add("collapsed");
    else el.classList.remove("collapsed");
  }
}

function toggleTraitOrderSection() {
  state.traitOrderCollapsed = !state.traitOrderCollapsed;
  const el = $("traitOrderSection");
  if (el) {
    if (state.traitOrderCollapsed) el.classList.add("collapsed");
    else el.classList.remove("collapsed");
  }
}

// ---------- Events + Retry ----------
(function bindEvents() {
  const walletInput = $("walletInput");
  if (walletInput) {
    walletInput.autocapitalize = "none";
    walletInput.autocomplete = "off";
    walletInput.spellcheck = false;
    walletInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addWallet();
      }
    });
  }

  const addBtn = $("addWalletBtn");
  if (addBtn) {
    addBtn.type = "button";
    let lastFire = 0;

    const handler = (e) => {
      try { e.preventDefault(); } catch {}
      const now = Date.now();
      if (now - lastFire < 350) return;
      lastFire = now;
      addWallet();
    };

    if (window.PointerEvent) addBtn.addEventListener("pointerup", handler, { passive: false });
    else {
      addBtn.addEventListener("click", handler, { passive: false });
      addBtn.addEventListener("touchend", handler, { passive: false });
    }
  }

  const selectAllBtn = $("selectAllBtn");
  const selectNoneBtn = $("selectNoneBtn");
  if (selectAllBtn) selectAllBtn.addEventListener("click", () => setAllCollections(true));
  if (selectNoneBtn) selectNoneBtn.addEventListener("click", () => setAllCollections(false));

  const addContractBtn = $("addContractBtn");
  const addContractInput = $("addContractInput");
  if (addContractBtn && addContractInput) {
    addContractBtn.addEventListener("click", () => addCollectionByContract(addContractInput.value?.trim?.()));
    addContractInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCollectionByContract(addContractInput.value?.trim?.());
    });
  }

  const loadBtn = $("loadBtn");
  if (loadBtn) loadBtn.addEventListener("click", loadWallets);
  const gridBuildBtn = $("gridBuildBtn");
  const gridExportBtn = $("gridExportBtn");
  if (gridBuildBtn) gridBuildBtn.addEventListener("click", buildGrid);
  if (gridExportBtn) gridExportBtn.addEventListener("click", exportPNG);

  const retryBtn = $("retryBtn");
  if (retryBtn && typeof retryMissingTiles === "function") {
    retryBtn.addEventListener("click", retryMissingTiles);
  }

  const clearErrBtn = $("clearErrorLog");
  if (clearErrBtn) clearErrBtn.addEventListener("click", clearErrorLog);

  const traitControlsContainer = $("collectionTraitControls");
  if (traitControlsContainer) {
    traitControlsContainer.addEventListener("change", (e) => {
      const sel = e.target;
      if (sel && sel.matches && sel.matches("select.trait-type") && sel.dataset.key) {
        onTraitChange(sel.dataset.key, sel.value || "");
      }
    });
  }

  const walletHeader = $("walletSectionHeader");
  if (walletHeader) {
    walletHeader.addEventListener("click", toggleWalletSection);
    walletHeader.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleWalletSection(); }
    });
  }
  syncWalletHeader();

  const collectionsHeader = $("collectionsSectionHeader");
  if (collectionsHeader) {
    collectionsHeader.addEventListener("click", toggleCollectionsSection);
    collectionsHeader.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollectionsSection(); }
    });
  }

  const traitOrderHeader = $("traitOrderSectionHeader");
  if (traitOrderHeader) {
    traitOrderHeader.addEventListener("click", toggleTraitOrderSection);
    traitOrderHeader.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTraitOrderSection(); }
    });
  }

  window.addEventListener("resize", syncWatermarkDOMToOneTile);
  window.addEventListener("orientationchange", syncWatermarkDOMToOneTile);
})();

// Load configuration securely
async function initializeConfig() {
  try {
    const { loadConfig } = await import("./config.js");
    const config = await loadConfig();

    ALCHEMY_KEY = config.alchemyApiKey;
    IMG_PROXY = config.workerUrl;

    if (!ALCHEMY_KEY) {
      throw new Error("Unable to load configuration. No API key provided. Ensure your Worker supplies alchemyApiKey.");
    }
    configLoaded = true;

    if (window.location.hostname === "localhost") {
      console.log("Config loaded");
    }

    enableButtons();
    setStatus("Ready! ➕ Add wallet(s) → 🔍 Load → select collections → 🧩 Build → 📸 Export");
    showConnectionStatus(false);
    updateGuideGlow();
  } catch (error) {
    const statusEl = $("status");
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="color: #ff6b6b; font-weight: 900; margin-bottom: 8px;">
          ⚠️ Configuration Error
        </div>
      `;

      const msg = document.createElement("div");
      msg.style.marginBottom = "8px";
      msg.textContent = error.message;

      statusEl.appendChild(msg);

      const hint = document.createElement("div");
      hint.style.fontSize = "12px";
      hint.style.opacity = "0.9";
      hint.innerHTML = "See <strong>docs/FLEX_GRID_SETUP.md</strong> for setup instructions.";
      statusEl.appendChild(hint);
    }
    addError(error, "Config Loading");

    const loadBtn = $("loadBtn");
    const buildBtn = $("gridBuildBtn");
    const exportBtn = $("gridExportBtn");
    if (loadBtn) loadBtn.disabled = true;
    if (buildBtn) buildBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;
    syncGridFooterButtons(true, true);

    showConnectionStatus(false);
  }
}

initializeConfig();
enableButtons();
