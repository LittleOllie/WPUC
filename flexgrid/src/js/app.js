/* Little Ollie Flex Grid (SAFE export for file:// + Multi-Wallet)
   - GRID loads via Worker proxy — no direct IPFS (avoids CORS/rate limits)
   - SECURITY: API keys in Worker env only (see config.js)
*/
import {
  fetchNFTsFromWorker,
  fetchNFTsFromZora,
  fetchContractMetadataFromWorker,
  WORKER_BASE,
} from "./api.js";

const DEV = window.location.hostname === "localhost";
/** Max NFTs (including custom uploads) in one grid build / reorder. */
const FLEX_GRID_MAX_NFTS = 900;
const $ = (id) => document.getElementById(id);

function getGridPrimary() {
  return $("grid");
}

function getGridOverflow() {
  return $("gridOverflow");
}

/** Direct child .tile elements in primary + visible overflow grids. */
function queryAllGridTiles() {
  const tiles = [];
  const p = getGridPrimary();
  const o = getGridOverflow();
  if (p) {
    for (const ch of p.children) {
      if (ch.classList?.contains("tile")) tiles.push(ch);
    }
  }
  if (o && o.style.display !== "none") {
    for (const ch of o.children) {
      if (ch.classList?.contains("tile")) tiles.push(ch);
    }
  }
  return tiles;
}

// ---------- Step-based UI flow ----------
let currentStep = 1;

function goToStep(step) {
  currentStep = Math.max(1, Math.min(3, step));

  const wallets = $("screen-wallets");
  const collections = $("screen-collections");
  const grid = $("screen-grid");
  const gridStage = $("gridStageWrapper");

  if (wallets) wallets.style.display = currentStep === 1 ? "block" : "none";
  if (collections) collections.style.display = currentStep === 2 ? "block" : "none";
  if (grid) grid.style.display = currentStep === 3 ? "block" : "none";
  if (gridStage) gridStage.style.display = currentStep === 3 ? "block" : "none";

  // Step indicator
  document.querySelectorAll(".stepItem").forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.remove("active", "completed");
    if (s === currentStep) el.classList.add("active");
    else if (s < currentStep) el.classList.add("completed");
  });

  // Expand sections when entering their step
  const walletSection = $("walletSection");
  const collectionsSection = $("collectionsSection");
  const traitOrderSection = $("traitOrderSection");
  if (currentStep === 1 && walletSection) {
    walletSection.classList.remove("collapsed");
    state.walletCollapsed = false;
  }
  if (currentStep === 2 && collectionsSection) collectionsSection.classList.remove("collapsed");
  if (currentStep === 3 && traitOrderSection) traitOrderSection.classList.remove("collapsed");
  if (currentStep === 3) {
    syncLayoutPickerActiveStates();
    applySettingsToLiveGrids();
    syncStageCaptionOverlay();
  }

  updateGuideGlow();
}

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
  const controlsVisible = currentStep === 2;
  const hasOneOrMoreForBuild = hasItemsForBuild();

  const gridHasTiles = queryAllGridTiles().length > 0;
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

  // 3) Wallets loaded, no selection for build -> highlight collections area (panel + list)
  if (controlsVisible && !hasOneOrMoreForBuild) {
    setGuideGlow(["controlsPanel", "collectionsList"]);
    return;
  }

  // 4) At least one collection has NFTs selected for build -> highlight build
  if (hasOneOrMoreForBuild && !gridHasTiles) {
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
  /** Per collection: "all" | "manual" | "none" */
  selectionModeByCollection: {},
  /** Per collection: Set of stable NFT keys (see getNFTSelectionKey) when mode is "manual" */
  selectedNFTsByCollection: {},
  selectedSortByCollection: {},
  /** Contract keys: order of collection blocks left-to-right in the grid (drag trait-order rows to change). */
  gridCollectionOrder: [],
  wallets: [],
  chain: "eth",
  host: "eth-mainnet.g.alchemy.com",
  walletCollapsed: true,
  collectionsCollapsed: true,
  traitOrderCollapsed: true,
  /** Layout template id: "classic" | "hero" | "split" | "mixed" */
  selectedLayout: "classic",
  /** Set at build: { mode, layoutId?, columns?, rows?, totalSlots? } */
  gridLayoutMeta: null,
  /** Local uploads: { id, image: blobUrl, isCustom: true, name?, sourceKey } */
  customImages: [],
  /** Subset of customImages.id included in the next build */
  selectedCustomImageIds: new Set(),
  /** Collection contract keys whose collection logo is included first in that collection’s block in the grid */
  includeCollectionLogoInBuild: new Set(),
  /** In-memory cache: `${chain}::${contract}` → raw OpenSea logo URL or null */
  contractLogoCache: Object.create(null),
  /** Dedupe in-flight contract metadata fetches */
  contractLogoInflight: new Map(),
  /** Right drawer — open state only; panel DOM is separate */
  isSettingsOpen: false,
  /** "theme" | "light" | "dark" — stage preview behind grid */
  settingsCanvasBg: "theme",
  /** Grid gap: none keeps legacy 0 gap */
  settingsGridSpacing: "none",
  settingsTileBorder: false,
  settingsKeepGridSquare: true,
  /** When true, classic grid pads to a square (⌈√n⌉²); when false, minimum rectangle */
  settingsAutoFillEmpty: true,
  settingsTextShadow: true,
  /** Optional caption on stage (export still uses flat fill; caption is on-screen only unless we extend export later) */
  settingsStageCaption: "",
};
state.imageLoadState = { total: 0, loaded: 0, failed: 0, retrying: 0 };

const APP_SETTINGS_VERSION = "v2 Beta";

/** Same array reference as currentGridItems — manual drag order (updated on swap). */
state.orderedItems = [];

function syncOrderedItemsFromGrid() {
  state.orderedItems = state.currentGridItems;
}

function getSelectedCustomsForBuild() {
  const ids = state.selectedCustomImageIds;
  if (!ids?.size || !state.customImages?.length) return [];
  return state.customImages.filter((c) => ids.has(c.id));
}

function hasItemsForBuild() {
  syncSelectedKeysFromSelection();
  return state.selectedKeys.size > 0 || getSelectedCustomsForBuild().length > 0;
}

/** Sorted NFT grid items + selected custom images (NFTs first, then customs). */
function getMergedSortedGridItems() {
  const nfts = flattenItems(getSelectedCollections());
  const customs = getSelectedCustomsForBuild();
  return [...nfts, ...customs];
}

/** Manual selection modal: draft only until Confirm */
let manualModal = {
  collectionKey: null,
  draftKeys: null,
  overlay: null,
  /** { total, settled, failed } — previews with real URLs only */
  imageLoadState: null,
  /** NFT list not ready yet — show waiting UI and poll */
  waitingForNfts: false,
  _nftPollTid: null,
  _nftPollAttempts: 0,
};

const MANUAL_MODAL_NFT_POLL_MS = 320;
const MANUAL_MODAL_NFT_POLL_MAX = 140;

function clearManualModalNftPoll() {
  if (manualModal._nftPollTid != null) {
    clearTimeout(manualModal._nftPollTid);
    manualModal._nftPollTid = null;
  }
  manualModal._nftPollAttempts = 0;
}

function scheduleManualModalNftPoll() {
  clearManualModalNftPoll();
  const tick = () => {
    manualModal._nftPollTid = null;
    const key = manualModal.collectionKey;
    if (!key || !manualModal.overlay || manualModal.overlay.classList.contains("hidden")) return;
    const c = state.collections.find((x) => x.key === key);
    const n = (c?.nfts || []).length;
    if (n > 0) {
      manualModal.waitingForNfts = false;
      renderManualSelectionModalGrid(c);
      return;
    }
    manualModal._nftPollAttempts++;
    if (manualModal._nftPollAttempts >= MANUAL_MODAL_NFT_POLL_MAX) {
      manualModal.waitingForNfts = false;
      const grid = document.getElementById("manualSelectionGrid");
      if (grid && !grid.querySelector(".manual-nft-tile")) {
        grid.innerHTML = "";
        const err = document.createElement("div");
        err.className = "manual-selection-nfts-waiting manual-selection-nfts-waiting--timeout";
        err.innerHTML =
          "<p class=\"manual-selection-nfts-waiting-title\">No NFTs showed up in time</p>" +
          "<p class=\"manual-selection-nfts-waiting-hint\">Try <strong>Load wallet(s)</strong> again, or close and tap <strong>Select Manually</strong> once your collections finish loading.</p>";
        grid.appendChild(err);
      }
      updateManualModalLoadProgress();
      return;
    }
    manualModal._nftPollTid = setTimeout(tick, MANUAL_MODAL_NFT_POLL_MS);
  };
  manualModal._nftPollTid = setTimeout(tick, MANUAL_MODAL_NFT_POLL_MS);
}

/** After collections list re-renders (e.g. logos), fill manual grid if it was waiting on NFTs. */
function maybeRefreshManualModalGrid() {
  const key = manualModal.collectionKey;
  if (!key || !manualModal.overlay || manualModal.overlay.classList.contains("hidden")) return;
  if (!manualModal.waitingForNfts) return;
  const c = state.collections.find((x) => x.key === key);
  const n = (c?.nfts || []).length;
  if (n === 0) return;
  clearManualModalNftPoll();
  manualModal.waitingForNfts = false;
  renderManualSelectionModalGrid(c);
}

/** Title + collection logo in manual picker (updates when list re-renders / logo loads). */
function syncManualSelectionModalHeader() {
  const key = manualModal.collectionKey;
  if (!key || !manualModal.overlay || manualModal.overlay.classList.contains("hidden")) return;
  const c = state.collections.find((x) => x.key === key);
  if (!c) return;
  const title = document.getElementById("manualSelectionTitle");
  if (title) title.textContent = shortenForDisplay(c.name) || "Collection";
}

function getNFTSelectionKey(nft) {
  if (!nft || typeof nft !== "object") return "";
  if (nft._instanceId != null && String(nft._instanceId).length) return String(nft._instanceId);
  const addr = (
    nft._contractAddress ||
    nft?.contract?.address ||
    nft?.collection?.address ||
    nft?.contractAddress ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();
  const tid = (
    nft._tokenId ??
    nft?.tokenId ??
    nft?.token_id ??
    nft?.id?.tokenId ??
    nft?.id ??
    ""
  )
    .toString()
    .trim();
  return addr && tid ? `${addr}:${tid}` : "";
}

function syncSelectedKeysFromSelection() {
  const next = new Set();
  for (const c of state.collections) {
    const key = c.key;
    const mode = state.selectionModeByCollection[key] || "none";
    const nfts = c.nfts || [];
    if (mode === "all" && nfts.length > 0) next.add(key);
    else if (mode === "manual") {
      const set = state.selectedNFTsByCollection[key];
      if (set && set.size > 0) next.add(key);
    }
  }
  state.selectedKeys = next;
}

function getEffectiveCollectionForBuild(c) {
  const key = c.key;
  const mode = state.selectionModeByCollection[key] || "none";
  const nfts = c.nfts || [];
  if (mode === "none" || nfts.length === 0) return null;
  if (mode === "all") return { ...c, nfts: nfts.slice() };
  if (mode === "manual") {
    const keySet = state.selectedNFTsByCollection[key];
    if (!keySet || keySet.size === 0) return null;
    const filtered = nfts.filter((nft) => keySet.has(getNFTSelectionKey(nft)));
    if (filtered.length === 0) return null;
    return { ...c, nfts: filtered };
  }
  return null;
}

function getSelectedCollections() {
  const out = [];
  for (const c of state.collections) {
    const eff = getEffectiveCollectionForBuild(c);
    if (eff) out.push(eff);
  }
  return out;
}

/** Shown inline next to collection name when something is selected; empty when none / no selection. */
function getCollectionSelectionInlineSuffix(c) {
  const key = c.key;
  const mode = state.selectionModeByCollection[key] || "none";
  const total = c.count ?? c.nfts?.length ?? 0;
  if (total === 0) return "";
  if (mode === "none") return "";
  if (mode === "all") return "· All selected";
  if (mode === "manual") {
    const n = state.selectedNFTsByCollection[key]?.size ?? 0;
    if (n === 0) return "";
    return `· ${n} NFT${n === 1 ? "" : "s"}`;
  }
  return "";
}

function resetCollectionSelectionState() {
  state.selectionModeByCollection = {};
  state.selectedNFTsByCollection = {};
  state.selectedKeys = new Set();
  state.includeCollectionLogoInBuild = new Set();
  state.gridCollectionOrder = [];
}

function notifyBuildAffectedByLogoOrCollectionChange() {
  if (currentStep === 3 && queryAllGridTiles().length > 0) {
    setBuildGridNeedsRebuild(true);
  }
}

// ---- Export watermark (single source of truth) ----
const EXPORT_WATERMARK_TEXT = "⚡ Powered by Little Ollie";

// Configuration (loaded securely - see loadConfig() below)
let IMG_PROXY = null;
let configLoaded = false;

const ALCHEMY_HOST = {
  eth: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
  apechain: null,
};

// ---------- Build cache-buster (GRID only) ----------
let BUILD_ID = Date.now();

// ---------- Global image cache (reuse loaded images) ----------
const imageCache = new Map();

// ---------- Concurrent load limiter (prevents network overload) ----------
const MAX_CONCURRENT_LOADS = 12;
let activeLoads = 0;
const loadQueue = [];

function queueImageLoad(fn) {
  return new Promise((resolve, reject) => {
    loadQueue.push({ fn, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (activeLoads >= MAX_CONCURRENT_LOADS || loadQueue.length === 0) return;
  const { fn, resolve, reject } = loadQueue.shift();
  activeLoads++;
  fn()
    .then(resolve)
    .catch(reject)
    .finally(() => {
      activeLoads--;
      processQueue();
    });
}

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

const PLACEHOLDER_DATA_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23333' width='1' height='1'/%3E%3C/svg%3E";
const TILE_PLACEHOLDER_SRC = "src/assets/images/tile.png";
/** Shown on grid tiles until NFT art loads (Little Ollie mark). */
const GRID_LOADING_PLACEHOLDER_SRC = "src/assets/images/LO.png";

/** Classic grid: explicit empty cell (drag NFTs here to leave gaps / “new lines”). */
const GRID_EMPTY_SENTINEL = Object.freeze({ _gridEmpty: true });

function isGridSlotEmpty(it) {
  return !it || it === GRID_EMPTY_SENTINEL || it._gridEmpty === true;
}

function buildClassicPaddedItems(items, totalSlots) {
  const src = (items || []).slice(0, totalSlots);
  if (src.some(isGridSlotEmpty)) {
    const out = src.slice();
    while (out.length < totalSlots) out.push(GRID_EMPTY_SENTINEL);
    return out.slice(0, totalSlots);
  }
  const dense = src.filter((it) => !isGridSlotEmpty(it));
  const out = [];
  for (let i = 0; i < totalSlots; i++) {
    out.push(i < dense.length ? dense[i] : GRID_EMPTY_SENTINEL);
  }
  return out;
}

/** @param {string} orderIndexStr */
function makeGridTileForClassicSlot(item, orderIndexStr) {
  if (isGridSlotEmpty(item)) {
    const t = makeFillerTile();
    t.dataset.orderIndex = orderIndexStr;
    t.title = "Empty slot — drag an NFT here to leave a gap or start a new row";
    return t;
  }
  const t = makeNFTTile(item);
  t.dataset.orderIndex = orderIndexStr;
  return t;
}

// ---------- UI helpers ----------
const errorLog = {
  errors: [],
  maxErrors: 50,
  imageErrorCount: 0,
  imageErrorThrottleMax: 3,
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
          ? `<div style="margin-top: 4px; padding-left: 12px; opacity: 0.6; font-size: 13px;">${err.stack
              .split("\n")
              .slice(0, 3)
              .map((line) => escapeHtml(line))
              .join("<br>")}</div>`
          : "";
      return `
      <div style="padding: 6px 0; border-bottom: 1px solid rgba(244, 67, 54, 0.2);">
        <div style="color: #f44336; font-weight: 700;">
          <span style="opacity: 0.7; font-size: 13px;">[${escapeHtml(err.timestamp)}]</span>${contextText}
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
  const gridStatusHint = document.getElementById("gridStatusHint");
  const gridStatusProgressWrap = document.getElementById("gridStatusProgressWrap");
  const gridStatusProgress = document.getElementById("gridStatusProgress");
  const gridStatusRetryArea = document.getElementById("gridStatusRetryArea");

  const stageLoadBar = document.getElementById("gridStageImageLoading");
  const stageFill = document.getElementById("gridStageImageProgressFill");
  const stageTrack = document.getElementById("gridStageImageProgressTrack");
  const stageLabel = document.getElementById("gridStageImageLoadLabel");
  const stageFrac = document.getElementById("gridStageImageLoadFraction");

  if (total === 0) {
    if (barWrap) barWrap.style.display = "none";
    if (retryBtn) retryBtn.classList.remove("pulseAlert");
    if (stageFooter) stageFooter.style.display = "none";
    if (gridStatusHint) gridStatusHint.style.display = "none";
    const rb = $("removeUnloadedBtn");
    if (rb) rb.style.display = "none";
    if (stageLoadBar) {
      stageLoadBar.classList.add("grid-stage-image-loading--empty");
      stageLoadBar.classList.remove("grid-stage-image-loading--busy", "grid-stage-image-loading--done");
    }
    return;
  }

  const settled = Math.min(total, loaded + failed);
  const progress = Math.round((settled / total) * 100);
  const isComplete = settled >= total && failed === 0;
  let statusMsg = isComplete
    ? `✨ All ${total} images loaded`
    : `Loading images: ${settled}/${total}`;
  if (failed > 0) statusMsg += ` • ${failed} failed`;
  if (retrying > 0) statusMsg += ` • retrying...`;

  setStatus(statusMsg);

  /* Top-of-grid loading strip (red → green, matches manual picker) */
  if (stageLoadBar) {
    stageLoadBar.classList.remove("grid-stage-image-loading--empty");
    const busy = settled < total;
    stageLoadBar.classList.toggle("grid-stage-image-loading--busy", busy);
    stageLoadBar.classList.toggle("grid-stage-image-loading--done", !busy);
    if (stageFill) {
      stageFill.style.width = `${progress}%`;
      const t = progress / 100;
      const hue = t * 118;
      const hue2 = Math.min(118, hue + 10);
      stageFill.style.background = `linear-gradient(90deg, hsl(${hue}, 78%, 52%), hsl(${hue2}, 72%, 46%))`;
      stageFill.style.boxShadow = `0 0 12px hsla(${hue}, 82%, 55%, 0.5)`;
    }
    if (stageFrac) stageFrac.textContent = `${settled} / ${total}`;
    if (stageTrack) {
      stageTrack.setAttribute("aria-valuenow", String(progress));
      stageTrack.setAttribute("aria-valuetext", `${settled} of ${total} grid images`);
    }
    if (stageLabel) {
      if (busy) stageLabel.textContent = "Loading grid images…";
      else if (failed > 0) stageLabel.textContent = "Finished loading — some tiles need Retry missing";
      else stageLabel.textContent = "All grid images loaded";
    }
  }

  /* Below-grid status bar */
  if (stageFooter) stageFooter.style.display = "flex";
  if (gridStatusHint) {
    const showHint = total >= 40 && settled < total;
    gridStatusHint.style.display = showHint ? "block" : "none";
  }
  if (gridStatusText) gridStatusText.textContent = statusMsg;
  if (gridStatusProgressWrap) gridStatusProgressWrap.style.display = settled < total ? "" : "none";
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
  const removeUnloadedBtn = $("removeUnloadedBtn");
  if (removeUnloadedBtn) {
    removeUnloadedBtn.style.display = failed > 0 ? "" : "none";
  }
}

function syncGridFooterButtons(buildDisabled, exportDisabled) {
  const gridBuild = $("gridBuildBtn");
  const gridExport = $("gridExportBtn");
  const gridGif = $("gridGifBtn");
  if (gridBuild != null) gridBuild.disabled = buildDisabled ?? !hasItemsForBuild();
  if (gridExport != null) gridExport.disabled = exportDisabled ?? true;
  if (gridGif != null) gridGif.disabled = exportDisabled ?? true;
}
function enableButtons() {
  const loadBtn = $("loadBtn");
  const buildBtn = $("gridBuildBtn");
  const exportBtn = $("gridExportBtn");
  const gifBtn = $("gridGifBtn");

  const hasWallets = state.wallets.length > 0;
  if (loadBtn) loadBtn.disabled = !hasWallets;
  syncSelectedKeysFromSelection();
  const buildDisabled = !hasItemsForBuild();
  if (buildBtn) buildBtn.disabled = buildDisabled;
  if (exportBtn) exportBtn.disabled = true;
  if (gifBtn) gifBtn.disabled = true;
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
  if (!url) return null;

  const s = String(url).trim();

  // Already good
  if (s.startsWith("https://")) return s;

  // ipfs://
  if (s.startsWith("ipfs://")) {
    const path = s.replace("ipfs://", "").replace(/^ipfs\//, "");
    return "https://cloudflare-ipfs.com/ipfs/" + path;
  }

  // Raw CID
  if (!s.startsWith("http") && s.length > 40) {
    return "https://cloudflare-ipfs.com/ipfs/" + s;
  }

  return s;
}

/** Prefer Worker proxy when available; fallback to direct gateways for reliability. */
function toProxyUrl(rawUrl) {
  if (!rawUrl || !IMG_PROXY) return null;
  if (isAlreadyProxied(rawUrl)) return rawUrl;
  const normalized = normalizeImageUrl(rawUrl);
  const urlToProxy = normalized || String(rawUrl).trim();
  if (!urlToProxy) return null;
  return IMG_PROXY + encodeURIComponent(urlToProxy);
}

function safeProxyUrl(src) {
  return toProxyUrl(src) || normalizeImageUrl(src) || "";
}

function gridProxyUrl(src) {
  if (isAlreadyProxied(src)) return src;
  return toProxyUrl(src) || normalizeImageUrl(src) || src;
}

/** Proxy first when available, then direct gateways as fallback. */
function buildImageCandidates(rawUrl) {
  const normalized = normalizeImageUrl(rawUrl);
  if (!normalized) return [];

  const proxy = toProxyUrl(rawUrl);
  const candidates = proxy ? [proxy] : [];

  const ipfsPath = getIpfsPath(rawUrl);
  if (ipfsPath) {
    candidates.push(`https://cloudflare-ipfs.com/ipfs/${ipfsPath}`);
    candidates.push(`https://w3s.link/ipfs/${ipfsPath}`);
    candidates.push(`https://nftstorage.link/ipfs/${ipfsPath}`);
    candidates.push(`https://ipfs.io/ipfs/${ipfsPath}`);
  } else if (normalized && !candidates.includes(normalized)) {
    candidates.push(normalized);
  }

  return [...new Set(candidates)];
}

/** Register URLs the manual picker already loaded so Build Grid reuses imageCache (instant assign, no re-fetch). */
function primeImageCacheFromManualPreview(nft, imgEl) {
  if (!nft || !imgEl) return;
  const raw = getImage(nft);
  const rawStr = typeof raw === "string" ? raw.trim() : "";
  if (!rawStr) return;
  const normalized = normalizeImageUrl(rawStr) || rawStr;
  const candidates = buildImageCandidates(normalized);
  const shown = (imgEl.currentSrc || imgEl.src || "").trim();
  const intended = modalThumbSrcForNFT(nft);
  if (intended && intended !== TILE_PLACEHOLDER_SRC) {
    imageCache.set(intended, intended);
  }
  for (const c of candidates) {
    if (c && (c === shown || c === intended)) {
      imageCache.set(c, c);
    }
  }
}

function loadImageWithTimeout(img, src, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const testImg = new Image();
    setImgCORS(testImg, true);
    const t = setTimeout(() => {
      testImg.onload = null;
      testImg.onerror = null;
      testImg.src = "";
      reject(new Error("timeout"));
    }, timeout);
    testImg.onload = () => {
      clearTimeout(t);
      img.src = src;
      resolve();
    };
    testImg.onerror = () => {
      clearTimeout(t);
      reject(new Error("error"));
    };
    testImg.src = src;
  });
}

function exportProxyUrl(src) {
  return safeProxyUrl(src);
}

// ---------- Watermark helpers (DOM + Export) ----------
function syncWatermarkDOMToOneTile() {
  const wm = document.getElementById("wmGrid"); // <img>
  const grid = document.getElementById("grid");
  const overflow = document.getElementById("gridOverflow");
  if (!wm || !grid) return;

  const firstTile = grid.querySelector(".tile") || overflow?.querySelector(".tile");
  if (!firstTile) {
    wm.style.display = "none";
    return;
  }

  const gridWrap = grid.closest(".gridWrap") || grid.parentElement;
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

let walletValidationDebounce = null;

function clearWalletValidationHint() {
  const hint = $("walletValidationHint");
  if (hint) hint.textContent = "";
}

function showWalletValidationHint(valid) {
  const hint = $("walletValidationHint");
  if (!hint) return;
  hint.textContent = valid ? "✓ Valid" : "";
  hint.style.color = valid ? "#4CAF50" : "";
}

function addWallet() {
  const input = $("walletInput");
  const hint = $("walletValidationHint");
  const w = normalizeWallet(input ? input.value : "");

  const showAddError = (msg) => {
    setStatus(msg);
    if (hint) { hint.textContent = msg; hint.style.color = "#ff9800"; }
  };

  if (!w) {
    showAddError("👋 Paste a wallet address first.");
    return;
  }
  if (!/^0x[a-f0-9]{40}$/.test(w)) {
    showAddError("That doesn't look like a valid 0x address (need 0x + 40 hex chars).");
    return;
  }
  if (state.wallets.includes(w)) {
    showAddError("Already got that one!");
    return;
  }

  state.wallets.push(w);

  if (input) {
    input.value = "";
    input.blur();
  }
  clearWalletValidationHint();

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

// ---------- Manual selection modal ----------
function ensureManualSelectionModal() {
  if (manualModal.overlay) return manualModal.overlay;
  const overlay = document.createElement("div");
  overlay.id = "manualSelectionOverlay";
  overlay.className = "manual-selection-overlay hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="manual-selection-modal" role="dialog" aria-modal="true" aria-labelledby="manualSelectionTitle">
      <div class="manual-selection-header">
        <div class="manual-selection-headerTop">
          <button type="button" class="manual-selection-close" id="manualSelectionCloseX" aria-label="Close">×</button>
        </div>
        <div class="manual-selection-headerMain">
          <img
            id="manualSelectionHeaderBanner"
            class="manual-selection-headerBanner"
            src="src/assets/images/header.png"
            alt=""
            aria-hidden="true"
            decoding="async"
          />
          <h3 id="manualSelectionTitle" class="manual-selection-title"></h3>
        </div>
      </div>
      <div class="manual-selection-toolbar">
        <button type="button" class="btn btnSmall" id="manualSelectionModalSelectAll">Select All</button>
        <button type="button" class="btn btnSmall" id="manualSelectionModalClear">Clear</button>
        <button type="button" class="btn btnSmall manual-selection-retry-failed hidden" id="manualSelectionRetryFailed">↻ Retry failed images</button>
      </div>
      <div class="manual-selection-loading" id="manualSelectionLoadingBar" aria-live="polite">
        <p class="manual-selection-kid-note" id="manualSelectionKidNote">
          <span class="manual-selection-kid-note-line1">Please wait a moment — I’m only a kid doing the best I can :)</span>
          <span class="manual-selection-kid-note-line2">Keep tapping <strong>↻ Retry</strong> on any empty tiles while things load!</span>
        </p>
        <div class="manual-selection-loading-row">
          <span id="manualSelectionLoadLabel" class="manual-selection-load-label">Loading previews…</span>
          <span id="manualSelectionLoadFraction" class="manual-selection-load-fraction"></span>
        </div>
        <div class="manual-selection-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="manualSelectionProgressTrack">
          <div class="manual-selection-progress-fill" id="manualSelectionProgressFill"></div>
        </div>
      </div>
      <div class="manual-selection-scroll">
        <div class="manual-selection-grid" id="manualSelectionGrid"></div>
      </div>
      <div class="manual-selection-footer">
        <span class="manual-selection-count" id="manualSelectionCount"></span>
        <div class="manual-selection-footer-btns">
          <button type="button" class="btn btnSmall" id="manualSelectionCancel">Cancel</button>
          <button type="button" class="btn" id="manualSelectionConfirm">Confirm Selection</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const stop = (e) => e.stopPropagation();
  overlay.querySelector(".manual-selection-modal").addEventListener("click", stop);
  overlay.addEventListener("click", () => cancelManualSelection());
  document.getElementById("manualSelectionCloseX").addEventListener("click", () => cancelManualSelection());
  document.getElementById("manualSelectionCancel").addEventListener("click", () => cancelManualSelection());
  document.getElementById("manualSelectionConfirm").addEventListener("click", () => confirmManualSelection());
  document.getElementById("manualSelectionModalSelectAll").addEventListener("click", () => {
    const c = state.collections.find((x) => x.key === manualModal.collectionKey);
    if (!c || !manualModal.draftKeys) return;
    manualModal.draftKeys.clear();
    for (const nft of c.nfts || []) {
      const k = getNFTSelectionKey(nft);
      if (k) manualModal.draftKeys.add(k);
    }
    refreshManualSelectionModalTiles();
  });
  document.getElementById("manualSelectionModalClear").addEventListener("click", () => {
    if (manualModal.draftKeys) manualModal.draftKeys.clear();
    refreshManualSelectionModalTiles();
  });
  const retryFailedBtn = document.getElementById("manualSelectionRetryFailed");
  if (retryFailedBtn) {
    retryFailedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      retryAllFailedManualModalImages();
    });
  }

  manualModal.overlay = overlay;

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const o = manualModal.overlay;
    if (!o || o.classList.contains("hidden")) return;
    cancelManualSelection();
  });

  return overlay;
}

function modalThumbSrcForNFT(nft) {
  const raw = getImage(nft);
  const u = toProxyUrl(raw) || normalizeImageUrl(raw);
  return u || TILE_PLACEHOLDER_SRC;
}

function updateManualModalLoadProgress() {
  const bar = document.getElementById("manualSelectionLoadingBar");
  const fill = document.getElementById("manualSelectionProgressFill");
  const track = document.getElementById("manualSelectionProgressTrack");
  const label = document.getElementById("manualSelectionLoadLabel");
  const frac = document.getElementById("manualSelectionLoadFraction");
  const retryAll = document.getElementById("manualSelectionRetryFailed");
  const grid = document.getElementById("manualSelectionGrid");
  const st = manualModal.imageLoadState;
  if (!bar || !st) return;

  if (manualModal.waitingForNfts) {
    bar.classList.remove("manual-selection-loading--empty", "manual-selection-loading--done");
    bar.classList.add("manual-selection-loading--busy", "manual-selection-loading--waitNfts");
    if (label) label.textContent = "Loading NFT list for this collection…";
    if (frac) frac.textContent = "";
    if (fill) {
      fill.style.width = "12%";
      fill.style.background = "linear-gradient(90deg, hsl(200, 70%, 52%), hsl(210, 72%, 48%))";
      fill.style.boxShadow = "0 0 10px hsla(200, 82%, 55%, 0.45)";
    }
    if (track) {
      track.setAttribute("aria-valuenow", "0");
      track.setAttribute("aria-valuetext", "Waiting for NFTs");
    }
    if (retryAll) retryAll.classList.add("hidden");
    return;
  }

  bar.classList.remove("manual-selection-loading--waitNfts");

  if (st.total === 0) {
    bar.classList.add("manual-selection-loading--empty");
    bar.classList.remove("manual-selection-loading--busy", "manual-selection-loading--done");
    if (retryAll) retryAll.classList.add("hidden");
    return;
  }

  bar.classList.remove("manual-selection-loading--empty");
  const failedCount = grid ? grid.querySelectorAll(".manual-nft-tile--error").length : 0;
  const pct = Math.min(100, Math.round((st.settled / st.total) * 100));
  if (fill) {
    fill.style.width = `${pct}%`;
    const t = pct / 100;
    const hue = t * 118;
    const hue2 = Math.min(118, hue + 10);
    fill.style.background = `linear-gradient(90deg, hsl(${hue}, 78%, 52%), hsl(${hue2}, 72%, 46%))`;
    fill.style.boxShadow = `0 0 12px hsla(${hue}, 82%, 55%, 0.5)`;
  }
  if (frac) frac.textContent = `${st.settled} / ${st.total}`;
  if (track) {
    track.setAttribute("aria-valuenow", String(pct));
    track.setAttribute("aria-valuetext", `${st.settled} of ${st.total} previews`);
  }
  const busy = st.settled < st.total;
  if (label) {
    if (busy) label.textContent = "Loading previews…";
    else if (failedCount > 0) {
      label.textContent = "Some didn’t load — tap ↻ on a tile or use Retry failed";
    } else label.textContent = "All previews loaded";
  }
  bar.classList.toggle("manual-selection-loading--busy", busy);
  bar.classList.toggle("manual-selection-loading--done", !busy);
  if (retryAll) {
    if (failedCount > 0 && !busy) retryAll.classList.remove("hidden");
    else retryAll.classList.add("hidden");
  }
}

/** Reject broken responses, 1×1 tracking pixels, and “empty” proxy junk that still fires `load`. */
function isManualModalImageRenderable(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const MIN = 4;
  return w >= MIN && h >= MIN;
}

function attachManualThumbnailPipeline(img, cell, retryBtn, { bumpSettledOnDone, nft } = {}) {
  let settled = false;
  const st = manualModal.imageLoadState;
  const apply = (ok) => {
    if (settled) return;
    settled = true;
    if (ok) {
      retryBtn.hidden = true;
      cell.classList.remove("manual-nft-tile--error");
      if (nft) primeImageCacheFromManualPreview(nft, img);
    } else {
      retryBtn.hidden = false;
      cell.classList.add("manual-nft-tile--error");
    }
    if (bumpSettledOnDone && st) st.settled++;
    updateManualModalLoadProgress();
  };
  const settleOkIfRenderable = () => {
    if (settled) return;
    if (!isManualModalImageRenderable(img)) {
      apply(false);
      return;
    }
    apply(true);
  };
  const onLoad = () => {
    if (settled) return;
    if (typeof img.decode === "function") {
      img.decode().then(settleOkIfRenderable).catch(() => apply(false));
    } else {
      settleOkIfRenderable();
    }
  };
  img.addEventListener("load", onLoad, { once: true });
  img.addEventListener("error", () => apply(false), { once: true });
  requestAnimationFrame(() => {
    if (settled || !img.complete || !img.src) return;
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      apply(false);
      return;
    }
    if (typeof img.decode === "function") {
      img.decode().then(settleOkIfRenderable).catch(() => apply(false));
    } else {
      settleOkIfRenderable();
    }
  });
}

function armManualModalImage(img, cell, retryBtn, nft) {
  attachManualThumbnailPipeline(img, cell, retryBtn, { bumpSettledOnDone: true, nft });
}

function retryManualModalImage(img, nft, retryBtn, cell) {
  cell.classList.remove("manual-nft-tile--error");
  retryBtn.hidden = true;
  const base = modalThumbSrcForNFT(nft);
  const sep = base.includes("?") ? "&" : "?";
  attachManualThumbnailPipeline(img, cell, retryBtn, { bumpSettledOnDone: false, nft });
  img.src = `${base}${sep}_retry=${Date.now()}`;
}

function retryAllFailedManualModalImages() {
  const grid = document.getElementById("manualSelectionGrid");
  const c = state.collections.find((x) => x.key === manualModal.collectionKey);
  if (!grid || !c) return;
  const cells = [...grid.querySelectorAll(".manual-nft-tile--error")];
  for (const cell of cells) {
    const k = cell.dataset.nftKey;
    const nft = (c.nfts || []).find((n) => getNFTSelectionKey(n) === k);
    if (!nft) continue;
    const img = cell.querySelector("img");
    const retryBtn = cell.querySelector(".manual-nft-tile-retry");
    if (img && retryBtn) retryManualModalImage(img, nft, retryBtn, cell);
  }
}

function refreshManualSelectionModalTiles() {
  const grid = document.getElementById("manualSelectionGrid");
  const countEl = document.getElementById("manualSelectionCount");
  if (!grid || !manualModal.draftKeys) return;
  const draft = manualModal.draftKeys;
  grid.querySelectorAll(".manual-nft-tile").forEach((el) => {
    const k = el.dataset.nftKey;
    if (k && draft.has(k)) el.classList.add("manual-nft-tile--selected");
    else el.classList.remove("manual-nft-tile--selected");
  });
  if (countEl) countEl.textContent = `${draft.size} selected`;
}

/** Light shell so the overlay can paint before heavy grid DOM + image wiring. */
function primeManualModalOpenShell() {
  const grid = document.getElementById("manualSelectionGrid");
  const bar = document.getElementById("manualSelectionLoadingBar");
  const fill = document.getElementById("manualSelectionProgressFill");
  const frac = document.getElementById("manualSelectionLoadFraction");
  const label = document.getElementById("manualSelectionLoadLabel");
  const track = document.getElementById("manualSelectionProgressTrack");
  const retryAll = document.getElementById("manualSelectionRetryFailed");
  if (grid) grid.innerHTML = "";
  manualModal.imageLoadState = { total: 0, settled: 0 };
  manualModal.waitingForNfts = false;
  if (bar) {
    bar.classList.remove("manual-selection-loading--empty", "manual-selection-loading--done", "manual-selection-loading--waitNfts");
    bar.classList.add("manual-selection-loading--busy");
  }
  if (label) label.textContent = "Opening picker…";
  if (frac) frac.textContent = "";
  if (fill) {
    fill.style.width = "10%";
    fill.style.background = "linear-gradient(90deg, hsl(200, 70%, 52%), hsl(210, 72%, 48%))";
    fill.style.boxShadow = "0 0 10px hsla(200, 82%, 55%, 0.45)";
  }
  if (track) {
    track.setAttribute("aria-valuenow", "0");
    track.setAttribute("aria-valuetext", "Opening");
  }
  if (retryAll) retryAll.classList.add("hidden");
  const countEl = document.getElementById("manualSelectionCount");
  if (countEl) countEl.textContent = `${manualModal.draftKeys?.size ?? 0} selected`;
}

function renderManualSelectionModalGrid(collection) {
  const grid = document.getElementById("manualSelectionGrid");
  if (!grid) return;
  grid.innerHTML = "";
  manualModal.imageLoadState = { total: 0, settled: 0 };

  const bar = document.getElementById("manualSelectionLoadingBar");
  if (bar) {
    bar.classList.remove("manual-selection-loading--empty", "manual-selection-loading--done", "manual-selection-loading--waitNfts");
    bar.classList.add("manual-selection-loading--busy");
  }
  const retryAll = document.getElementById("manualSelectionRetryFailed");
  if (retryAll) retryAll.classList.add("hidden");

  const nfts = collection.nfts || [];
  if (nfts.length === 0) {
    manualModal.waitingForNfts = true;
    const hold = document.createElement("div");
    hold.className = "manual-selection-nfts-waiting";
    hold.innerHTML =
      "<p class=\"manual-selection-nfts-waiting-title\">Getting your NFTs ready…</p>" +
      "<p class=\"manual-selection-nfts-waiting-hint\">You only need to tap <strong>Select Manually</strong> once — previews will fill in here when the list is ready (usually a few seconds).</p>";
    grid.appendChild(hold);
    updateManualModalLoadProgress();
    scheduleManualModalNftPoll();
    const countEl = document.getElementById("manualSelectionCount");
    if (countEl) countEl.textContent = `${manualModal.draftKeys?.size ?? 0} selected`;
    return;
  }

  manualModal.waitingForNfts = false;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];
    const k = getNFTSelectionKey(nft);
    if (!k) continue;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "manual-nft-tile";
    cell.dataset.nftKey = k;
    if (manualModal.draftKeys.has(k)) cell.classList.add("manual-nft-tile--selected");

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "eager";
    img.referrerPolicy = "no-referrer";
    img.crossOrigin = "anonymous";

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "manual-nft-tile-retry";
    retryBtn.textContent = "↻";
    retryBtn.title = "Retry loading image";
    retryBtn.setAttribute("aria-label", "Retry loading image");
    retryBtn.hidden = true;
    retryBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      retryManualModalImage(img, nft, retryBtn, cell);
    });

    const src = modalThumbSrcForNFT(nft);
    const isPlaceholder = !src || src === TILE_PLACEHOLDER_SRC;

    cell.appendChild(img);
    cell.appendChild(retryBtn);
    cell.addEventListener("click", (e) => {
      if (e.target.closest(".manual-nft-tile-retry")) return;
      e.stopPropagation();
      toggleManualNFTSelection(k);
    });
    frag.appendChild(cell);

    if (!isPlaceholder && manualModal.imageLoadState) {
      manualModal.imageLoadState.total++;
      armManualModalImage(img, cell, retryBtn, nft);
    }
    img.src = src;
  }
  grid.appendChild(frag);

  updateManualModalLoadProgress();

  const countEl = document.getElementById("manualSelectionCount");
  if (countEl) countEl.textContent = `${manualModal.draftKeys.size} selected`;
}

function toggleManualNFTSelection(nftKey) {
  if (!manualModal.draftKeys || !nftKey) return;
  if (manualModal.draftKeys.has(nftKey)) manualModal.draftKeys.delete(nftKey);
  else manualModal.draftKeys.add(nftKey);
  refreshManualSelectionModalTiles();
}

function openManualSelectionModal(collectionKey) {
  const c = state.collections.find((x) => x.key === collectionKey);
  if (!c) return;

  clearManualModalNftPoll();
  manualModal.waitingForNfts = false;

  const mode = state.selectionModeByCollection[collectionKey] || "none";
  const draft = new Set();
  if (mode === "manual") {
    const committed = state.selectedNFTsByCollection[collectionKey];
    if (committed) committed.forEach((id) => draft.add(id));
  } else if (mode === "all") {
    for (const nft of c.nfts || []) {
      const k = getNFTSelectionKey(nft);
      if (k) draft.add(k);
    }
  }

  manualModal.collectionKey = collectionKey;
  manualModal.draftKeys = draft;

  const overlay = ensureManualSelectionModal();
  syncManualSelectionModalHeader();
  primeManualModalOpenShell();

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  syncBodyScrollLock();

  const openKey = collectionKey;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (manualModal.collectionKey !== openKey) return;
      const c2 = state.collections.find((x) => x.key === openKey);
      if (!c2) return;
      renderManualSelectionModalGrid(c2);
    });
  });
}

function closeManualSelectionModal() {
  clearManualModalNftPoll();
  manualModal.waitingForNfts = false;
  const overlay = manualModal.overlay;
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }
  syncBodyScrollLock();
  manualModal.collectionKey = null;
  manualModal.draftKeys = null;
}

function cancelManualSelection() {
  closeManualSelectionModal();
}

function confirmManualSelection() {
  const key = manualModal.collectionKey;
  const draft = manualModal.draftKeys;
  if (!key || !draft) {
    closeManualSelectionModal();
    return;
  }

  if (draft.size === 0) {
    state.selectionModeByCollection[key] = "none";
    delete state.selectedNFTsByCollection[key];
  } else {
    const c = state.collections.find((x) => x.key === key);
    const total = c?.nfts?.length ?? 0;
    if (total > 0 && draft.size >= total) {
      state.selectionModeByCollection[key] = "all";
      delete state.selectedNFTsByCollection[key];
    } else {
      state.selectionModeByCollection[key] = "manual";
      state.selectedNFTsByCollection[key] = new Set(draft);
    }
  }

  syncSelectedKeysFromSelection();
  renderCollectionsList();
  const buildBtn = $("gridBuildBtn");
  const exportBtn = $("gridExportBtn");
  if (buildBtn) buildBtn.disabled = !hasItemsForBuild();
  if (exportBtn) exportBtn.disabled = true;
  syncGridFooterButtons(!hasItemsForBuild(), true);
  renderTraitFiltersForSelected();
  updateGuideGlow();
  closeManualSelectionModal();
}

// ---------- Collection logos (Alchemy contract metadata, async) ----------
/** Avoid dozens of simultaneous /img requests freezing the collections UI — cap starts per frame. */
const COLLECTION_THUMB_LOADS_PER_FRAME = 2;
let _collectionThumbQueue = [];
let _collectionThumbRaf = null;

function enqueueCollectionListImageLoad(setSrcFn) {
  _collectionThumbQueue.push(setSrcFn);
  if (_collectionThumbRaf != null) return;
  const pump = () => {
    _collectionThumbRaf = null;
    let n = COLLECTION_THUMB_LOADS_PER_FRAME;
    while (n-- > 0 && _collectionThumbQueue.length) {
      const fn = _collectionThumbQueue.shift();
      try {
        fn();
      } catch (_) {}
    }
    if (_collectionThumbQueue.length) {
      _collectionThumbRaf = requestAnimationFrame(pump);
    }
  };
  _collectionThumbRaf = requestAnimationFrame(pump);
}

let _collectionLogoPatchKeys = new Set();
let _collectionLogoPatchRaf = null;

/** When contract metadata returns a logo URL, patch only that row — do not rebuild the whole list. */
function scheduleCollectionLogoPatch(contractKey) {
  const k = String(contractKey || "").trim().toLowerCase();
  if (!k) return;
  _collectionLogoPatchKeys.add(k);
  if (_collectionLogoPatchRaf != null) return;
  _collectionLogoPatchRaf = requestAnimationFrame(() => {
    _collectionLogoPatchRaf = null;
    const keys = [..._collectionLogoPatchKeys];
    _collectionLogoPatchKeys.clear();
    for (const addr of keys) {
      patchCollectionLogoInList(addr);
    }
    syncManualSelectionModalHeader();
  });
}

function patchCollectionLogoInList(contractKey) {
  const list = $("collectionsList");
  if (!list) return;
  const k = String(contractKey || "").trim().toLowerCase();
  const row = list.querySelector(`[data-collection-key="${k}"]`);
  if (!row) return;
  const oldWrap = row.querySelector(".collectionLogoWrap");
  if (!oldWrap) return;
  const c = state.collections.find((x) => String(x.key || "").trim().toLowerCase() === k);
  if (!c) return;
  const newWrap = buildCollectionLogoThumb(c);
  oldWrap.replaceWith(newWrap);
}

function syncLogoFromCacheToCollections(contractKey, rawLogoUrl) {
  for (const col of state.collections || []) {
    if (col.key === contractKey) col.logo = rawLogoUrl;
  }
}

async function fetchCollectionLogoForContract(contractKey, chain) {
  const k = `${chain}::${contractKey}`;
  if (Object.prototype.hasOwnProperty.call(state.contractLogoCache, k)) {
    syncLogoFromCacheToCollections(contractKey, state.contractLogoCache[k]);
    scheduleCollectionLogoPatch(contractKey);
    return;
  }

  let p = state.contractLogoInflight.get(k);
  if (!p) {
    p = (async () => {
      const { rawLogoUrl } = await fetchContractMetadataFromWorker({ contract: contractKey, chain });
      const raw = rawLogoUrl && String(rawLogoUrl).trim() ? String(rawLogoUrl).trim() : null;
      state.contractLogoCache[k] = raw;
      state.contractLogoInflight.delete(k);
      syncLogoFromCacheToCollections(contractKey, raw);
      scheduleCollectionLogoPatch(contractKey);
      return raw;
    })().catch(() => {
      state.contractLogoCache[k] = null;
      state.contractLogoInflight.delete(k);
      syncLogoFromCacheToCollections(contractKey, null);
      scheduleCollectionLogoPatch(contractKey);
      return null;
    });
    state.contractLogoInflight.set(k, p);
  }
  await p;
}

/** Non-blocking: fetch contract logos after collections exist; does not require IMG_PROXY (display still proxies when available). */
function queueCollectionLogoFetches() {
  if (!state.collections?.length) return;
  const chain = state.chain || "eth";

  queueMicrotask(() => {
    const list = state.collections.filter((c) => /^0x[a-fA-F0-9]{40}$/.test(String(c.key || "").trim()));
    if (!list.length) return;

    const concurrency = 2;
    let idx = 0;

    async function worker() {
      while (idx < list.length) {
        const i = idx++;
        const c = list[i];
        try {
          await fetchCollectionLogoForContract(c.key, chain);
          await new Promise((r) => setTimeout(r, 75));
        } catch (_) {}
      }
    }

    Promise.all(Array.from({ length: concurrency }, () => worker())).catch(() => {});
  });
}

function makeCollectionLogoPlaceholder() {
  const d = document.createElement("div");
  d.className = "collectionLogoPlaceholder";
  d.setAttribute("aria-hidden", "true");
  return d;
}

/**
 * Collection / contract image from Alchemy NFT payloads (not token art).
 * getNFTsForOwner often includes contractMetadata.openSeaMetadata.imageUrl or contract.openSea.
 */
function extractCollectionLogoRawUrlFromNft(nft) {
  if (!nft || typeof nft !== "object") return null;
  const pick = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const u = obj.imageUrl || obj.image_url || obj.logo;
    return typeof u === "string" && u.trim() ? u.trim() : null;
  };
  const cm = nft.contractMetadata;
  if (cm && typeof cm === "object") {
    const u =
      pick(cm.openSeaMetadata) ||
      pick(cm.openSea) ||
      (typeof cm.logoUrl === "string" && cm.logoUrl.trim() ? cm.logoUrl.trim() : null) ||
      (typeof cm.imageUrl === "string" && cm.imageUrl.trim() ? cm.imageUrl.trim() : null) ||
      (typeof cm.image_url === "string" && cm.image_url.trim() ? cm.image_url.trim() : null);
    if (u) return u;
  }
  const c = nft.contract;
  if (c && typeof c === "object") {
    const u = pick(c.openSeaMetadata) || pick(c.openSea);
    if (u) return u;
  }
  return null;
}

/** Square thumb: contract/collection logo only (proxied). No token image fallback. */
function buildCollectionLogoThumb(c) {
  const wrap = document.createElement("div");
  wrap.className = "collectionLogoWrap";

  const appendImg = (src) => {
    const img = document.createElement("img");
    img.className = "collectionLogoThumb";
    img.alt = "";
    img.draggable = false;
    img.loading = "lazy";
    img.decoding = "async";
    try {
      if ("fetchPriority" in img) img.fetchPriority = "low";
    } catch (_) {}
    img.referrerPolicy = "no-referrer";
    img.crossOrigin = "anonymous";
    img.onerror = () => {
      wrap.innerHTML = "";
      wrap.appendChild(makeCollectionLogoPlaceholder());
    };
    wrap.appendChild(img);
    enqueueCollectionListImageLoad(() => {
      img.src = src;
    });
  };

  if (c.logo) {
    const proxied = toProxyUrl(c.logo);
    if (proxied) {
      appendImg(proxied);
      return wrap;
    }
  }

  wrap.appendChild(makeCollectionLogoPlaceholder());
  return wrap;
}

// ---------- Collections ----------
// ---------- Collection-first UX state (drives UI; core build logic stays in `state.*`) ----------
// Source of truth remains:
// - `state.selectionModeByCollection`
// - `state.selectedNFTsByCollection`
// - `state.includeCollectionLogoInBuild`
// This block exists so the UX can talk in terms of "selected collections / settings"
// without rewriting the grid builder.
const collectionFirstState = {
  /** Set of collection keys the user has interacted with (mode !== "none" or includeLogo). */
  selectedCollections: new Set(),
  /** { [collectionKey]: Set<nftSelectionKey> } (mirrors `state.selectedNFTsByCollection`) */
  selectedNFTs: Object.create(null),
  /** { [collectionKey]: { selectAll:boolean, manualSelection:string[], includeLogo:boolean } } */
  collectionSettings: Object.create(null),
};

function syncCollectionFirstFromCoreFor(collectionKey) {
  const key = String(collectionKey || "");
  if (!key) return;
  const mode = state.selectionModeByCollection[key] || "none";
  const manualSet = state.selectedNFTsByCollection[key];
  const includeLogo = state.includeCollectionLogoInBuild.has(key);

  collectionFirstState.collectionSettings[key] = {
    selectAll: mode === "all",
    manualSelection: Array.from(manualSet || []),
    includeLogo,
  };
  if (manualSet && manualSet.size) collectionFirstState.selectedNFTs[key] = new Set(manualSet);
  else delete collectionFirstState.selectedNFTs[key];

  const interacted = mode !== "none" || includeLogo;
  if (interacted) collectionFirstState.selectedCollections.add(key);
  else collectionFirstState.selectedCollections.delete(key);
}

function syncCollectionFirstFromCoreAll() {
  for (const c of state.collections || []) {
    if (!c?.key) continue;
    syncCollectionFirstFromCoreFor(c.key);
  }
}

// ---------- Collection actions modal ----------
let collectionActionsModal = {
  overlay: null,
  collectionKey: null,
};

function ensureCollectionActionsModal() {
  if (collectionActionsModal.overlay) return collectionActionsModal.overlay;

  const overlay = document.createElement("div");
  overlay.id = "collectionActionsOverlay";
  overlay.className = "collection-actions-overlay hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="collection-actions-modal" role="dialog" aria-modal="true" aria-labelledby="collectionActionsTitle">
      <div class="collection-actions-header">
        <div class="collection-actions-headerRow">
          <button type="button" class="collection-actions-back" id="collectionActionsBack">← Select more collections</button>
          <button type="button" class="collection-actions-close" id="collectionActionsCloseX" aria-label="Close">×</button>
        </div>
        <img class="collection-actions-topBanner" src="src/assets/images/header.png" alt="" aria-hidden="true" />
        <h3 class="collection-actions-title" id="collectionActionsTitle"></h3>
      </div>

      <div class="collection-actions-body">
        <p class="collection-actions-summary" id="collectionActionsSummary"></p>

        <div class="collection-actions-btns">
          <button type="button" class="btn" id="collectionActionsSelectAll">✅ Select All NFTs</button>
          <button type="button" class="btn" id="collectionActionsSelectManual">🖐️ Select Manually</button>
          <button type="button" class="btn" id="collectionActionsLogo">🖼️ Add Collection Logo</button>
        </div>

        <button type="button" class="btn btnPrimary collection-actions-build" id="collectionActionsBuild">🧩 BUILD GRID NOW</button>
      </div>
    </div>
  `;

  const stop = (e) => e.stopPropagation();
  overlay.querySelector(".collection-actions-modal").addEventListener("click", stop);
  overlay.addEventListener("click", () => closeCollectionActionsModal());

  document.body.appendChild(overlay);
  collectionActionsModal.overlay = overlay;

  const back = document.getElementById("collectionActionsBack");
  const closeX = document.getElementById("collectionActionsCloseX");
  const btnAll = document.getElementById("collectionActionsSelectAll");
  const btnManual = document.getElementById("collectionActionsSelectManual");
  const btnLogo = document.getElementById("collectionActionsLogo");
  const btnBuild = document.getElementById("collectionActionsBuild");

  if (back) back.addEventListener("click", () => closeCollectionActionsModal());
  if (closeX) closeX.addEventListener("click", () => closeCollectionActionsModal());

  if (btnAll)
    btnAll.addEventListener("click", () => {
      const key = collectionActionsModal.collectionKey;
      const c = state.collections.find((x) => x.key === key);
      if (!key || !c || !(c.nfts || []).length) return;
      state.selectionModeByCollection[key] = "all";
      delete state.selectedNFTsByCollection[key];
      syncSelectedKeysFromSelection();
      syncCollectionFirstFromCoreFor(key);
      renderCollectionsList();
      syncCollectionActionsModalUi();
      const exportBtn = $("gridExportBtn");
      if (exportBtn) exportBtn.disabled = true;
      syncGridFooterButtons(!hasItemsForBuild(), true);
      renderTraitFiltersForSelected();
      updateGuideGlow();
    });

  if (btnManual)
    btnManual.addEventListener("click", () => {
      const key = collectionActionsModal.collectionKey;
      const c = state.collections.find((x) => x.key === key);
      if (!key || !c || !(c.nfts || []).length) return;
      // Reuse existing manual selection modal; close this one so focus/scroll-lock stays simple.
      closeCollectionActionsModal();
      openManualSelectionModal(key);
    });

  if (btnLogo)
    btnLogo.addEventListener("click", () => {
      const key = collectionActionsModal.collectionKey;
      const c = state.collections.find((x) => x.key === key);
      if (!key || !c) return;
      const canAddLogo = !!(c.logo && toProxyUrl(c.logo));
      if (!canAddLogo) return;
      if (state.includeCollectionLogoInBuild.has(key)) state.includeCollectionLogoInBuild.delete(key);
      else state.includeCollectionLogoInBuild.add(key);
      syncCollectionFirstFromCoreFor(key);
      renderCollectionsList();
      syncCollectionActionsModalUi();
      const exportBtn = $("gridExportBtn");
      if (exportBtn) exportBtn.disabled = true;
      syncGridFooterButtons(!hasItemsForBuild(), true);
      renderTraitFiltersForSelected();
      notifyBuildAffectedByLogoOrCollectionChange();
      updateGuideGlow();
    });

  if (btnBuild)
    btnBuild.addEventListener("click", () => {
      if (!hasItemsForBuild()) return;
      closeCollectionActionsModal();
      buildGrid(); // existing builder merges selected collections + logo + customs
    });

  return overlay;
}

function openCollectionActionsModal(collectionKey) {
  const c = state.collections.find((x) => x.key === collectionKey);
  if (!c) return;
  ensureCollectionActionsModal();
  collectionActionsModal.collectionKey = c.key;
  syncCollectionActionsModalUi();
  const overlay = collectionActionsModal.overlay;
  overlay.classList.remove("hidden");
  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
  syncBodyScrollLock();
}

function closeCollectionActionsModal() {
  const overlay = collectionActionsModal.overlay;
  if (!overlay) return;
  // Let the scale/opacity transition play, then fully hide.
  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
  collectionActionsModal.collectionKey = null;
  setTimeout(() => {
    // If it was reopened quickly, don't force-hide.
    if (overlay.classList.contains("visible")) return;
    overlay.classList.add("hidden");
    syncBodyScrollLock();
  }, 190);
}

function syncCollectionActionsModalUi() {
  const key = collectionActionsModal.collectionKey;
  const c = state.collections.find((x) => x.key === key);
  const title = document.getElementById("collectionActionsTitle");
  const summary = document.getElementById("collectionActionsSummary");
  const btnAll = document.getElementById("collectionActionsSelectAll");
  const btnManual = document.getElementById("collectionActionsSelectManual");
  const btnLogo = document.getElementById("collectionActionsLogo");
  const btnBuild = document.getElementById("collectionActionsBuild");

  if (!c) {
    if (title) title.textContent = "";
    if (summary) summary.textContent = "";
    if (btnBuild) btnBuild.disabled = true;
    return;
  }

  const displayName = shortenForDisplay(c.name) || "Collection";
  if (title) title.textContent = displayName;

  const total = c.count ?? c.nfts?.length ?? 0;
  const mode = state.selectionModeByCollection[c.key] || "none";
  const manualN = state.selectedNFTsByCollection[c.key]?.size ?? 0;
  const logoOn = state.includeCollectionLogoInBuild.has(c.key);
  const canAddLogo = !!(c.logo && toProxyUrl(c.logo));
  const hasNfts = (c.nfts || []).length > 0;

  const selText =
    mode === "all" ? "All NFTs selected" : mode === "manual" ? `${manualN} NFT${manualN === 1 ? "" : "s"} selected` : "No NFTs selected yet";
  const logoText = canAddLogo ? (logoOn ? "Logo will be included" : "Logo not included") : "No collection logo available";
  if (summary) summary.textContent = `${total} owned · ${selText} · ${logoText}`;

  if (btnAll) btnAll.disabled = !hasNfts;
  if (btnManual) btnManual.disabled = !hasNfts;
  if (btnLogo) {
    btnLogo.disabled = !canAddLogo;
    btnLogo.setAttribute("aria-pressed", logoOn ? "true" : "false");
    btnLogo.textContent = logoOn ? "🗑️ Remove Collection Logo" : "🖼️ Add Collection Logo";
  }

  // Global build button reflects multi-collection selection.
  if (btnBuild) btnBuild.disabled = !hasItemsForBuild();
}

function renderCollectionsList() {
  const wrap = $("collectionsList");
  if (!wrap) return;

  wrap.innerHTML = "";
  syncSelectedKeysFromSelection();
  syncCollectionFirstFromCoreAll();

  // Collection-first: render cards; clicking a card opens a modal with actions.
  const grid = document.createElement("div");
  grid.className = "collection-grid";

  state.collections.forEach((c) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "collection-card";
    card.dataset.collectionKey = String(c.key || "").trim().toLowerCase();

    const count = c.count ?? c.nfts?.length ?? 0;
    const displayName = shortenForDisplay(c.name) || "Unknown Collection";
    const hasNfts = (c.nfts || []).length > 0;
    const mode = state.selectionModeByCollection[c.key] || "none";
    const selectedManualN = state.selectedNFTsByCollection[c.key]?.size ?? 0;
    const logoOn = state.includeCollectionLogoInBuild.has(c.key);
    const isSelected = mode !== "none" || logoOn;

    // Edge-case: collections with no NFTs can't be selected.
    if (!hasNfts) {
      card.disabled = true;
      card.title = "No NFTs found for this collection";
      card.classList.add("collection-card--disabled");
    }

    if (state.selectedKeys.has(c.key)) card.classList.add("selected");
    if (mode === "manual" && selectedManualN > 0) card.classList.add("collection-card--manualPicks");

    // Quick "Remove" so users can unselect without opening the modal.
    if (isSelected) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "collection-card-remove";
      removeBtn.textContent = "✖ Remove";
      removeBtn.title = "Remove this collection from selection";
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const k = c.key;
        state.selectionModeByCollection[k] = "none";
        delete state.selectedNFTsByCollection[k];
        state.includeCollectionLogoInBuild.delete(k);
        syncSelectedKeysFromSelection();
        syncCollectionFirstFromCoreFor(k);
        renderCollectionsList();
        const exportBtn = $("gridExportBtn");
        if (exportBtn) exportBtn.disabled = true;
        syncGridFooterButtons(!hasItemsForBuild(), true);
        renderTraitFiltersForSelected();
        notifyBuildAffectedByLogoOrCollectionChange();
        updateGuideGlow();
      });
      card.appendChild(removeBtn);
      card.classList.add("collection-card--hasRemove");
    }

    const logoWrap = buildCollectionLogoThumb(c);
    logoWrap.classList.add("collection-card-logo");

    const name = document.createElement("div");
    name.className = "collection-card-name";
    name.textContent = displayName;

    const meta = document.createElement("div");
    meta.className = "collection-card-meta";

    const countEl = document.createElement("span");
    countEl.className = "collection-card-count";
    countEl.textContent = `${count}`;

    const suffix = getCollectionSelectionInlineSuffix(c);
    const selEl = document.createElement("span");
    selEl.className = "collection-card-selection";
    selEl.textContent =
      suffix ||
      (mode === "none"
        ? "Tap to choose"
        : mode === "all"
          ? "All selected"
          : `${selectedManualN} selected`);

    meta.appendChild(countEl);
    meta.appendChild(selEl);

    card.appendChild(logoWrap);
    card.appendChild(name);
    card.appendChild(meta);

    card.addEventListener("click", () => {
      if (!hasNfts) return;
      openCollectionActionsModal(c.key);
    });

    grid.appendChild(card);
  });

  wrap.appendChild(grid);

  maybeRefreshManualModalGrid();
  syncManualSelectionModalHeader();
  renderTraitFiltersForSelected();
}

function setAllCollections(checked) {
  if (checked) {
    for (const c of state.collections) {
      if ((c.nfts || []).length === 0) continue;
      state.selectionModeByCollection[c.key] = "all";
      delete state.selectedNFTsByCollection[c.key];
    }
  } else {
    resetCollectionSelectionState();
  }
  syncSelectedKeysFromSelection();
  renderCollectionsList();

  const buildBtn = $("gridBuildBtn");
  const exportBtn = $("gridExportBtn");
  if (buildBtn) buildBtn.disabled = !hasItemsForBuild();
  if (exportBtn) exportBtn.disabled = true;
  syncGridFooterButtons(!hasItemsForBuild(), true);

  updateGuideGlow();
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

/** Update trait sort state when dropdown changes. Instantly reorders grid. */
function onTraitChange(collectionKey, trait) {
  state.selectedSortByCollection[collectionKey] = trait;
  updateGrid();
  setBuildGridNeedsRebuild(false);
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
  const nftTileCount = queryAllGridTiles().filter(
    (c) => c.classList.contains("tile") && (c.dataset.kind === "nft" || c.dataset.kind === "missing")
  ).length;
  if (!hasItemsForBuild()) return;
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

  syncGridCollectionOrderFromSelection();
  const ordered = orderCollectionsForGrid(chosen);

  ordered.forEach((c) => {
    const traitsByType = buildTraitsByCollection(c);
    const traitTypes = Object.keys(traitsByType).sort();

    const block = document.createElement("div");
    block.className = "collection-trait-control";
    block.dataset.collectionKey = c.key;

    const dragRow = document.createElement("div");
    dragRow.className = "collection-trait-dragRow";
    dragRow.draggable = true;
    dragRow.dataset.collectionKey = c.key;
    dragRow.title = "Drag to reorder this collection’s block in the grid";

    const handle = document.createElement("span");
    handle.className = "collection-trait-dragHandle";
    handle.textContent = "⋮⋮";
    handle.setAttribute("aria-hidden", "true");

    const nameEl = document.createElement("div");
    nameEl.className = "collection-name";
    nameEl.textContent = shortenForDisplay(c.name) || "Collection";

    dragRow.appendChild(handle);
    dragRow.appendChild(nameEl);

    const select = document.createElement("select");
    select.className = "input trait-type";
    select.dataset.key = c.key;
    select.draggable = false;

    const toTitleCase = (s) =>
      !s ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const options = [
      { value: "", label: "Original" },
      { value: "__random__", label: "Random" },
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

    block.appendChild(dragRow);
    block.appendChild(select);
    container.appendChild(block);
  });
}

const TRAIT_ORDER_DRAG_MIME = "application/x-flexgrid-collection-key";

function installTraitOrderDragHandlers() {
  const el = document.getElementById("collectionTraitControls");
  if (!el || el._traitOrderDragInstalled) return;
  el._traitOrderDragInstalled = true;

  el.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".collection-trait-dragRow");
    if (!row || !el.contains(row)) return;
    const key = row.dataset.collectionKey;
    if (!key) return;
    try {
      e.dataTransfer.setData(TRAIT_ORDER_DRAG_MIME, key);
      e.dataTransfer.setData("text/plain", key);
      e.dataTransfer.effectAllowed = "move";
    } catch (_) {}
    row.closest(".collection-trait-control")?.classList.add("collection-trait-control--dragging");
  });

  el.addEventListener("dragend", () => {
    el.querySelectorAll(".collection-trait-control--dragging, .collection-trait-control--dropTarget").forEach((node) => {
      node.classList.remove("collection-trait-control--dragging", "collection-trait-control--dropTarget");
    });
  });

  el.addEventListener("dragover", (e) => {
    const block = e.target.closest(".collection-trait-control");
    if (!block || !el.contains(block)) return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "move";
    } catch (_) {}
    el.querySelectorAll(".collection-trait-control--dropTarget").forEach((n) => n.classList.remove("collection-trait-control--dropTarget"));
    block.classList.add("collection-trait-control--dropTarget");
  });

  el.addEventListener("drop", (e) => {
    const block = e.target.closest(".collection-trait-control");
    if (!block || !el.contains(block)) return;
    e.preventDefault();
    el.querySelectorAll(".collection-trait-control--dropTarget").forEach((n) => n.classList.remove("collection-trait-control--dropTarget"));
    let fromKey = "";
    try {
      fromKey = e.dataTransfer.getData(TRAIT_ORDER_DRAG_MIME) || e.dataTransfer.getData("text/plain");
    } catch (_) {}
    const toKey = block.dataset.collectionKey;
    if (!fromKey || !toKey) return;
    reorderGridCollectionKeys(fromKey, toKey);
    renderTraitFiltersForSelected();
    setBuildGridNeedsRebuild(false);
    updateGrid();
    setStatus("↕️ Collection blocks reordered in the grid");
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

const RANDOM_TRAIT_VALUE = "__random__";

function sortCollection(nfts, trait) {
  if (!nfts?.length) return nfts || [];
  if (!trait) return nfts;

  if (trait === RANDOM_TRAIT_VALUE) {
    const arr = [...nfts];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

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

function collectionLogoGridItemId(contractKey) {
  return `logo_${String(contractKey || "").trim().toLowerCase()}`;
}

/** One grid item for a collection’s proxied OpenSea/contract logo (not token art). */
function makeCollectionLogoGridItem(collection) {
  if (!collection?.logo || !collection.key) return null;
  const proxied = toProxyUrl(collection.logo);
  if (!proxied) return null;
  const addr = String(collection.key).trim().toLowerCase();
  return {
    id: collectionLogoGridItemId(addr),
    image: proxied,
    isCustom: true,
    isLogo: true,
    collectionKey: addr,
    sourceKey: addr,
    name: `${shortenForDisplay(collection.name) || "Collection"} logo`,
    contract: addr,
    tokenId: "",
  };
}

/** Apply per-collection trait sorting. Returns flat array of grid items.
 *  IMPORTANT: Each collection stays in its own block — never interleaved.
 *  When “Add logo” is on for a collection, that logo is the first tile in that block. */
function getSortedItemsForGrid(selectedCollections) {
  const all = [];
  for (const collection of selectedCollections) {
    const ck = collection.key;
    if (state.includeCollectionLogoInBuild.has(ck)) {
      const logoItem = makeCollectionLogoGridItem(collection);
      if (logoItem) all.push(logoItem);
    }
    const trait = state.selectedSortByCollection[ck] || "";
    const sorted = sortCollection(collection.nfts || [], trait);
    for (const nft of sorted) {
      const item = nftToGridItem(nft, ck);
      all.push(item);
    }
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
      if (!existing.logo && newCol.logo) existing.logo = newCol.logo;
      if (!existing.logo) {
        for (const nft of existing.nfts) {
          const u = extractCollectionLogoRawUrlFromNft(nft);
          if (u) {
            existing.logo = u;
            break;
          }
        }
      }
    } else {
      state.collections.push(newCol);
      state.collections.sort((a, b) => (b.nfts?.length ?? 0) - (a.nfts?.length ?? 0));
    }

    renderCollectionsList();
    queueCollectionLogoFetches();
    setAddStatus(`Added ${newCol.name}: ${newCol.count} NFT(s) ✅`);
    const inputEl = $("addContractInput");
    if (inputEl) inputEl.value = "";
  } catch (err) {
    setAddStatus("Error: " + (err?.message || "Could not add collection."));
    addError(err, "Add Collection by Contract");
  }
}

// ---------- Grid helpers ----------
function syncGridCollectionOrderFromSelection() {
  const chosen = getSelectedCollections();
  const keys = chosen.map((c) => c.key);
  const prev = state.gridCollectionOrder || [];
  const next = prev.filter((k) => keys.includes(k));
  for (const k of keys) {
    if (!next.includes(k)) next.push(k);
  }
  state.gridCollectionOrder = next;
}

function orderCollectionsForGrid(collections) {
  if (!collections?.length) return collections;
  const order = state.gridCollectionOrder || [];
  const keySet = new Set(collections.map((c) => c.key));
  const rank = new Map();
  order.forEach((k, i) => {
    if (keySet.has(k)) rank.set(k, i);
  });
  let max = order.length;
  for (const c of collections) {
    if (!rank.has(c.key)) {
      rank.set(c.key, max);
      max++;
    }
  }
  return [...collections].sort((a, b) => rank.get(a.key) - rank.get(b.key));
}

function reorderGridCollectionKeys(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const arr = [...(state.gridCollectionOrder || [])];
  const fi = arr.indexOf(fromKey);
  const ti = arr.indexOf(toKey);
  if (fi === -1 || ti === -1) return;
  arr.splice(fi, 1);
  const ti2 = arr.indexOf(toKey);
  arr.splice(ti2, 0, fromKey);
  state.gridCollectionOrder = arr;
}

function flattenItems(chosen) {
  return getSortedItemsForGrid(orderCollectionsForGrid(chosen));
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
syncOrderedItemsFromGrid();

function getGridChoice() {
  const v = $("gridSize")?.value || "auto";

  if (v === "custom") {
    const cols = clampInt($("customCols")?.value, 2, 50, 6);
    const rows = clampInt($("customRows")?.value, 2, 50, 6);
    const side = Math.max(cols, rows);
    const cap = side * side;
    return { mode: "fixed", cap, rows: side, cols: side };
  }

  if (v === "auto") return { mode: "auto" };

  const capHint = Math.max(1, Number(v));
  const side = Math.ceil(Math.sqrt(capHint));
  const cap = side * side;
  return { mode: "fixed", cap, rows: side, cols: side };
}

/** Registry of collage layouts. Add entries with type "template" + slots, or type "grid" for classic. */
const LAYOUTS = {
  classic: {
    name: "Classic Grid",
    type: "grid",
  },
  /** All template slots use square spans only: w === h (1, 2, or 3). */
  hero: {
    name: "Hero",
    comingSoon: true,
    type: "template",
    columns: 3,
    rows: 3,
    slots: [
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 2, y: 0, w: 1, h: 1 },
      { x: 2, y: 1, w: 1, h: 1 },
      { x: 0, y: 2, w: 1, h: 1 },
      { x: 1, y: 2, w: 1, h: 1 },
      { x: 2, y: 2, w: 1, h: 1 },
    ],
  },
  /** Two medium (2×2) squares side by side on a 4×2 track grid. */
  split: {
    name: "Split",
    comingSoon: true,
    type: "template",
    columns: 4,
    rows: 2,
    slots: [
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 2, y: 0, w: 2, h: 2 },
    ],
  },
  /** Four medium (2×2) tiles in a 4×4 mosaic. */
  mixed: {
    name: "Mixed",
    comingSoon: true,
    type: "template",
    columns: 4,
    rows: 4,
    slots: [
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 2, y: 0, w: 2, h: 2 },
      { x: 0, y: 2, w: 2, h: 2 },
      { x: 2, y: 2, w: 2, h: 2 },
    ],
  },
};

function assertSquareTemplateSlots() {
  for (const id of Object.keys(LAYOUTS)) {
    const L = LAYOUTS[id];
    if (L.type !== "template" || !L.slots) continue;
    for (const s of L.slots) {
      if (s.w !== s.h) {
        console.error(`[LAYOUTS] "${id}" has non-square slot (w must equal h):`, s);
      }
    }
  }
}
assertSquareTemplateSlots();

function getSquareSlotsForLayout(layout) {
  if (layout.type !== "template" || !layout.slots) return [];
  return layout.slots.filter((s) => s && s.w === s.h && s.w > 0);
}

function getLayoutDefinition(layoutId) {
  const id = layoutId && LAYOUTS[layoutId] ? layoutId : "classic";
  return LAYOUTS[id];
}

/** Prefer classic when very few NFTs and user picked a rich template (optional auto-fit). */
function resolveBuildLayoutId(itemCount, requestedId) {
  const def = getLayoutDefinition(requestedId);
  if (def.comingSoon) return "classic";
  if (def.type === "grid") return "classic";
  const slotCount = getSquareSlotsForLayout(def).length;
  if (itemCount === 0) return "classic";
  if (itemCount > 0 && itemCount <= 2 && requestedId !== "classic") return "classic";
  if (itemCount < 3 && slotCount > 4 && requestedId !== "classic") return "classic";
  return requestedId;
}

function applySlotToTile(tile, slot) {
  if (!slot || slot.w !== slot.h) return;
  tile.style.gridColumn = `${slot.x + 1} / span ${slot.w}`;
  tile.style.gridRow = `${slot.y + 1} / span ${slot.h}`;
}

function clearTileGridPlacement(tile) {
  tile.style.gridColumn = "";
  tile.style.gridRow = "";
}

function prepareGridForTemplate(grid, layout) {
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${layout.columns}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${layout.rows}, minmax(0, 1fr))`;
  grid.style.gap = "0";
  grid.style.aspectRatio = `${layout.columns} / ${layout.rows}`;
  grid.style.width = "100%";
  grid.dataset.layoutMode = "template";
}

function prepareGridForClassic(grid, cols, rows) {
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const r = rows != null && rows > 0 ? rows : cols;
  grid.style.gridTemplateRows = `repeat(${r}, minmax(0, 1fr))`;
  grid.style.gap = "0";
  grid.style.aspectRatio = `${cols} / ${r}`;
  grid.style.width = "100%";
  grid.dataset.layoutMode = "classic";
}

function clearAllGrids() {
  const p = getGridPrimary();
  const o = getGridOverflow();
  if (p) p.innerHTML = "";
  if (o) o.innerHTML = "";
}

function showGridOverflow(show) {
  const o = getGridOverflow();
  if (!o) return;
  o.style.display = show ? "grid" : "none";
  o.setAttribute("aria-hidden", show ? "false" : "true");
}

/**
 * Classic grid dimensions.
 * When settingsAutoFillEmpty: square ⌈√n⌉ × ⌈√n⌉ (extra filler tiles).
 * Otherwise: minimum rectangle ⌈√n⌉ columns × ⌈n/cols⌉ rows.
 */
function computeGridDimensionsForCount(count) {
  const n = Math.max(1, count);
  const autoFill = state.settingsAutoFillEmpty !== false;
  const cols = Math.ceil(Math.sqrt(n));
  if (!autoFill) {
    const rows = Math.ceil(n / cols);
    return { cols, rows, totalSlots: cols * rows };
  }
  const side = Math.ceil(Math.sqrt(n));
  return { cols: side, rows: side, totalSlots: side * side };
}

function setTileDraggableForLayout(tile) {
  try {
    tile.draggable = false;
    tile.removeAttribute("draggable");
  } catch (_) {}
}

function syncLayoutPickerActiveStates() {
  for (const wrapId of ["layoutPickerBtns", "stageLayoutPickerBtns", "settingsLayoutPicker"]) {
    const wrap = $(wrapId);
    if (!wrap) continue;
    wrap.querySelectorAll(".layoutPickerBtn, .settings-layout-btn").forEach((b) => {
      b.classList.toggle("layoutPickerBtn--active", b.dataset.layoutId === state.selectedLayout);
    });
  }
}

/** Shared by collections bar, stage bar, and settings drawer */
function onUserSelectLayout(id) {
  if (!LAYOUTS[id] || LAYOUTS[id].comingSoon) return;
  state.selectedLayout = id;
  if (LAYOUTS[state.selectedLayout]?.comingSoon) state.selectedLayout = "classic";
  syncLayoutPickerActiveStates();
  if (state.currentGridItems?.length && currentStep === 3) {
    BUILD_ID = Date.now();
    renderFullLayoutFromItems(state.currentGridItems.slice(), state.selectedLayout, BUILD_ID);
    enableDragDrop();
    if (state.imageLoadState.total > 0) updateImageProgress();
    requestAnimationFrame(syncWatermarkDOMToOneTile);
  } else {
    setBuildGridNeedsRebuild(true);
  }
  renderSettingsPanel();
}

function syncBodyScrollLock() {
  const manualOpen = manualModal.overlay && !manualModal.overlay.classList.contains("hidden");
  if (manualOpen || state.isSettingsOpen) document.body.style.overflow = "hidden";
  else document.body.style.overflow = "";
}

function applySettingsToLiveGrids() {
  const gapMap = { none: "0px", small: "4px", medium: "10px", large: "18px" };
  const g = gapMap[state.settingsGridSpacing] || "0px";
  const gridWrap = document.querySelector(".gridWrap");
  if (gridWrap) gridWrap.style.setProperty("--flexGridGap", g);

  const primary = getGridPrimary();
  const overflow = getGridOverflow();

  const stack = $("gridStack");
  if (stack) {
    stack.classList.toggle("gridStack--tileBorders", !!state.settingsTileBorder);
  }

  const meta = state.gridLayoutMeta;
  const keepSq = state.settingsKeepGridSquare !== false;
  if (primary && meta?.mode === "classic" && meta.columns && meta.rows) {
    primary.style.aspectRatio = keepSq ? `${meta.columns} / ${meta.rows}` : "auto";
  }
  if (overflow && overflow.style.display !== "none" && meta?.overflowCols && meta.overflowRows) {
    overflow.style.aspectRatio = keepSq ? `${meta.overflowCols} / ${meta.overflowRows}` : "auto";
  }
  if (primary && meta?.mode === "template") {
    const L = LAYOUTS[meta.layoutId];
    if (L && L.columns && L.rows) {
      primary.style.aspectRatio = keepSq ? `${L.columns} / ${L.rows}` : "auto";
    }
  }

  const stage = $("stage");
  if (stage) {
    stage.classList.toggle("settings-canvas--light", state.settingsCanvasBg === "light");
    stage.classList.toggle("settings-canvas--dark", state.settingsCanvasBg === "dark");
  }
}

function syncStageCaptionOverlay() {
  const el = $("stageCaptionOverlay");
  if (!el) return;
  const text = state.settingsStageCaption || "";
  el.textContent = text;
  el.hidden = !text;
  el.classList.toggle("stageCaptionOverlay--shadow", !!state.settingsTextShadow && !!text);
}

function promptAddStageCaption() {
  const cur = state.settingsStageCaption || "";
  const next = window.prompt("Caption text (shown on your collage preview):", cur);
  if (next === null) return;
  state.settingsStageCaption = next.trim();
  syncStageCaptionOverlay();
  renderSettingsPanel();
}

function clearAllCustomImages() {
  for (const item of state.customImages || []) {
    if (typeof item.image === "string" && item.image.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(item.image);
      } catch (_) {}
    }
  }
  state.customImages = [];
  state.selectedCustomImageIds.clear();
  renderCustomImagesPanel();
  updateBuildButtonAvailability();
  updateGuideGlow();
  setStatus("Custom images cleared");
  renderSettingsPanel();
}

function rebuildClassicFromDenseForSettings() {
  if (currentStep !== 3 || !state.currentGridItems?.length) return;
  if (state.gridLayoutMeta?.mode !== "classic") return;
  const dense = state.currentGridItems.filter((it) => !isGridSlotEmpty(it));
  BUILD_ID = Date.now();
  renderFullLayoutFromItems(dense, "classic", BUILD_ID);
  enableDragDrop();
  if (state.imageLoadState.total > 0) updateImageProgress();
  requestAnimationFrame(syncWatermarkDOMToOneTile);
}

let settingsPanelBound = false;

function ensureSettingsPanel() {
  if (document.getElementById("settingsPanel")) return;

  const overlay = document.createElement("div");
  overlay.id = "settingsOverlay";
  overlay.className = "settings-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const panel = document.createElement("aside");
  panel.id = "settingsPanel";
  panel.className = "settings-panel";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <div class="settings-panel-header">
      <h2 class="settings-panel-title">Settings</h2>
      <button type="button" class="settings-panel-close" id="settingsPanelClose" aria-label="Close settings">×</button>
    </div>
    <div class="settings-panel-scroll">
      <section class="settings-section">
        <h3 class="settings-section-title">About</h3>
        <p class="settings-about-line">FlexGrid ${APP_SETTINGS_VERSION}</p>
        <p class="settings-about-sub">Built in real time 👊</p>
      </section>
      <section class="settings-section">
        <h3 class="settings-section-title">Canvas</h3>
        <p class="settings-hint">Background (stage behind grid)</p>
        <div class="settings-segment" role="group" aria-label="Stage background">
          <button type="button" class="settings-seg-btn" data-settings-canvas="theme">Theme</button>
          <button type="button" class="settings-seg-btn" data-settings-canvas="light">White</button>
          <button type="button" class="settings-seg-btn" data-settings-canvas="dark">Black</button>
        </div>
        <p class="settings-hint">Spacing between tiles</p>
        <div class="settings-segment" role="group" aria-label="Grid spacing">
          <button type="button" class="settings-seg-btn" data-settings-spacing="none">None</button>
          <button type="button" class="settings-seg-btn" data-settings-spacing="small">S</button>
          <button type="button" class="settings-seg-btn" data-settings-spacing="medium">M</button>
          <button type="button" class="settings-seg-btn" data-settings-spacing="large">L</button>
        </div>
        <label class="settings-toggle"><input type="checkbox" id="settingsTileBorder" /> Tile borders</label>
      </section>
      <section class="settings-section">
        <h3 class="settings-section-title">Grid / layout</h3>
        <p class="settings-hint">Layout</p>
        <div class="settings-layout-picker" id="settingsLayoutPicker" role="group" aria-label="Layout from settings"></div>
        <label class="settings-toggle"><input type="checkbox" id="settingsKeepSquare" checked /> Keep grid square</label>
        <label class="settings-toggle"><input type="checkbox" id="settingsAutoFill" checked /> Auto-fill empty spaces (classic)</label>
      </section>
      <section class="settings-section">
        <h3 class="settings-section-title">Import</h3>
        <button type="button" class="btn btnSmall settings-fullbtn" id="settingsImportBtn">Import Image / Logo</button>
        <button type="button" class="btn btnSmall settings-fullbtn settings-btn-muted" id="settingsClearCustomBtn">Clear Custom Images</button>
      </section>
      <section class="settings-section">
        <h3 class="settings-section-title">Text</h3>
        <button type="button" class="btn btnSmall settings-fullbtn" id="settingsAddTextBtn">Add / edit caption</button>
        <label class="settings-toggle"><input type="checkbox" id="settingsTextShadow" checked /> Text shadow</label>
      </section>
      <section class="settings-section">
        <h3 class="settings-section-title">Feedback</h3>
        <p class="settings-about-line">FlexGrid ${APP_SETTINGS_VERSION}</p>
        <p class="settings-about-sub">We’re building this in real time 🙌</p>
        <a class="settings-linkbtn" href="mailto:Littleollienft@gmail.com?subject=FlexGrid%20feature%20idea">💡 Suggest Feature</a>
        <a class="settings-linkbtn" href="mailto:Littleollienft@gmail.com?subject=FlexGrid%20bug%20report">🐛 Report Issue</a>
      </section>
    </div>`;

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  overlay.addEventListener("click", () => closeSettings());
  panel.addEventListener("click", (e) => e.stopPropagation());

  const fillLayoutPicker = () => {
    const wrap = $("settingsLayoutPicker");
    if (!wrap) return;
    wrap.innerHTML = "";
    for (const id of Object.keys(LAYOUTS)) {
      const def = LAYOUTS[id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btnSmall layoutPickerBtn settings-layout-btn";
      btn.dataset.layoutId = id;
      if (def.comingSoon) {
        btn.textContent = `${def.name} · soon`;
        btn.disabled = true;
        btn.classList.add("layoutPickerBtn--soon");
      } else {
        btn.textContent = def.name;
        btn.addEventListener("click", () => onUserSelectLayout(id));
      }
      wrap.appendChild(btn);
    }
  };
  fillLayoutPicker();

  if (!settingsPanelBound) {
    settingsPanelBound = true;
    panel.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.id === "settingsTileBorder") {
        state.settingsTileBorder = t.checked;
        applySettingsToLiveGrids();
      }
      if (t.id === "settingsKeepSquare") {
        state.settingsKeepGridSquare = t.checked;
        applySettingsToLiveGrids();
      }
      if (t.id === "settingsAutoFill") {
        state.settingsAutoFillEmpty = t.checked;
        rebuildClassicFromDenseForSettings();
      }
      if (t.id === "settingsTextShadow") {
        state.settingsTextShadow = t.checked;
        syncStageCaptionOverlay();
      }
    });

    panel.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.dataset.settingsCanvas) {
        state.settingsCanvasBg = t.dataset.settingsCanvas;
        applySettingsToLiveGrids();
        renderSettingsPanel();
      }
      if (t.dataset.settingsSpacing) {
        state.settingsGridSpacing = t.dataset.settingsSpacing;
        applySettingsToLiveGrids();
        renderSettingsPanel();
      }
    });

    const closeBtn = $("settingsPanelClose");
    if (closeBtn) closeBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeSettings();
    });

    const imp = $("settingsImportBtn");
    const fileInput = $("importImageInput");
    if (imp && fileInput) imp.addEventListener("click", () => fileInput.click());

    const clr = $("settingsClearCustomBtn");
    if (clr) clr.addEventListener("click", () => clearAllCustomImages());

    const addTxt = $("settingsAddTextBtn");
    if (addTxt) addTxt.addEventListener("click", () => promptAddStageCaption());
  }
}

function renderSettingsPanel() {
  const panel = $("settingsPanel");
  const overlay = $("settingsOverlay");
  const btn = $("settingsBtn");
  if (!panel || !overlay) return;

  if (state.isSettingsOpen) {
    panel.classList.add("open");
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");
    panel.setAttribute("aria-hidden", "false");
    if (btn) btn.setAttribute("aria-expanded", "true");
  } else {
    panel.classList.remove("open");
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
    panel.setAttribute("aria-hidden", "true");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  syncBodyScrollLock();

  panel.querySelectorAll("[data-settings-canvas]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.classList.toggle("settings-seg-btn--on", el.dataset.settingsCanvas === state.settingsCanvasBg);
  });
  panel.querySelectorAll("[data-settings-spacing]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.classList.toggle("settings-seg-btn--on", el.dataset.settingsSpacing === state.settingsGridSpacing);
  });

  const tb = $("settingsTileBorder");
  if (tb) tb.checked = !!state.settingsTileBorder;
  const ks = $("settingsKeepSquare");
  if (ks) ks.checked = state.settingsKeepGridSquare !== false;
  const af = $("settingsAutoFill");
  if (af) af.checked = state.settingsAutoFillEmpty !== false;
  const ts = $("settingsTextShadow");
  if (ts) ts.checked = state.settingsTextShadow !== false;

  syncLayoutPickerActiveStates();
}

function toggleSettings() {
  ensureSettingsPanel();
  state.isSettingsOpen = !state.isSettingsOpen;
  renderSettingsPanel();
}

function closeSettings() {
  state.isSettingsOpen = false;
  renderSettingsPanel();
}

function renderLayoutPicker() {
  const wrap = $("layoutPickerBtns");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const id of Object.keys(LAYOUTS)) {
    const def = LAYOUTS[id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btnSmall layoutPickerBtn";
    btn.dataset.layoutId = id;
    if (def.comingSoon) {
      btn.textContent = `${def.name} · coming soon`;
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.title = "Coming soon";
      btn.classList.add("layoutPickerBtn--soon");
    } else {
      btn.textContent = def.name;
      btn.addEventListener("click", () => onUserSelectLayout(id));
    }
    wrap.appendChild(btn);
  }
  if (LAYOUTS[state.selectedLayout]?.comingSoon) state.selectedLayout = "classic";
  syncLayoutPickerActiveStates();
}

/** Live layout switch on grid screen — no re-fetch, uses current item order. */
function renderStageLayoutPicker() {
  const wrap = $("stageLayoutPickerBtns");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const id of Object.keys(LAYOUTS)) {
    const def = LAYOUTS[id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btnSmall layoutPickerBtn";
    btn.dataset.layoutId = id;
    if (def.comingSoon) {
      btn.textContent = `${def.name} · coming soon`;
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.title = "Coming soon";
      btn.classList.add("layoutPickerBtn--soon");
    } else {
      btn.textContent = def.name;
      btn.addEventListener("click", () => onUserSelectLayout(id));
    }
    wrap.appendChild(btn);
  }
  if (LAYOUTS[state.selectedLayout]?.comingSoon) state.selectedLayout = "classic";
  syncLayoutPickerActiveStates();
}

function updateBuildButtonAvailability() {
  const ok = hasItemsForBuild();
  const buildBtn = $("gridBuildBtn");
  if (buildBtn) buildBtn.disabled = !ok;
  const exp = $("gridExportBtn");
  syncGridFooterButtons(!ok, exp ? exp.disabled : true);
}

function renderCustomImagesPanel() {
  const list = $("customImagesList");
  if (!list) return;
  list.innerHTML = "";
  for (const item of state.customImages || []) {
    const card = document.createElement("div");
    const selected = state.selectedCustomImageIds.has(item.id);
    card.className =
      "customImageCard customImageCard--import" + (selected ? " customImageCard--selected" : "");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.setAttribute("aria-pressed", selected ? "true" : "false");

    const removeX = document.createElement("button");
    removeX.type = "button";
    removeX.className = "customImageCardRemove";
    removeX.setAttribute("aria-label", "Remove image");
    removeX.textContent = "×";
    removeX.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (typeof item.image === "string" && item.image.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.image);
        } catch (_) {}
      }
      state.customImages = (state.customImages || []).filter((x) => x.id !== item.id);
      state.selectedCustomImageIds.delete(item.id);
      renderCustomImagesPanel();
      updateBuildButtonAvailability();
      updateGuideGlow();
    });
    card.appendChild(removeX);

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "customImageCardThumb";
    const thumb = document.createElement("img");
    thumb.src = item.image;
    thumb.alt = item.name || "";
    thumb.draggable = false;
    thumbWrap.appendChild(thumb);
    if (item.isLogo) {
      const badge = document.createElement("span");
      badge.className = "customImageCardBadgeLogo";
      badge.textContent = "Logo";
      thumbWrap.appendChild(badge);
    }
    card.appendChild(thumbWrap);

    const hint = document.createElement("div");
    hint.className = "customImageCardHint";
    hint.textContent = selected ? "Selected" : "Tap to select";
    card.appendChild(hint);

    const toggleSelect = () => {
      if (state.selectedCustomImageIds.has(item.id)) state.selectedCustomImageIds.delete(item.id);
      else state.selectedCustomImageIds.add(item.id);
      renderCustomImagesPanel();
      updateBuildButtonAvailability();
      updateGuideGlow();
    };
    card.addEventListener("click", (e) => {
      if (e.target.closest(".customImageCardRemove")) return;
      toggleSelect();
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleSelect();
      }
    });

    list.appendChild(card);
  }
}

function addCustomImagesFromFileList(fileList) {
  const files = Array.from(fileList || []).filter((f) => f && f.type && f.type.startsWith("image/"));
  if (!files.length) return 0;
  for (const f of files) {
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const url = URL.createObjectURL(f);
    state.customImages.push({
      id,
      image: url,
      isCustom: true,
      name: f.name || "Image",
      sourceKey: "custom",
    });
    state.selectedCustomImageIds.add(id);
  }
  renderCustomImagesPanel();
  updateBuildButtonAvailability();
  updateGuideGlow();
  return files.length;
}

/** Append items from merged selection that are not already on the grid (e.g. new imports). */
function appendNewItemsToCurrentGridFromSelection() {
  const current = state.currentGridItems;
  if (!Array.isArray(current) || current.length === 0) return false;
  const denseCur = current.filter((it) => !isGridSlotEmpty(it));
  const keys = new Set(
    denseCur.map((it) => getGridItemKey(it)).filter(Boolean)
  );
  let merged = getMergedSortedGridItems();
  if (merged.length > FLEX_GRID_MAX_NFTS) {
    merged = merged.slice(0, FLEX_GRID_MAX_NFTS);
  }
  const additions = merged.filter((it) => !keys.has(getGridItemKey(it)));
  if (!additions.length) return false;
  state.currentGridItems = denseCur.concat(additions);
  syncOrderedItemsFromGrid();
  return true;
}

function finalizeCustomImageImport(addedCount) {
  if (!addedCount) return;
  if (currentStep === 3 && queryAllGridTiles().length > 0) {
    if (appendNewItemsToCurrentGridFromSelection()) {
      reapplyLayoutAfterOrderChange();
      setStatus(`✅ Added ${addedCount} image(s) to your grid`);
      return;
    }
  }
  setStatus(`✅ Added ${addedCount} image(s) — selected for build`);
}

function updateImageTotalsAfterGridBuild(usedItems) {
  const nftsWithImages = usedItems.filter((item) => item?.image);
  state.imageLoadState.total = nftsWithImages.length;
}

// ---------- Progressive grid rendering ----------
const INITIAL_TILE_COUNT = 96;
const PROGRESSIVE_BATCH_SIZE = 64;
const PROGRESSIVE_BATCH_DELAY_MS = 0;

/** Classic grid: padded slot list (NFTs + GRID_EMPTY_SENTINEL), length === totalSlots — no trailing filler pass. */
function scheduleProgressiveClassicPaddedGrid(grid, padded, buildId, orderIndexOffset = 0) {
  let visibleCount = Math.min(INITIAL_TILE_COUNT, padded.length);

  function addBatch() {
    if (BUILD_ID !== buildId) return;
    const end = Math.min(visibleCount + PROGRESSIVE_BATCH_SIZE, padded.length);
    for (let i = visibleCount; i < end; i++) {
      const tile = makeGridTileForClassicSlot(padded[i], String(orderIndexOffset + i));
      clearTileGridPlacement(tile);
      setTileDraggableForLayout(tile);
      grid.appendChild(tile);
    }
    visibleCount = end;
    requestAnimationFrame(syncWatermarkDOMToOneTile);
    if (visibleCount < padded.length) {
      setTimeout(addBatch, PROGRESSIVE_BATCH_DELAY_MS);
    }
  }

  if (visibleCount < padded.length) {
    setTimeout(addBatch, PROGRESSIVE_BATCH_DELAY_MS);
  }
}

function scheduleProgressiveTiles(grid, usedItems, totalSlots, buildId, orderIndexOffset = 0) {
  let visibleCount = Math.min(INITIAL_TILE_COUNT, usedItems.length);

  function addBatch() {
    if (BUILD_ID !== buildId) return;
    const end = Math.min(visibleCount + PROGRESSIVE_BATCH_SIZE, usedItems.length);
    for (let i = visibleCount; i < end; i++) {
      const tile = makeNFTTile(usedItems[i]);
      tile.dataset.orderIndex = String(orderIndexOffset + i);
      clearTileGridPlacement(tile);
      setTileDraggableForLayout(tile);
      grid.appendChild(tile);
    }
    visibleCount = end;
    requestAnimationFrame(syncWatermarkDOMToOneTile);
    if (visibleCount < usedItems.length) {
      setTimeout(addBatch, PROGRESSIVE_BATCH_DELAY_MS);
    } else {
      const remaining = totalSlots - usedItems.length;
      for (let j = 0; j < remaining; j++) {
        const filler = makeFillerTile();
        delete filler.dataset.orderIndex;
        clearTileGridPlacement(filler);
        setTileDraggableForLayout(filler);
        grid.appendChild(filler);
      }
      requestAnimationFrame(syncWatermarkDOMToOneTile);
    }
  }

  if (visibleCount < usedItems.length) {
    setTimeout(addBatch, PROGRESSIVE_BATCH_DELAY_MS);
  } else {
    const remaining = totalSlots - usedItems.length;
    for (let j = 0; j < remaining; j++) {
      const filler = makeFillerTile();
      delete filler.dataset.orderIndex;
      clearTileGridPlacement(filler);
      setTileDraggableForLayout(filler);
      grid.appendChild(filler);
    }
  }
}

/**
 * Single renderer: classic grid, or template primary + optional overflow grid for remaining items.
 * @param classicOverride — preserve column/slot count when shuffling classic layout
 */
function renderFullLayoutFromItems(items, layoutId, buildId, classicOverride = null) {
  const grid = getGridPrimary();
  const overflowEl = getGridOverflow();
  if (!grid) return;

  try {
  state.imageLoadState = {
    total: 0,
    loaded: 0,
    failed: 0,
    retrying: 0,
  };

  const layoutDef = getLayoutDefinition(layoutId);
  clearAllGrids();
  showGridOverflow(false);

  const templateSlots = layoutDef.type === "template" ? getSquareSlotsForLayout(layoutDef) : [];

  if (layoutDef.type !== "template" || !templateSlots.length) {
    const choice = getGridChoice();
    let rows;
    let cols;
    let totalSlots;
    let usedItems;
    if (classicOverride && classicOverride.cols != null && classicOverride.totalSlots != null) {
      cols = classicOverride.cols;
      totalSlots = classicOverride.totalSlots;
      rows = classicOverride.rows ?? Math.ceil(totalSlots / Math.max(1, cols));
      usedItems = items.slice(0, totalSlots);
    } else if (choice.mode === "fixed") {
      rows = choice.rows;
      cols = choice.cols;
      totalSlots = choice.cap;
      usedItems = items.slice(0, totalSlots);
    } else {
      const dim = computeGridDimensionsForCount(items.length);
      cols = dim.cols;
      rows = dim.rows;
      totalSlots = dim.totalSlots;
      usedItems = items;
    }

    const paddedClassic = buildClassicPaddedItems(usedItems, totalSlots);
    // Remove trailing fully-empty rows (pure padding) so the grid doesn't render
    // a bottom "free line" when the last tiles are empty.
    let lastNonEmptyIndex = -1;
    for (let i = paddedClassic.length - 1; i >= 0; i--) {
      if (!isGridSlotEmpty(paddedClassic[i])) {
        lastNonEmptyIndex = i;
        break;
      }
    }
    const neededRows = Math.max(1, Math.ceil((lastNonEmptyIndex + 1) / Math.max(1, cols)));
    const desiredTotalSlots = neededRows * cols;
    let trimmedPaddedClassic = paddedClassic;
    if (desiredTotalSlots < totalSlots) {
      rows = neededRows;
      totalSlots = desiredTotalSlots;
      trimmedPaddedClassic = paddedClassic.slice(0, totalSlots);
    }

    state.currentGridItems = trimmedPaddedClassic;
    state.gridLayoutMeta = {
      mode: "classic",
      layoutId: "classic",
      columns: cols,
      rows,
      totalSlots,
      primarySlotCount: null,
      overflowCols: null,
      overflowTotalSlots: null,
    };

    prepareGridForClassic(grid, cols, rows);
    const denseForLog = trimmedPaddedClassic.filter((it) => !isGridSlotEmpty(it));
    const noImageCount = denseForLog.filter((it) => !it?.image).length;
    if (DEV && noImageCount > 0) {
      console.log(`buildGrid: ${noImageCount} tile(s) have no image (using placeholder)`);
    }

    const initialCount = Math.min(INITIAL_TILE_COUNT, trimmedPaddedClassic.length);
    for (let i = 0; i < initialCount; i++) {
      const tile = makeGridTileForClassicSlot(trimmedPaddedClassic[i], String(i));
      clearTileGridPlacement(tile);
      setTileDraggableForLayout(tile);
      grid.appendChild(tile);
    }
    scheduleProgressiveClassicPaddedGrid(grid, trimmedPaddedClassic, buildId, 0);
    updateImageTotalsAfterGridBuild(denseForLog);
    syncOrderedItemsFromGrid();
    requestAnimationFrame(syncWatermarkDOMToOneTile);
    return;
  }

  const slots = templateSlots;
  const primaryItems = items.slice(0, slots.length);
  const remainingItems = items.slice(slots.length);

  state.currentGridItems = items.slice();
  state.gridLayoutMeta = {
    mode: "template",
    layoutId,
    columns: layoutDef.columns,
    rows: layoutDef.rows,
    totalSlots: slots.length,
    primarySlotCount: slots.length,
    overflowCols: null,
    overflowTotalSlots: null,
  };

  prepareGridForTemplate(grid, layoutDef);
  const noImageCountP = primaryItems.filter((it) => !it?.image).length;
  if (DEV && noImageCountP > 0) {
    console.log(`buildGrid: ${noImageCountP} primary tile(s) have no image (using placeholder)`);
  }

  for (let i = 0; i < slots.length; i++) {
    const tile = i < primaryItems.length ? makeNFTTile(primaryItems[i]) : makeFillerTile();
    if (i < primaryItems.length) tile.dataset.orderIndex = String(i);
    else delete tile.dataset.orderIndex;
    applySlotToTile(tile, slots[i]);
    setTileDraggableForLayout(tile);
    grid.appendChild(tile);
  }

  state.imageLoadState.total = items.filter((it) => it?.image).length;

  if (remainingItems.length > 0 && overflowEl) {
    showGridOverflow(true);
    const oDim = computeGridDimensionsForCount(remainingItems.length);
    const oCols = oDim.cols;
    const oRows = oDim.rows;
    const oTotalSlots = oDim.totalSlots;
    prepareGridForClassic(overflowEl, oCols, oRows);
    state.gridLayoutMeta.overflowCols = oCols;
    state.gridLayoutMeta.overflowRows = oRows;
    state.gridLayoutMeta.overflowTotalSlots = oTotalSlots;

    const slotBase = slots.length;
    const initialO = Math.min(INITIAL_TILE_COUNT, remainingItems.length);
    for (let i = 0; i < initialO; i++) {
      const t = makeNFTTile(remainingItems[i]);
      t.dataset.orderIndex = String(slotBase + i);
      clearTileGridPlacement(t);
      setTileDraggableForLayout(t);
      overflowEl.appendChild(t);
    }
    scheduleProgressiveTiles(overflowEl, remainingItems, oTotalSlots, buildId, slotBase);
  }

  syncOrderedItemsFromGrid();
  requestAnimationFrame(syncWatermarkDOMToOneTile);
  } finally {
    applySettingsToLiveGrids();
    syncStageCaptionOverlay();
  }
}

function rebuildTemplateGridFromItems(items, layoutId) {
  const layout = getLayoutDefinition(layoutId);
  if (layout.type !== "template" || !getSquareSlotsForLayout(layout).length) return;
  BUILD_ID = Date.now();
  renderFullLayoutFromItems(items, layoutId, BUILD_ID);
}

function rebuildClassicGridFromItems(items, cols, rows, totalSlots) {
  BUILD_ID = Date.now();
  renderFullLayoutFromItems(items, "classic", BUILD_ID, { cols, rows, totalSlots });
}

function shuffleCurrentGridOrder() {
  const items = state.currentGridItems;
  if (!items?.length) return;
  const meta = state.gridLayoutMeta;
  let nextItems;
  if (meta?.mode === "classic" && meta.totalSlots != null) {
    const dense = items.filter((it) => !isGridSlotEmpty(it));
    if (dense.length < 2) return;
    const arr = dense.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    nextItems = buildClassicPaddedItems(arr, meta.totalSlots);
  } else {
    const arr = items.slice();
    if (arr.length < 2) return;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    nextItems = arr;
  }
  state.currentGridItems = nextItems;
  syncOrderedItemsFromGrid();
  BUILD_ID = Date.now();
  if (meta?.mode === "template" && meta.layoutId) {
    renderFullLayoutFromItems(nextItems, meta.layoutId, BUILD_ID);
  } else if (meta?.mode === "classic" && meta.columns != null && meta.totalSlots != null) {
    renderFullLayoutFromItems(nextItems, "classic", BUILD_ID, {
      cols: meta.columns,
      rows: meta.rows,
      totalSlots: meta.totalSlots,
    });
  }
  if (state.imageLoadState.total > 0) updateImageProgress();
  setStatus("🔀 Order shuffled");
}

// ---------- Build grid ----------
function buildGrid() {
  BUILD_ID = Date.now();
  const buildId = BUILD_ID;
  const exportBtn = $("gridExportBtn");

  state.imageLoadState = {
    total: 0,
    loaded: 0,
    failed: 0,
    retrying: 0,
  };
  errorLog.imageErrorCount = 0;

  if (!hasItemsForBuild()) {
    setStatus("🎯 Pick collections or custom images to build your grid!");
    if (exportBtn) exportBtn.disabled = true;
    syncGridFooterButtons(true, true);
    return;
  }

  const chosen = getSelectedCollections();

  const gridInputNfts = chosen.flatMap((c) => c.nfts || []);
  const customsDbg = getSelectedCustomsForBuild();
  if (DEV) console.log("GRID INPUT NFT COUNT", gridInputNfts.length, "custom", customsDbg.length);

  for (const c of chosen) {
    if (!state.selectedSortByCollection[c.key]) {
      const traitsByType = buildTraitsByCollection(c);
      const traitTypes = Object.keys(traitsByType);
      const bgTrait = getDefaultBackgroundTrait(traitTypes);
      if (bgTrait) state.selectedSortByCollection[c.key] = bgTrait;
    }
  }

  let items = getMergedSortedGridItems();

  if (items.length > FLEX_GRID_MAX_NFTS) {
    items = items.slice(0, FLEX_GRID_MAX_NFTS);
  }

  const requestedLayout = state.selectedLayout || "classic";
  const layoutId = resolveBuildLayoutId(items.length, requestedLayout);
  const layoutDef = getLayoutDefinition(layoutId);
  if (
    layoutId !== requestedLayout &&
    LAYOUTS[requestedLayout]?.type === "template" &&
    !LAYOUTS[requestedLayout]?.comingSoon
  ) {
    setStatus(
      `📐 Using Classic Grid — add more NFTs to use "${LAYOUTS[requestedLayout].name}" (${items.length} in selection).`
    );
  }

  const grid = getGridPrimary();
  if (!grid) return;
  const oldBar = document.getElementById("traitBar");
  if (oldBar) oldBar.remove();
  renderTraitFiltersForSelected();

  const stageTitle = $("stageTitle");
  const stageMeta = $("stageMeta");

  if (stageTitle) {
    stageTitle.innerHTML =
      `Little Ollie Flex Grid <span class="titleHint">Edit size • Drag to swap • Drop on empty slots for gaps / new lines</span>`;
  }

  if (stageMeta) stageMeta.textContent = "";

  const shuffleBtn = $("gridShuffleBtn");
  if (shuffleBtn) shuffleBtn.style.display = "";

  renderFullLayoutFromItems(items, layoutId, buildId);
  syncLayoutPickerActiveStates();

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
  goToStep(3);
}

/** Compute canonical key for item/tile matching. Must match makeNFTTile's dataset.key logic. */
function getGridItemKey(it) {
  if (!it) return "";
  if (it.isCustom && it.id) return String(it.id);
  if (it._instanceId) return String(it._instanceId);
  const contract = String(it?.contract || it?.contractAddress || "").trim().toLowerCase();
  const tokenId = String(it?.tokenId ?? "").trim();
  return contract && tokenId ? `${contract}:${tokenId}` : "";
}

/** Reorder grid tiles to match sorted items. Classic: preserve DOM. Template: rebuild slots. */
function reorderGrid() {
  if (!hasItemsForBuild()) return;

  let items = getMergedSortedGridItems();
  if (items.length > FLEX_GRID_MAX_NFTS) {
    items = items.slice(0, FLEX_GRID_MAX_NFTS);
  }

  const meta = state.gridLayoutMeta;
  if (meta?.mode === "template" && meta.layoutId) {
    rebuildTemplateGridFromItems(items, meta.layoutId);
    if (state.imageLoadState.total > 0) updateImageProgress();
    return;
  }

  const choice = getGridChoice();
  let usedItems;
  if (choice.mode === "fixed") {
    usedItems = items.slice(0, choice.cap);
  } else {
    usedItems = items;
  }

  if (meta.columns == null || meta.totalSlots == null) {
    state.currentGridItems = buildClassicPaddedItems(usedItems, usedItems.length);
    syncOrderedItemsFromGrid();
    return;
  }
  const padded = buildClassicPaddedItems(usedItems, meta.totalSlots);
  state.currentGridItems = padded;
  syncOrderedItemsFromGrid();

  BUILD_ID = Date.now();
  rebuildClassicGridFromItems(padded, meta.columns, meta.rows, meta.totalSlots);
  if (state.imageLoadState.total > 0) updateImageProgress();
  requestAnimationFrame(syncWatermarkDOMToOneTile);
}

/** Remove failed tiles and reshuffle loaded NFTs into a fresh grid. */
function removeUnloadedAndReshuffle() {
  const missing = queryAllGridTiles().filter((t) => t.classList.contains("isMissing"));
  if (missing.length === 0) {
    setStatus("✅ No unloaded tiles to remove!");
    return;
  }

  const tiles = queryAllGridTiles();
  const loadedTiles = tiles.filter((t) => t.classList.contains("isLoaded"));
  if (loadedTiles.length === 0) {
    setStatus("😕 No loaded images to keep — try Retry missing first");
    return;
  }

  const collKeyNorm = (s) => String(s || "").trim().toLowerCase();
  const keyToItem = new Map();
  for (const it of state.currentGridItems || []) {
    if (isGridSlotEmpty(it)) continue;
    const k = getGridItemKey(it);
    const collKey = collKeyNorm(it?.sourceKey);
    keyToItem.set(`${collKey}::${k}`, it);
    keyToItem.set(k, it);
  }

  const newItems = [];
  for (const t of loadedTiles) {
    const k = (t.dataset.key || "").trim();
    const collKey = collKeyNorm(t.dataset.collectionKey);
    let it = keyToItem.get(`${collKey}::${k}`);
    if (!it) it = keyToItem.get(k);
    if (it) newItems.push(it);
  }

  if (newItems.length === 0) {
    setStatus("😕 Couldn't map loaded tiles to items");
    return;
  }

  const meta = state.gridLayoutMeta;
  BUILD_ID = Date.now();
  if (meta?.mode === "template" && meta.layoutId) {
    renderFullLayoutFromItems(newItems, meta.layoutId, BUILD_ID);
  } else if (meta?.mode === "classic" && meta.columns != null && meta.totalSlots != null) {
    renderFullLayoutFromItems(newItems, "classic", BUILD_ID, {
      cols: meta.columns,
      rows: meta.rows,
      totalSlots: meta.totalSlots,
    });
  } else {
    renderFullLayoutFromItems(newItems, "classic", BUILD_ID);
  }

  enableDragDrop();

  const stageMeta = $("stageMeta");
  if (stageMeta) stageMeta.textContent = "";

  requestAnimationFrame(syncWatermarkDOMToOneTile);
  updateImageProgress();
  syncGridFooterButtons(false, false);
  setStatus(`✨ Removed ${missing.length} unloaded • ${newItems.length} item(s) reshuffled`);
  updateGuideGlow();
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

  if (DEV) {
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
  const primary = getGridPrimary();
  const retryBtn = $("retryBtn");
  if (!primary) return;
  const missing = queryAllGridTiles().filter((t) => t.classList.contains("isMissing"));
  if (missing.length === 0) {
    setStatus("✅ All good — no missing tiles to retry!");
    return;
  }

  /* Show retry-in-progress UI */
  state.imageLoadState.retrying = missing.length;
  state.imageLoadState.failed = Math.max(0, state.imageLoadState.failed - missing.length);
  if (retryBtn) {
    retryBtn.disabled = true;
    retryBtn.dataset.originalText = retryBtn.textContent;
    retryBtn.textContent = "⏳ Retrying…";
    retryBtn.classList.add("retryLoading");
  }
  missing.forEach((t) => t.classList.add("isRetrying"));
  updateImageProgress();

  const tasks = missing.map((tile) => {
    const rawUrl = tile.dataset.rawUrl;
    if (!rawUrl) return Promise.resolve();
    tile.classList.remove("isMissing");
    tile.dataset.retryCount = "0";
    tile.dataset.loadStartedAt = String(Date.now());
    let img = tile.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.crossOrigin = "anonymous";
      tile.appendChild(img);
    }
    img.src = GRID_LOADING_PLACEHOLDER_SRC;
    return loadTileImage(tile, img, rawUrl).catch(() => {});
  });
  await Promise.all(tasks);

  missing.forEach((t) => t.classList.remove("isRetrying"));
  state.imageLoadState.retrying = 0;
  if (retryBtn) {
    retryBtn.disabled = false;
    retryBtn.textContent = retryBtn.dataset.originalText || "🔄 Retry missing";
    retryBtn.classList.remove("retryLoading");
  }
  const exportRoot = $("gridStack") || primary;
  const stillMissing = exportRoot ? exportRoot.querySelectorAll(".tile.isMissing").length : 0;
  setStatus(stillMissing > 0 ? `😕 ${stillMissing} still failed` : "✅ Retry complete!");
  updateImageProgress();
}

async function loadTileImage(tile, img, rawUrl) {
  if (typeof rawUrl === "string" && rawUrl.startsWith("blob:")) {
    tile.dataset.ipfsPath = "";
    try {
      setImgCORS(img, false);
      try {
        img.removeAttribute("crossorigin");
      } catch (_) {}
      await queueImageLoad(() => loadImageWithTimeout(img, rawUrl, 12000));
      tile.dataset.src = rawUrl;
      tile.classList.remove("isMissing");
      tile.classList.add("isLoaded");
      state.imageLoadState.loaded++;
      updateImageProgress();
      return true;
    } catch (_) {
      markMissing(tile, img, rawUrl);
      state.imageLoadState.failed++;
      updateImageProgress();
      return false;
    }
  }

  tile.dataset.ipfsPath = getIpfsPath(rawUrl) || "";
  const candidates = buildImageCandidates(rawUrl);
  if (candidates.length === 0) {
    markMissing(tile, img, rawUrl);
    state.imageLoadState.failed++;
    updateImageProgress();
    return false;
  }

  for (const url of candidates) {
    if (imageCache.has(url)) {
      img.src = imageCache.get(url);
      tile.dataset.src = url;
      tile.classList.remove("isMissing");
      tile.classList.add("isLoaded");
      state.imageLoadState.loaded++;
      updateImageProgress();
      return true;
    }

    try {
      setImgCORS(img, true);
      const proxyUrl = gridProxyUrl(url) || url;
      await queueImageLoad(() =>
        loadImageWithTimeout(img, proxyUrl, 4000)
      );
      imageCache.set(url, url);
      tile.dataset.src = url;
      tile.classList.remove("isMissing");
      tile.classList.add("isLoaded");
      state.imageLoadState.loaded++;
      updateImageProgress();
      return true;
    } catch (_) {
      /* try next candidate */
    }
  }

  markMissing(tile, img, rawUrl);
  state.imageLoadState.failed++;
  updateImageProgress();
  errorLog.imageErrorCount = (errorLog.imageErrorCount || 0) + 1;
  if (errorLog.imageErrorCount <= (errorLog.imageErrorThrottleMax ?? 3)) {
    addError(new Error("Image failed after fallback: " + rawUrl), "Image Loading");
  }
  return false;
}

function preloadCollection(_nfts) {
  /* Disabled: burst prefetch to /img was freezing the collections UI (main thread + connection cap). */
}

function makeNFTTile(it) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.classList.remove("isLoaded", "isMissing");
  tile.draggable = false;

  const contract = (it?.contract || it?.contractAddress || it?.sourceKey || "").toString().trim().toLowerCase();
  const tokenId = (it?.tokenId ?? "").toString().trim();
  tile.dataset.contract = contract;
  tile.dataset.tokenId = tokenId;
  tile.dataset.collectionKey = (it?.sourceKey || "").toString().trim().toLowerCase();
  tile.dataset.key = getGridItemKey(it);

  let raw = typeof it?.image === "string" ? it.image.trim() : "";
  if (!raw) raw = normalizeImageUrl(getImage(it)) || "";
  tile.dataset.kind = raw ? "nft" : "empty";

  const img = document.createElement("img");
  img.loading = "eager";
  img.alt = ""; // ✅ prevents filename/name text showing
  img.referrerPolicy = "no-referrer";
  img.crossOrigin = "anonymous";
  if (it?.isCustom && typeof raw === "string" && raw.startsWith("blob:")) {
    try {
      img.removeAttribute("crossorigin");
    } catch (_) {}
  }
  img.src = GRID_LOADING_PLACEHOLDER_SRC;

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
  tile.draggable = false;
  tile.dataset.src = "";
  tile.dataset.kind = "empty";
  tile.appendChild(makeFillerInner());
  return tile;
}

// ---------- Pointer drag: swap two tiles + sync ordered array (desktop + touch) ----------
const _ptrDrag = {
  active: false,
  pointerId: null,
  sourceEl: null,
  sourceIndex: -1,
  ghost: null,
  offsetX: 0,
  offsetY: 0,
};

function clearTileDropHighlights() {
  document.querySelectorAll(".tile.tile--dropTarget").forEach((el) => el.classList.remove("tile--dropTarget"));
}

function pickTileUnderPoint(clientX, clientY, ignoreEl) {
  let prev = "";
  if (ignoreEl) {
    prev = ignoreEl.style.pointerEvents || "";
    ignoreEl.style.pointerEvents = "none";
  }
  const el = document.elementFromPoint(clientX, clientY);
  if (ignoreEl) ignoreEl.style.pointerEvents = prev;
  const tile = el && el.closest ? el.closest(".tile") : null;
  const stack = $("gridStack");
  if (!tile || !stack || !stack.contains(tile)) return null;
  return tile;
}

function endPointerReorder() {
  document.removeEventListener("pointermove", onPointerReorderMove, true);
  document.removeEventListener("pointerup", onPointerReorderUp, true);
  document.removeEventListener("pointercancel", onPointerReorderUp, true);
  document.body.classList.remove("gridPointerDragActive");
  clearTileDropHighlights();
  if (_ptrDrag.sourceEl) {
    _ptrDrag.sourceEl.classList.remove("tile--dragSource");
    _ptrDrag.sourceEl = null;
  }
  if (_ptrDrag.ghost) {
    try {
      _ptrDrag.ghost.remove();
    } catch (_) {}
    _ptrDrag.ghost = null;
  }
  _ptrDrag.active = false;
  _ptrDrag.pointerId = null;
  _ptrDrag.sourceIndex = -1;
}

function reapplyLayoutAfterOrderChange() {
  const arr = state.currentGridItems;
  if (!arr?.length) return;
  BUILD_ID = Date.now();
  const meta = state.gridLayoutMeta;
  if (meta?.mode === "template" && meta.layoutId) {
    renderFullLayoutFromItems(arr.slice(), meta.layoutId, BUILD_ID);
  } else if (meta?.mode === "classic" && meta.columns != null && meta.totalSlots != null) {
    renderFullLayoutFromItems(arr.slice(), "classic", BUILD_ID, {
      cols: meta.columns,
      rows: meta.rows,
      totalSlots: meta.totalSlots,
    });
  } else {
    renderFullLayoutFromItems(arr.slice(), "classic", BUILD_ID);
  }
  enableDragDrop();
  if (state.imageLoadState.total > 0) updateImageProgress();
  requestAnimationFrame(syncWatermarkDOMToOneTile);
}

function onPointerReorderMove(e) {
  if (!_ptrDrag.active || e.pointerId !== _ptrDrag.pointerId) return;
  e.preventDefault();
  const g = _ptrDrag.ghost;
  if (g) {
    g.style.left = `${e.clientX - _ptrDrag.offsetX}px`;
    g.style.top = `${e.clientY - _ptrDrag.offsetY}px`;
  }
  clearTileDropHighlights();
  const under = pickTileUnderPoint(e.clientX, e.clientY, g);
  const meta = state.gridLayoutMeta;
  const classic = meta?.mode === "classic";
  const validTarget =
    under &&
    under !== _ptrDrag.sourceEl &&
    under.dataset.orderIndex != null &&
    under.dataset.orderIndex !== "" &&
    (classic || under.dataset.kind !== "empty");
  if (validTarget) {
    under.classList.add("tile--dropTarget");
  }
}

function onPointerReorderUp(e) {
  if (!_ptrDrag.active || e.pointerId !== _ptrDrag.pointerId) return;
  e.preventDefault();
  const ghost = _ptrDrag.ghost;
  const si = _ptrDrag.sourceIndex;
  const under = pickTileUnderPoint(e.clientX, e.clientY, ghost);
  const ti =
    under?.dataset?.orderIndex != null && under.dataset.orderIndex !== ""
      ? parseInt(under.dataset.orderIndex, 10)
      : -1;
  endPointerReorder();

  const arr = state.currentGridItems;
  const meta = state.gridLayoutMeta;
  const classic = meta?.mode === "classic";
  if (
    classic &&
    under &&
    under.dataset.kind === "empty" &&
    Array.isArray(arr) &&
    ti >= 0 &&
    si >= 0 &&
    si < arr.length &&
    ti < arr.length &&
    isGridSlotEmpty(arr[ti]) &&
    !isGridSlotEmpty(arr[si])
  ) {
    arr[ti] = arr[si];
    arr[si] = GRID_EMPTY_SENTINEL;
    syncOrderedItemsFromGrid();
    reapplyLayoutAfterOrderChange();
    setStatus("↔️ Moved — left an empty spot (drag another tile to fill it)");
    return;
  }
  if (
    under &&
    ti >= 0 &&
    si >= 0 &&
    si !== ti &&
    Array.isArray(arr) &&
    si < arr.length &&
    ti < arr.length
  ) {
    const tmp = arr[si];
    arr[si] = arr[ti];
    arr[ti] = tmp;
    syncOrderedItemsFromGrid();
    reapplyLayoutAfterOrderChange();
    setStatus("↔️ Swapped tile order");
  }
}

function onGridStackPointerDown(e) {
  if (_ptrDrag.active) return;
  if (e.button !== 0) return;
  const tile = e.target.closest(".tile");
  const stack = $("gridStack");
  if (!tile || !stack || !stack.contains(tile)) return;
  if (tile.dataset.kind === "empty") return;
  if (tile.dataset.orderIndex == null || tile.dataset.orderIndex === "") return;

  e.preventDefault();
  const idx = parseInt(tile.dataset.orderIndex, 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= (state.currentGridItems?.length ?? 0)) return;

  const rect = tile.getBoundingClientRect();
  const ghost = tile.cloneNode(true);
  ghost.classList.add("tile--dragGhost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.boxSizing = "border-box";
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.position = "fixed";
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.margin = "0";
  ghost.style.zIndex = "2147483000";
  ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);

  _ptrDrag.active = true;
  _ptrDrag.pointerId = e.pointerId;
  _ptrDrag.sourceEl = tile;
  _ptrDrag.sourceIndex = idx;
  _ptrDrag.ghost = ghost;
  _ptrDrag.offsetX = e.clientX - rect.left;
  _ptrDrag.offsetY = e.clientY - rect.top;

  tile.classList.add("tile--dragSource");
  document.body.classList.add("gridPointerDragActive");

  document.addEventListener("pointermove", onPointerReorderMove, { capture: true, passive: false });
  document.addEventListener("pointerup", onPointerReorderUp, { capture: true, passive: false });
  document.addEventListener("pointercancel", onPointerReorderUp, { capture: true, passive: false });
}

function installGridPointerReorder() {
  const stack = $("gridStack");
  if (!stack || stack._pointerReorderInstalled) return;
  stack._pointerReorderInstalled = true;
  stack.addEventListener("pointerdown", onGridStackPointerDown, true);
}

function enableDragDrop() {
  installGridPointerReorder();
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
    state.contractLogoCache = Object.create(null);
    state.contractLogoInflight.clear();

    showLoading("👀 Little Ollie is checking your wallet...", "", 0);
    setStatus(`Loading NFTs… (${state.wallets.length} wallet(s))`);

    const allNfts = [];
    const WALLET_BATCH_SIZE = 3;
    for (let i = 0; i < state.wallets.length; i += WALLET_BATCH_SIZE) {
      const batch = state.wallets.slice(i, i + WALLET_BATCH_SIZE);
      const batchNum = Math.floor(i / WALLET_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(state.wallets.length / WALLET_BATCH_SIZE);
      const walletPct = state.wallets.length > 0
        ? Math.round((Math.min(i + WALLET_BATCH_SIZE, state.wallets.length) / state.wallets.length) * 100)
        : 0;
      showLoading("🧺 Gathering your NFTs...", `Wallets ${i + 1}-${Math.min(i + WALLET_BATCH_SIZE, state.wallets.length)} of ${state.wallets.length}`, walletPct);
      setStatus(`Gathering NFTs… batch ${batchNum}/${totalBatches}.`);
      const results = await Promise.all(
        batch.map((w) => fetchNFTsFromWorker({ wallet: w, chain }))
      );
      results.forEach((nfts) => allNfts.push(...(nfts || [])));
    }

    showLoading("🎨 Sorting your collections...", "", 85);
    if (DEV) console.log("RAW NFT COUNT (all wallets)", allNfts.length);
    if (DEV) console.log("RAW SAMPLE (all)", allNfts.slice(0, 10).map((nft) => ({
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
    if (DEV) console.log("EXPANDED NFT COUNT", expanded.length);
    const grouped = groupByCollection(expanded);
    window.allNFTs = allNfts;
    window.collections = grouped;
    const displayedCount = grouped.reduce((s, c) => s + (c.nfts?.length ?? 0), 0);
    if (DEV) console.log(`NFT load complete: total ${allNfts.length} fetched → ${deduped.length} deduped → ${expanded.length} expanded → ${displayedCount} in ${grouped.length} collections`);

    showLoading("✨ Almost ready...", "", 100);
    state.collections = grouped;
    resetCollectionSelectionState();

    renderCollectionsList();
    goToStep(2);
    /* Let the collections screen paint before starting contract-metadata + logo patch work */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => queueCollectionLogoFetches());
    });

    const buildBtn = $("gridBuildBtn");
    const exportBtn = $("gridExportBtn");
    if (buildBtn) buildBtn.disabled = !hasItemsForBuild();
    if (exportBtn) exportBtn.disabled = true;

    const stageTitle = $("stageTitle");
    const stageMeta = $("stageMeta");
    if (stageTitle) stageTitle.textContent = "Wallets loaded";
    if (stageMeta) stageMeta.textContent = "Select collections, then 🧩 Build grid.";

    setStatus(grouped.length > 0
      ? `🎉 Boom! Loaded your wallets — ${grouped.length} collection(s) found`
      : `😅 Hmm... no NFTs found here`);
    showConnectionStatus(true);

    await new Promise((r) => setTimeout(r, 400));
    hideLoading();
  } catch (err) {
    hideLoading();
    const raw = (err?.message || "Error loading NFTs.").toLowerCase();
    let userMsg = "Something went wrong loading your NFTs. Please check your wallet addresses and try again.";
    if (raw.includes("upstream connect error")) {
      userMsg = "Our servers had a temporary hiccup. Please try again in a moment.";
    } else if (raw.includes("502") || raw.includes("service temporarily unavailable")) {
      userMsg = "Service temporarily unavailable. Please try again.";
    } else if ((raw.includes("invalid") && raw.includes("api")) || raw.includes("unauthorized") || raw.includes("api key")) {
      userMsg = "Configuration issue. Please contact the site owner.";
    } else if (raw.includes("timed out") || raw.includes("timeout")) {
      userMsg = "Request timed out. Try again in a moment.";
    }
    setStatus(`❌ ${userMsg}`);
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
  const image = normalizeImageUrl(getImage(nft)) || PLACEHOLDER_IMAGE;
  const name = nft?.name || nft?.title || (safeTokenId ? `#${safeTokenId}` : "NFT");
  if (DEV) console.log("RENDERING NFT", { name: nft?.title || nft?.name, contract: nft?.contract?.address });
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
      if (DEV) console.warn("dedupeNFTs: error for NFT, including anyway", e?.message);
      out.push(nft);
    }
  }
  if (DEV && dupes > 0) console.log(`dedupeNFTs: ${nfts.length} → ${out.length} unique (${dupes} duplicates)`);
  return out;
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

/** Image extraction — never blocks render. Caller must wrap with normalizeImageUrl. Never returns the collection OpenSea logo as token art. */
function getImage(nft) {
  const logo = extractCollectionLogoRawUrlFromNft(nft);
  const normLogo = logo ? String(logo).trim() : "";
  const candidates = [
    nft?.media?.[0]?.thumbnail,
    nft?.media?.[0]?.gateway,
    nft?.media?.[0]?.raw,
    nft?.rawMetadata?.image,
    nft?.rawMetadata?.image_url,
    nft?.metadata?.image,
    nft?.metadata?.image_url,
    nft?.tokenUri?.gateway,
    nft?.image?.cachedUrl,
    nft?.image?.pngUrl,
    nft?.image?.thumbnailUrl,
    nft?.image?.originalUrl,
    typeof nft?.image === "string" ? nft.image : "",
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    const s = String(c).trim();
    if (!s) continue;
    if (normLogo && s === normLogo) continue;
    return s;
  }
  return "";
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
      const collectionName =
        nft.contract?.name ||
        nft.collection?.name ||
        nft.contractMetadata?.name ||
        nft.title ||
        nft.contract?.address ||
        "Unknown Collection";
      collections[key] = {
        key,
        name: String(collectionName || "Unknown Collection").trim() || "Unknown Collection",
        nfts: [],
        count: 0,
        /** Raw logo URL from Alchemy contract metadata (openSea.imageUrl); never use in img/src without proxy */
        logo: null,
      };
    }
    collections[key].nfts.push(nft);
    if (!collections[key].logo) {
      const fromMeta = extractCollectionLogoRawUrlFromNft(nft);
      if (fromMeta) collections[key].logo = fromMeta;
    }
  }

  Object.keys(collections).forEach((k) => {
    collections[k].count = collections[k].nfts.length;
    if (!collections[k].logo) {
      const nfts = collections[k].nfts || [];
      for (let j = 0; j < nfts.length; j++) {
        const fromMeta = extractCollectionLogoRawUrlFromNft(nfts[j]);
        if (fromMeta) {
          collections[k].logo = fromMeta;
          break;
        }
      }
    }
  });

  const collectionList = Object.values(collections);
  const sorted = collectionList.sort((a, b) => b.count - a.count);

  if (DEV) {
    console.log("COLLECTION COUNT", Object.keys(collections).length);
    Object.values(collections).slice(0, 20).forEach((c) => {
      console.log("COLLECTION", {
        key: c.key,
        name: c.name,
        count: c.count,
        sampleIds: c.nfts.slice(0, 5).map((n) => n._instanceId),
      });
    });
  }

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

/** ~1% larger, centered — kills faint gaps between tiles in exported JPEG. */
function exportTileDrawRect(x, y, w, h) {
  const bleed = 0.01;
  const ox = w * (bleed / 2);
  const oy = h * (bleed / 2);
  return { x: x - ox, y: y - oy, w: w * (1 + bleed), h: h * (1 + bleed) };
}

/** Match CSS object-fit: cover; object-position: center (no stretch). */
function drawImageCover(ctx, img, dx, dy, dw, dh) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh || !dw || !dh) return;
  const scale = Math.max(dw / nw, dh / nh);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (nw - sw) / 2;
  const sy = (nh - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
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

function waitForExportImages(tiles) {
  const imgs = tiles.map((t) => t.querySelector("img")).filter(Boolean);
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 10000);
        })
    )
  );
}

async function exportPNG() {
  try {
    setStatus("📸 Preparing canvas...");
    const exportRoot = $("gridStack") || getGridPrimary();
    if (!exportRoot) return setStatus("😅 Nothing to export yet — build a grid first!");

    const tiles = [...exportRoot.querySelectorAll(".tile")];
    if (!tiles.length) return setStatus("😅 Nothing to export yet — build a grid first!");

    await waitForExportImages(tiles);

    const gridRect = exportRoot.getBoundingClientRect();
    const logicalW = Math.max(1, gridRect.width);
    const logicalH = Math.max(1, gridRect.height);

    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(3, dpr * 2);
    const pad = 4;

    const outW = Math.round((logicalW + pad * 2) * scale);
    const outH = Math.round((logicalH + pad * 2) * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.imageSmoothingQuality = "high";

    const exportBg =
      state.settingsCanvasBg === "dark" ? "#111111" : "#ffffff";
    ctx.fillStyle = exportBg;
    ctx.fillRect(0, 0, logicalW + pad * 2, logicalH + pad * 2);

    const totalTiles = tiles.length;
    for (let i = 0; i < totalTiles; i++) {
      const tile = tiles[i];
      if (i % 20 === 0 || i === totalTiles - 1) {
        setStatus(`📸 Creating your masterpiece... ${Math.round(((i + 1) / totalTiles) * 100)}%`);
      }

      const tr = tile.getBoundingClientRect();
      const x = pad + (tr.left - gridRect.left);
      const y = pad + (tr.top - gridRect.top);
      const w = tr.width;
      const h = tr.height;
      const { x: dx, y: dy, w: dw, h: dh } = exportTileDrawRect(x, y, w, h);

      const img = tile.querySelector("img");
      if (!isImgUsable(img)) {
        drawPlaceholder(ctx, dx, dy, dw, dh);
        continue;
      }

      try {
        drawImageCover(ctx, img, dx, dy, dw, dh);
      } catch (e) {
        drawPlaceholder(ctx, dx, dy, dw, dh);
      }
    }

    try {
      const pbloImg = await loadImageWithRetry("src/assets/images/pblo.png", 2, 8000);
      const first = tiles[0];
      if (first && pbloImg && pbloImg.naturalWidth > 0) {
        const fr = first.getBoundingClientRect();
        const wx = pad + (fr.left - gridRect.left);
        const wy = pad + (fr.top - gridRect.top);
        const ww = fr.width;
        const wh0 = fr.height;
        const { x: wmx, y: wmy, w: wmw } = exportTileDrawRect(wx, wy, ww, wh0);
        const ratio = pbloImg.naturalHeight / pbloImg.naturalWidth;
        let drawW = wmw;
        let drawH = Math.round(drawW * ratio);
        const pbloCap = wh0 * 0.52;
        if (drawH > pbloCap) {
          drawH = pbloCap;
          drawW = (pbloImg.naturalWidth / pbloImg.naturalHeight) * drawH;
        }
        ctx.drawImage(pbloImg, wmx, wmy, drawW, drawH);
      }
    } catch (e) {
      console.warn("pblo overlay failed for PNG export:", e);
    }

    await saveCanvasPNG(canvas, "lo-grid.jpg");

    setStatus("✨ Saved! Check your downloads");
    updateGuideGlow();
  } catch (err) {
    console.error(err);
    setStatus("😕 Oops, export failed. Try again?");
  }
}

// ---------- GIF Export (Create GIF) ----------
// Note: for gif.js "quality", LOWER numbers = better quality (but slower/bigger).
var GRID_GIF_SIZE = 512;
var GRID_GIF_CONFIG = {
  size: 512,
  maxFrames: 25,
  delay: 350,
  // Lower = better quality in gif.js (but slower / larger). Slight bump.
  quality: 10,
};
var GRID_GIF_MAX_NFT_FRAMES = 200;
var gridGifLastSpeedPos = 50;

function gridGifBranding() {
  var L = typeof window !== "undefined" ? window.LO_GIF_BRANDING : null;
  if (!L || typeof L.drawWatermark !== "function" || typeof L.createFinalFrameImageData !== "function") {
    throw new Error("GIF branding utilities failed to load. Refresh the page.");
  }
  return L;
}

function getGridGifNftTiles() {
  // Only tile types that represent NFTs/customs (not filler/empty slots).
  // Some tiles use dataset.kind === "missing" when assets fail to load.
  const tiles = queryAllGridTiles();
  return tiles.filter((t) => {
    const k = t?.dataset?.kind;
    return k === "nft" || k === "missing";
  });
}

function gridGifClamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function gridGifSpeedPosToNftDelayMs(pos) {
  // Mirrors OGT/Quirks mapping so "feel" matches.
  var p = gridGifClamp(Math.round(parseInt(String(pos), 10) || 0), 0, 100);
  if (p <= 50) {
    return Math.round(2000 + (GRID_GIF_CONFIG.delay - 2000) * (p / 50));
  }
  return Math.round(GRID_GIF_CONFIG.delay + (150 - GRID_GIF_CONFIG.delay) * ((p - 50) / 50));
}

function gridGifExportLimitFrames(frames, maxFrames) {
  var cap =
    typeof maxFrames === "number" &&
    isFinite(maxFrames) &&
    maxFrames > 0
      ? maxFrames
      : frames.length;
  if (frames.length <= cap) return frames.slice();
  var step = Math.ceil(frames.length / cap);
  return frames.filter(function (_, i) {
    return i % step === 0;
  });
}

function gridGifEffectiveNftFrameCount(orderedLength, maxPick) {
  if (orderedLength <= 0) return 0;
  var cap = Math.min(
    Math.max(1, Math.floor(maxPick)),
    GRID_GIF_MAX_NFT_FRAMES,
    orderedLength
  );
  var phantom = [];
  for (var i = 0; i < orderedLength; i++) phantom.push(i);
  return gridGifExportLimitFrames(phantom, cap).length;
}

function gridGifFormatSeconds(ms) {
  var sec = Math.max(0, Math.round(ms)) / 1000;
  var d = sec >= 10 ? 1 : 2;
  return Number(sec.toFixed(d)).toString() + " s";
}

function gridGifGetWorkerScriptUrl() {
  try {
    return new URL("../OGT/public/gif.worker.js", document.baseURI || window.location.href).href;
  } catch (e) {
    return "../OGT/public/gif.worker.js";
  }
}

function gridGifMakeCanvas(size, bg) {
  var canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  // Prefer higher quality resampling when we downscale NFT art into the GIF frame.
  try {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  } catch (_) {
    // Older browsers may not support imageSmoothingQuality; ignore.
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function drawImageContain(ctx, img, x, y, w, h) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  var iw = img.naturalWidth;
  var ih = img.naturalHeight;
  var scale = Math.min(w / iw, h / ih);
  var dw = iw * scale;
  var dh = ih * scale;
  var dx = x + (w - dw) / 2;
  var dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function gridGifOpenModal(on) {
  var m = $("gridGifOptionsModal");
  if (!m) return;
  m.classList.toggle("hidden", !on);
  m.setAttribute("aria-hidden", on ? "false" : "true");
}

function gridGifOpenCreating(on) {
  var m = $("gridGifCreatingModal");
  if (!m) return;
  m.classList.toggle("hidden", !on);
  m.setAttribute("aria-hidden", on ? "false" : "true");
}

async function exportGIF() {
  var tiles = getGridGifNftTiles();
  var nftCount = tiles.length;
  if (nftCount === 0) {
    setStatus("😕 Nothing to export yet — build a grid first!");
    return;
  }

  // Prevent multiple concurrent exports.
  var gifBtn = $("gridGifBtn");
  var pngBtn = $("gridExportBtn");
  if (gifBtn) gifBtn.disabled = true;
  if (pngBtn) pngBtn.disabled = true;

  var maxPick = parseInt(String($("gridGifOptionsMax")?.value || GRID_GIF_CONFIG.maxFrames), 10) || GRID_GIF_CONFIG.maxFrames;
  var speedPos = parseInt(String($("gridGifOptionsSpeed")?.value || gridGifLastSpeedPos), 10) || gridGifLastSpeedPos;
  gridGifLastSpeedPos = speedPos;

  // Ensure images are ready to draw.
  await waitForExportImages(tiles);

  var bg = "#0B0F1A";
  var size = GRID_GIF_SIZE;

  var delayMs = gridGifSpeedPosToNftDelayMs(speedPos);
  var frameIndices = [];
  var cap = Math.min(Math.max(1, Math.floor(maxPick)), GRID_GIF_MAX_NFT_FRAMES, nftCount);
  var phantom = [];
  for (var i = 0; i < nftCount; i++) phantom.push(i);
  var limited = gridGifExportLimitFrames(phantom, cap);
  frameIndices = limited;
  var eff = frameIndices.length;

  gridGifOpenCreating(true);
  setStatus("🎞️ Creating GIF…");

  try {
    if (typeof window.GIF !== "function") {
      throw new Error("GIF library not loaded.");
    }

    var L = gridGifBranding();

    var gif = new window.GIF({
      workers: 2,
      quality: GRID_GIF_CONFIG.quality,
      repeat: 0,
      workerScript: gridGifGetWorkerScriptUrl(),
      width: size,
      height: size,
    });

    gif.on("progress", function (p) {
      var pct = Math.max(0, Math.min(100, Math.round((typeof p === "number" ? p : 0) * 100)));
      setStatus("Encoding GIF " + pct + "%");
    });

    gif.on("finished", function (blob) {
      gridGifOpenCreating(false);
      setStatus("✨ GIF saved! Check your downloads");
      updateGuideGlow();
      syncGridFooterButtons(!hasItemsForBuild(), false);
      try {
        var outBlob = blob && blob.type === "image/gif" ? blob : new Blob([blob], { type: "image/gif" });
        var url = URL.createObjectURL(outBlob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "lo-grid.gif";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 4000);
      } catch (e) {
        console.error(e);
      }
    });

    // Opening brand frame: first collection logo tile (no pblo overlay).
    var brandCanvas = gridGifMakeCanvas(size, bg);
    var bctx = brandCanvas.getContext("2d");
    // Collection-logo tiles have dataset.key like "logo_<contract>" (see getGridItemKey()).
    var firstLogoIndex = -1;
    for (var li = 0; li < tiles.length; li++) {
      var k = tiles[li]?.dataset?.key;
      if (typeof k === "string" && k.startsWith("logo_")) {
        firstLogoIndex = li;
        break;
      }
    }
    var logoTile = firstLogoIndex >= 0 ? tiles[firstLogoIndex] : tiles[0];
    var logoImg = logoTile ? logoTile.querySelector("img") : null;
    if (isImgUsable(logoImg)) {
      drawImageCover(bctx, logoImg, 0, 0, size, size);
    }
    L.drawWatermark(bctx, size, size);
    var brandIdata = bctx.getImageData(0, 0, size, size);
    gif.addFrame(brandIdata, { delay: 1000, copy: true });

    // NFT frames.
    for (var fi = 0; fi < frameIndices.length; fi++) {
      var idx = frameIndices[fi];
      var tile = tiles[idx];
      var img = tile ? tile.querySelector("img") : null;
      var canvas = gridGifMakeCanvas(size, bg);
      var ctx = canvas.getContext("2d");
      if (isImgUsable(img)) {
        drawImageContain(ctx, img, 0, 0, size, size);
      }
      L.drawWatermark(ctx, size, size);
      var idata = ctx.getImageData(0, 0, size, size);
      gif.addFrame(idata, { delay: delayMs, copy: true });
      if ((fi & 3) === 3) {
        await new Promise(function (r) {
          setTimeout(r, 0);
        });
      }
    }

    // Final promo frame (always last) — white bg + black text.
    var finalIdata = L.createFinalFrameImageData(size, size);
    var finalDelay =
      typeof L.finalFrameDelayMs === "function"
        ? L.finalFrameDelayMs(delayMs)
        : Math.round(delayMs * 1.5) + 500;
    gif.addFrame(finalIdata, { delay: finalDelay, copy: true });

    gif.render();
  } catch (e) {
    gridGifOpenCreating(false);
    setStatus("😕 GIF export failed. Try again?");
    console.error(e);
    syncGridFooterButtons(!hasItemsForBuild(), false);
  }
}

function updateGridGifOptionsUi() {
  var tiles = getGridGifNftTiles();
  var nftCount = tiles.length;
  var maxInput = $("gridGifOptionsMax");
  var speedEl = $("gridGifOptionsSpeed");
  var summary = $("gridGifOptionsSummary");
  var duration = $("gridGifOptionsDuration");
  if (!maxInput || !speedEl) return;

  var cap = GRID_GIF_MAX_NFT_FRAMES;
  var defaultMaxPick = Math.min(nftCount, cap);
  maxInput.value = String(defaultMaxPick || 1);

  var speedPos = parseInt(String(speedEl.value || gridGifLastSpeedPos), 10) || gridGifLastSpeedPos;
  var maxPick = parseInt(String(maxInput.value), 10) || defaultMaxPick;
  var eff = gridGifEffectiveNftFrameCount(nftCount, maxPick);
  var delayMs = gridGifSpeedPosToNftDelayMs(speedPos);
  var Lbr = typeof window !== "undefined" ? window.LO_GIF_BRANDING : null;
  var finalMs =
    Lbr && typeof Lbr.finalFrameDelayMs === "function"
      ? Lbr.finalFrameDelayMs(delayMs)
      : Math.round(delayMs * 1.5) + 500;
  var totalMs = 1000 + eff * delayMs + finalMs;

  if (summary) {
    summary.textContent =
      "Your grid has " +
      nftCount +
      " NFT tiles. This will export " +
      eff +
      " NFT frames plus the opening brand frame and a closing CTA frame.";
  }
  if (duration) {
    duration.textContent = "Estimated length: " + gridGifFormatSeconds(totalMs);
  }
}

function openGridGifOptions() {
  updateGridGifOptionsUi();
  gridGifOpenModal(true);
  var maxInput = $("gridGifOptionsMax");
  if (maxInput) maxInput.focus();
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
    walletInput.addEventListener("input", () => {
      if (walletValidationDebounce) clearTimeout(walletValidationDebounce);
      walletValidationDebounce = setTimeout(() => {
        const w = normalizeWallet(walletInput.value);
        showWalletValidationHint(w && /^0x[a-f0-9]{40}$/.test(w) && !state.wallets.includes(w));
        walletValidationDebounce = null;
      }, 200);
    });
    walletInput.addEventListener("blur", () => {
      if (walletValidationDebounce) clearTimeout(walletValidationDebounce);
      walletValidationDebounce = null;
      clearWalletValidationHint();
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

    addBtn.addEventListener("click", handler, { passive: false });
    if (window.PointerEvent) addBtn.addEventListener("pointerup", handler, { passive: false });
    else addBtn.addEventListener("touchend", handler, { passive: false });
  }

  const selectAllBtn = $("selectAllBtn");
  const selectNoneBtn = $("selectNoneBtn");
  if (selectAllBtn) selectAllBtn.addEventListener("click", () => setAllCollections(true));
  if (selectNoneBtn) selectNoneBtn.addEventListener("click", () => setAllCollections(false));

  renderLayoutPicker();
  renderStageLayoutPicker();
  renderCustomImagesPanel();

  const importInput = $("importImageInput");
  if (importInput) {
    importInput.addEventListener("change", () => {
      const files = importInput.files;
      const n = files?.length || 0;
      if (n) {
        const added = addCustomImagesFromFileList(files);
        finalizeCustomImageImport(added);
      }
      importInput.value = "";
    });
  }
  const importBtn = $("importImageBtn");
  if (importBtn && importInput) importBtn.addEventListener("click", () => importInput.click());
  const gridImportImageBtn = $("gridImportImageBtn");
  if (gridImportImageBtn && importInput) gridImportImageBtn.addEventListener("click", () => importInput.click());

  const gridShuffleBtn = $("gridShuffleBtn");
  if (gridShuffleBtn) gridShuffleBtn.addEventListener("click", () => shuffleCurrentGridOrder());

  const loadBtn = $("loadBtn");
  if (loadBtn) loadBtn.addEventListener("click", loadWallets);
  const gridBuildBtn = $("gridBuildBtn");
  const gridExportBtn = $("gridExportBtn");
  if (gridBuildBtn) gridBuildBtn.addEventListener("click", buildGrid);
  if (gridExportBtn) gridExportBtn.addEventListener("click", exportPNG);

  const gridGifBtn = $("gridGifBtn");
  if (gridGifBtn) gridGifBtn.addEventListener("click", openGridGifOptions);

  const gifOptionsModal = $("gridGifOptionsModal");
  const gifOptionsClose = $("gridGifOptionsClose");
  const gifOptionsCancel = $("gridGifOptionsCancel");
  const gifOptionsConfirm = $("gridGifOptionsConfirm");
  const gifMaxInput = $("gridGifOptionsMax");
  const gifSpeedInput = $("gridGifOptionsSpeed");

  if (gifOptionsModal) {
    gifOptionsModal.addEventListener("click", (e) => {
      // Close only when clicking the overlay itself.
      if (e.target === gifOptionsModal) gridGifOpenModal(false);
    });
  }
  if (gifOptionsClose) gifOptionsClose.addEventListener("click", () => gridGifOpenModal(false));
  if (gifOptionsCancel) gifOptionsCancel.addEventListener("click", () => gridGifOpenModal(false));
  if (gifOptionsConfirm)
    gifOptionsConfirm.addEventListener("click", () => {
      gridGifOpenModal(false);
      exportGIF();
    });

  if (gifMaxInput) gifMaxInput.addEventListener("input", updateGridGifOptionsUi);
  if (gifSpeedInput) gifSpeedInput.addEventListener("input", updateGridGifOptionsUi);

  // Step navigation
  const collectionsBackBtn = $("collectionsBackBtn");
  const collectionsNextBtn = $("collectionsNextBtn");
  const gridBackBtn = $("gridBackBtn");
  if (collectionsBackBtn) collectionsBackBtn.addEventListener("click", () => goToStep(1));
  if (collectionsNextBtn) collectionsNextBtn.addEventListener("click", () => {
    if (!hasItemsForBuild()) {
      setStatus("🎯 Select collections or custom images to continue");
      return;
    }
    goToStep(3);
  });
  if (gridBackBtn) gridBackBtn.addEventListener("click", () => goToStep(2));

  // Step indicator clicks
  document.querySelectorAll(".stepItem").forEach((el) => {
    el.addEventListener("click", () => {
      const s = parseInt(el.dataset.step, 10);
      if (s >= 1 && s <= 3) goToStep(s);
    });
  });

  const retryBtn = $("retryBtn");
  if (retryBtn && typeof retryMissingTiles === "function") {
    retryBtn.addEventListener("click", retryMissingTiles);
  }
  const removeUnloadedBtn = $("removeUnloadedBtn");
  if (removeUnloadedBtn && typeof removeUnloadedAndReshuffle === "function") {
    removeUnloadedBtn.addEventListener("click", removeUnloadedAndReshuffle);
  }

  const clearErrBtn = $("clearErrorLog");
  if (clearErrBtn) clearErrBtn.addEventListener("click", clearErrorLog);

  const traitControlsContainer = $("collectionTraitControls");
  if (traitControlsContainer) {
    installTraitOrderDragHandlers();
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

  goToStep(1);

  const settingsBtn = $("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSettings();
    });
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      const manualOpen = manualModal.overlay && !manualModal.overlay.classList.contains("hidden");
      if (manualOpen) return;
      if (!state.isSettingsOpen) return;
      e.preventDefault();
      closeSettings();
    },
    true
  );

  window.addEventListener("resize", syncWatermarkDOMToOneTile);
  window.addEventListener("orientationchange", syncWatermarkDOMToOneTile);
})();

// Load configuration securely
async function initializeConfig() {
  try {
    const { loadConfig } = await import("./config.js");
    const config = await loadConfig();

    IMG_PROXY = config.workerUrl;

    if (!IMG_PROXY) {
      throw new Error("Unable to load configuration. Ensure your Worker supplies workerUrl.");
    }
    configLoaded = true;

    if (DEV) console.log("Config loaded");

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
      hint.style.fontSize = "16px";
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
