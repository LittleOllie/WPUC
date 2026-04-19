/* Little Ollie Flex Grid (SAFE export for file:// + Multi-Wallet)
   - GRID loads via Worker proxy — no direct IPFS (avoids CORS/rate limits)
   - SECURITY: API keys in Worker env only (see config.js)
*/
import {
  fetchNFTsFromWorker,
  fetchNFTsFromZora,
  fetchContractMetadataFromWorker,
  getWorkerBase,
} from "./api.js";
import { getAlchemyNetworkId } from "./alchemyNetworks.js";

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

/** Direct child .tile elements in primary + overflow grids (overflow may be hidden while DOM still holds tiles). */
function queryAllGridTiles() {
  const tiles = [];
  const p = getGridPrimary();
  const o = getGridOverflow();
  if (p) {
    for (const ch of p.children) {
      if (ch.classList?.contains("tile")) tiles.push(ch);
    }
  }
  if (o) {
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
  if (currentStep === 3) {
    syncLayoutPickerActiveStates();
    applySettingsToLiveGrids();
    syncStageCaptionOverlay();
    syncGridRemoveImportedBtnVisibility();
  }

  syncHubBackButton();
  updateGuideGlow();
}

/** Little Ollie Labs links hub (absolute so it works from /flexgrid/site/ or any deploy path). */
const HUB_LINKS_PAGE = "https://littleollielabs.com/links/";

function syncHubBackButton() {
  const btn = $("hubBackBtn");
  if (!btn) return;
  btn.textContent = "← BACK";
  if (currentStep === 1) {
    btn.title = "Back to Links";
    btn.setAttribute("aria-label", "Back to Links");
  } else if (currentStep === 2) {
    btn.title = "Back to Wallets";
    btn.setAttribute("aria-label", "Back to Wallets");
  } else {
    btn.title = "Back to Collections";
    btn.setAttribute("aria-label", "Back to Collections");
  }
}

function onHubBackClick() {
  if (currentStep === 1) {
    window.location.href = HUB_LINKS_PAGE;
    return;
  }
  if (currentStep === 2) {
    goToStep(1);
    return;
  }
  goToStep(2);
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
    "loadBtn",
    "controlsPanel",
    "collectionsList",
    "collectionSearch",
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

  // 1) No wallets yet -> highlight wallet textarea
  if (!hasWallets) {
    setGuideGlow(["walletInput"]);
    return;
  }

  // 2) Wallet(s) added but not loaded yet -> highlight LOAD WALLET (pulse)
  if (hasWallets && !hasLoadedWallets) {
    setGuideGlow(["loadBtn"]);
    const loadBtn = $("loadBtn");
    if (loadBtn) loadBtn.classList.add("primaryCTA");
    return;
  }

  // 3) Wallets loaded, no selection for build -> highlight search (green ring)
  if (controlsVisible && !hasOneOrMoreForBuild) {
    setGuideGlow(["collectionSearch"]);
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
  walletCollapsed: false,
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
          "<p class=\"manual-selection-nfts-waiting-hint\">Try <strong>🔍 LOAD WALLET</strong> again, or close and tap <strong>Select Manually</strong> once your collections finish loading.</p>";
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
};

/** Keep `state.chain` / `state.host` in sync with the Chain dropdown so loads never use a stale chain. */
function applyChainSelectionFromDom() {
  const sel = $("chainSelect");
  if (!sel) return;
  const raw = String(sel.value || "").trim().toLowerCase();
  if (!raw) return;
  if (raw === "solana") {
    state.chain = "solana";
    return;
  }
  if (raw === "apechain") {
    state.chain = "apechain";
    state.host = null;
    console.log("[FlexGrid] Chain UI synced to state:", state.chain, "(NFTs via Moralis on Worker)");
    return;
  }
  const host = ALCHEMY_HOST[raw];
  if (!host) return;
  state.chain = raw;
  state.host = host;
  console.log("[FlexGrid] Chain UI synced to state:", state.chain);
}

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

function showLoading(message = "Loading…", progress = "") {
  const overlay = $("loadingOverlay");
  if (overlay) {
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");
  }
  const statusEl = $("loadingOverlayStatus");
  if (statusEl) {
    const line = [message, progress].filter((s) => s && String(s).trim()).join(" — ");
    statusEl.textContent = line || "";
  }
}

function hideLoading() {
  const overlay = $("loadingOverlay");
  if (overlay) {
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
  }
  const statusEl = $("loadingOverlayStatus");
  if (statusEl) statusEl.textContent = "";
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

  const stageFill = document.getElementById("gridStageImageLoadingBarFill");
  const stageHint = document.querySelector(".grid-stage-image-loading-hint");

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
    if (stageFill) {
      stageFill.style.width = "0%";
      stageFill.classList.remove("indeterminate");
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

  /* Top-of-grid: red→green progress bar while images settle */
  if (stageLoadBar) {
    stageLoadBar.classList.remove("grid-stage-image-loading--empty");
    const busy = settled < total;
    stageLoadBar.classList.toggle("grid-stage-image-loading--busy", busy);
    stageLoadBar.classList.toggle("grid-stage-image-loading--done", !busy);
    if (stageFill) {
      stageFill.classList.remove("indeterminate");
      stageFill.style.width = `${progress}%`;
    }
    if (stageHint) {
      if (settled >= total) {
        stageHint.textContent =
          failed > 0 ? `Finished — ${failed} image(s) need attention` : "All images loaded";
      } else {
        stageHint.textContent = `Loading images… ${settled}/${total}`;
      }
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
function tryParseJsonObject(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  if (typeof val !== "string") return null;
  const t = val.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return null;
  try {
    const o = JSON.parse(t);
    return typeof o === "object" && o !== null ? o : null;
  } catch {
    return null;
  }
}

/** Alchemy v2/v3 may ship `metadata` as a stringified JSON blob. */
function mergedNFTMetadata(nft) {
  const m0 = tryParseJsonObject(nft?.metadata) || (typeof nft?.metadata === "object" && nft.metadata ? nft.metadata : {});
  const m1 = tryParseJsonObject(nft?.rawMetadata) || (typeof nft?.rawMetadata === "object" && nft.rawMetadata ? nft.rawMetadata : {});
  const m2 = tryParseJsonObject(nft?.raw?.metadata) || (typeof nft?.raw?.metadata === "object" && nft.raw?.metadata ? nft.raw.metadata : {});
  return { ...m0, ...m1, ...m2 };
}

/** Moralis / gateways sometimes emit protocol-relative URLs or a broken `https:///2F…` prefix. */
function repairBrokenImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  let s = url.trim();
  if (!s) return url;
  if (s.startsWith("//")) s = `https:${s}`;
  s = s.replace(/^https:\/\/{2,}2F(?=[a-zA-Z0-9])/i, "https://");
  s = s.replace(/^http:\/\/{2,}2F(?=[a-zA-Z0-9])/i, "http://");
  s = s.replace(/^https:\/\/{3,}/i, "https://");
  s = s.replace(/^http:\/\/{3,}/i, "http://");
  return s;
}

/** Inline SVG / image_data from OpenSea-style metadata → usable data URL (bounded size). */
function coerceImageDataUrl(imageData) {
  if (typeof imageData !== "string" || !imageData.trim()) return null;
  const d = imageData.trim();
  if (d.startsWith("data:")) return d;
  if (d.length > 750000) return null;
  if (d.includes("<svg")) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(d)}`;
  return null;
}

/**
 * Broad image discovery (does not apply collection-logo exclusion — pair with getImage() first when needed).
 * Safe for messy v3 / ApeChain payloads; never throws to callers.
 */
function getBestImage(nft) {
  try {
    const merged = mergedNFTMetadata(nft);
    const pick = (v) => {
      if (typeof v !== "string" || !v.trim()) return null;
      return repairBrokenImageUrl(v.trim());
    };
    return (
      pick(nft?.media?.[0]?.gateway) ||
      pick(nft?.media?.[0]?.thumbnail) ||
      pick(nft?.media?.[0]?.raw) ||
      pick(merged.image) ||
      pick(merged.image_url) ||
      pick(nft?.rawMetadata?.image) ||
      pick(nft?.rawMetadata?.image_url) ||
      coerceImageDataUrl(nft?.rawMetadata?.image_data) ||
      pick(typeof nft?.image === "string" ? nft.image : null) ||
      pick(nft?.image?.cachedUrl) ||
      pick(nft?.image?.thumbnailUrl) ||
      pick(nft?.image?.originalUrl) ||
      pick(nft?.image?.pngUrl) ||
      null
    );
  } catch (err) {
    console.warn("[FlexGrid] getBestImage:", err?.message || err);
    return null;
  }
}

/** Raw URL for art before proxy (grid + normalization). Prefer logo-safe getImage, then getBestImage. */
function primaryRawArtUrlForNft(nft) {
  try {
    const a = (getImage(nft) || "").toString().trim();
    if (a) return a;
    const b = getBestImage(nft);
    return b ? String(b).trim() : "";
  } catch (err) {
    console.warn("[FlexGrid] primaryRawArtUrlForNft:", err?.message || err);
    return "";
  }
}

/**
 * Collection-level image hints (ApeChain / Moralis rows may omit contract-level logos).
 * Returns a URL string or null (UI uses placeholder when null).
 */
function getCollectionLogoFromNFTs(collection) {
  if (!collection || typeof collection !== "object") return null;
  if (typeof collection.image === "string" && collection.image.trim()) {
    return repairBrokenImageUrl(collection.image.trim());
  }
  if (typeof collection.logo === "string" && collection.logo.trim()) {
    return repairBrokenImageUrl(collection.logo.trim());
  }
  const nfts = collection.nfts || [];
  for (let i = 0; i < nfts.length; i++) {
    const n = nfts[i];
    if (!n) continue;
    if (typeof n.image === "string" && n.image.trim()) return repairBrokenImageUrl(n.image.trim());
    if (n.image && typeof n.image === "object") {
      const u = n.image.cachedUrl || n.image.originalUrl || n.image.thumbnailUrl || n.image.pngUrl;
      if (typeof u === "string" && u.trim()) return repairBrokenImageUrl(u.trim());
    }
    const art = primaryRawArtUrlForNft(n);
    if (art) return repairBrokenImageUrl(art);
  }
  return null;
}

/**
 * Collection row / logo: contract-level URL first, then per-NFT contract metadata, last resort first token art.
 */
function getCollectionLogoUrlForRow(collection) {
  try {
    if (!collection || typeof collection !== "object") return null;
    const key = String(collection.key || "").trim().toLowerCase();
    const logApe = (source, url) => {
      if (state?.chain === "apechain" && url) {
        console.log("[FlexGrid][ApeChain] collection logo source:", source, "contract:", key || "(unknown)");
      }
    };
    if (typeof collection.image === "string" && collection.image.trim()) {
      const u = collection.image.trim();
      logApe("collection.image", u);
      return u;
    }
    if (typeof collection.logo === "string" && collection.logo.trim()) {
      const u = collection.logo.trim();
      logApe("collection.logo", u);
      return u;
    }
    const nfts = collection.nfts || [];
    for (let i = 0; i < nfts.length; i++) {
      const u = extractCollectionLogoRawUrlFromNft(nfts[i]);
      if (u) {
        logApe("nft.contract/collection metadata", u);
        return u;
      }
    }
    const fromNfts = getCollectionLogoFromNFTs({ ...collection, image: null, logo: null });
    if (fromNfts) {
      logApe("first token art / nft.image", fromNfts);
      return fromNfts;
    }
    if (state?.chain === "apechain") {
      console.log("[FlexGrid][ApeChain] collection logo source: none (placeholder)", "contract:", key || "(unknown)");
    }
    return null;
  } catch (err) {
    console.warn("[FlexGrid] getCollectionLogoUrlForRow:", err?.message || err);
    return null;
  }
}

/** Optional strict filter (e.g. analytics). Not applied to wallet load — would hide valid fixer-upper NFTs. */
function isValidNFT(nft) {
  return !!(nft && (nft._rawImageUrl || nft.image || primaryRawArtUrlForNft(nft)));
}

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
    const host = u.hostname.toLowerCase();
    const sub = host.match(/^([a-zA-Z0-9]{30,})\.ipfs\.(w3s\.link|dweb\.link)$/);
    if (sub) {
      const cid = sub[1];
      const tail = (u.pathname || "").replace(/^\/+/, "").split("?")[0].split("#")[0];
      return tail ? `${cid}/${tail}` : cid;
    }
    const idx = u.pathname.indexOf("/ipfs/");
    if (idx !== -1) {
      return u.pathname.slice(idx + "/ipfs/".length).replace(/^\/+/, "");
    }
  } catch (e) {}

  return "";
}

/** HTTP(S) / IPFS / ar / CID normalization. IPFS is upgraded to https gateways; use `toProxyUrl` for Worker `/img?url=` (not `/api/img`). */
function normalizeImageUrl(url) {
  if (!url) return null;

  const s = repairBrokenImageUrl(String(url).trim());

  // Already good
  if (s.startsWith("https://")) return s;
  if (s.startsWith("http://")) return s;
  if (s.startsWith("data:")) return s;

  // ar://… (common in Alchemy v3 / on-chain metadata)
  if (/^ar:\/\//i.test(s)) {
    const id = s.replace(/^ar:\/\//i, "").replace(/^\/+/, "");
    return id ? `https://arweave.net/${id}` : null;
  }

  // ipfs://
  if (s.startsWith("ipfs://")) {
    const path = s.replace("ipfs://", "").replace(/^ipfs\//, "");
    return "https://dweb.link/ipfs/" + path;
  }

  // Raw CID
  if (!s.startsWith("http") && s.length > 40) {
    return "https://dweb.link/ipfs/" + s;
  }

  return s;
}

/** Prefer Worker proxy when available; fallback to direct gateways for reliability. */
function toProxyUrl(rawUrl) {
  if (!rawUrl || !IMG_PROXY) return null;
  const raw = String(rawUrl).trim();
  if (/^data:/i.test(raw) || /^blob:/i.test(raw)) return null;
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
    candidates.push(`https://dweb.link/ipfs/${ipfsPath}`);
    candidates.push(`https://w3s.link/ipfs/${ipfsPath}`);
    candidates.push(`https://ipfs.io/ipfs/${ipfsPath}`);
    candidates.push(`https://nftstorage.link/ipfs/${ipfsPath}`);
    candidates.push(`https://cloudflare-ipfs.com/ipfs/${ipfsPath}`);
  } else if (normalized && !candidates.includes(normalized)) {
    candidates.push(normalized);
  }

  return [...new Set(candidates)];
}

/**
 * Client-side img onerror chain (simple list). Grid tiles use `loadTileImage` instead (multi-gateway + cache).
 * @param {HTMLImageElement} imgElement
 * @param {string[]} fallbackUrls
 * @param {string} [finalFallback]
 */
function handleImageError(imgElement, fallbackUrls, finalFallback = TILE_PLACEHOLDER_SRC) {
  if (!imgElement || typeof imgElement.addEventListener !== "function") return;
  const list = [...new Set((fallbackUrls || []).filter((u) => typeof u === "string" && u.trim()))];
  if (!list.length) {
    imgElement.src = finalFallback;
    return;
  }
  let index = 0;
  imgElement.onerror = () => {
    index++;
    if (index < list.length) imgElement.src = list[index];
    else imgElement.src = finalFallback;
  };
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
  if (shown && shown !== TILE_PLACEHOLDER_SRC && shown !== GRID_LOADING_PLACEHOLDER_SRC) {
    imageCache.set(shown, shown);
  }
  for (const c of candidates) {
    if (c) imageCache.set(c, c);
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
/**
 * How much each exported tile is expanded beyond its layout rect (fraction of width/height per side).
 * Smaller = less neighbor overlap; too small can show hairline gaps in JPEG. 0.25% total is a good balance.
 */
const EXPORT_TILE_BLEED = 0.0025;

/**
 * pblo sits flush to the first cell’s top-left and is exactly as wide as that cell (export/DOM share the same math).
 * Height follows the image aspect ratio at that width.
 */
function flexGridPbloLayoutInTileRect(dx, dy, dtw, _dth, naturalW, naturalH) {
  const nw = Math.max(1, naturalW);
  const nh = Math.max(1, naturalH);
  const drawW = Math.max(1, Math.round(dtw));
  const drawH = Math.max(1, Math.round((drawW * nh) / nw));
  return {
    px: Math.round(dx),
    py: Math.round(dy),
    drawW,
    drawH,
  };
}

function syncWatermarkDOMToOneTile() {
  const wm = document.getElementById("wmGrid"); // <img>
  const grid = document.getElementById("grid");
  const overflow = document.getElementById("gridOverflow");
  if (!wm || !grid) return;

  const primaryTiles = [...grid.querySelectorAll(".tile")];
  const firstTile =
    flexGridFirstTileForPbloAnchor(primaryTiles) ||
    primaryTiles[0] ||
    overflow?.querySelector(".tile");
  if (!firstTile) {
    wm.style.display = "none";
    return;
  }

  const gridStack = grid.closest(".gridStack");
  if (!gridStack) return;
  if (wm.parentElement !== gridStack) gridStack.appendChild(wm);

  wm.style.display = "block";
  wm.style.position = "absolute";
  wm.style.zIndex = "9999";
  wm.style.pointerEvents = "none";
  wm.style.objectFit = "fill";
  wm.style.objectPosition = "left top";
  wm.style.margin = "0";
  wm.style.padding = "0";
  wm.style.right = "auto";
  wm.style.bottom = "auto";
  wm.style.boxSizing = "border-box";

  const stackRect = gridStack.getBoundingClientRect();
  const fr = firstTile.getBoundingClientRect();
  const lx = fr.left - stackRect.left;
  const ly = fr.top - stackRect.top;
  const { x: px, y: py, w: dtw, h: dth } = exportTileDrawRect(lx, ly, fr.width, fr.height);

  const applySize = () => {
    const nw = wm.naturalWidth;
    const nh = wm.naturalHeight;
    if (!nw || !nh) return;
    const { px: left, py: top, drawW, drawH } = flexGridPbloLayoutInTileRect(px, py, dtw, dth, nw, nh);
    wm.style.left = `${Math.round(left)}px`;
    wm.style.top = `${Math.round(top)}px`;
    wm.style.width = `${drawW}px`;
    wm.style.height = `${drawH}px`;
  };

  if (wm.complete && wm.naturalWidth > 0) {
    applySize();
  } else {
    wm.onload = () => {
      wm.onload = null;
      syncWatermarkDOMToOneTile();
    };
  }
}

// ---------- Wallet list ----------
const MAX_WALLET_ADDRESSES = 12;

/** Split pasted / typed text into unique valid 0x addresses (capped at MAX_WALLET_ADDRESSES). */
function parseWalletAddressesFromInput(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s.split(/[\s,;]+/g);
  const out = [];
  const seen = {};
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim().toLowerCase();
    if (!p) continue;
    if (!/^0x[a-f0-9]{40}$/.test(p)) continue;
    if (seen[p]) continue;
    seen[p] = true;
    out.push(p);
    if (out.length >= MAX_WALLET_ADDRESSES) break;
  }
  return out;
}

let walletValidationDebounce = null;

function clearWalletValidationHint() {
  const hint = $("walletValidationHint");
  if (hint) {
    hint.textContent = "";
    hint.style.color = "";
  }
}

function updateWalletInputHint() {
  const hint = $("walletValidationHint");
  const input = $("walletInput");
  if (!hint || !input) return;
  const raw = String(input.value || "").trim();
  const n = state.wallets.length;
  if (!raw) {
    clearWalletValidationHint();
    return;
  }
  if (n > 0) {
    hint.textContent = `✓ ${n} wallet${n === 1 ? "" : "s"} ready`;
    hint.style.color = "#4CAF50";
  } else {
    hint.textContent = "Enter valid 0x addresses (comma, space, or new line)";
    hint.style.color = "#ff9800";
  }
}

/** Parse #walletInput into state.wallets (no separate Add step). */
function syncWalletsFromInput() {
  const input = $("walletInput");
  const raw = input ? input.value : "";
  state.wallets = parseWalletAddressesFromInput(raw);
  renderWalletList();
  syncWalletHeader();
  enableButtons();
  updateGuideGlow();
  updateWalletInputHint();
  return state.wallets.length;
}

function renderWalletList() {
  const wrap = $("walletList");
  if (!wrap) return;
  wrap.style.display = "none";
  wrap.innerHTML = "";
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

function modalThumbSrcForNFT(nft, candidateIndex = 0) {
  const raw = getImage(nft);
  if (!raw) return TILE_PLACEHOLDER_SRC;
  const list = buildImageCandidates(raw);
  if (!list.length) return TILE_PLACEHOLDER_SRC;
  const ci = Number(candidateIndex);
  const i = Math.min(Math.max(0, Number.isFinite(ci) ? ci : 0), list.length - 1);
  return list[i] || TILE_PLACEHOLDER_SRC;
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

/**
 * Same resolution path as grid tiles: cache, Worker proxy, gateway fallbacks, queued + timeout loads.
 * @returns {{ ok: boolean, winningUrl?: string }}
 */
async function resolveRawUrlOntoImage(img, rawUrl) {
  const raw = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!raw) return { ok: false };

  if (raw.startsWith("blob:")) {
    try {
      setImgCORS(img, false);
      try {
        img.removeAttribute("crossorigin");
      } catch (_) {}
      await queueImageLoad(() => loadImageWithTimeout(img, raw, 12000));
      return { ok: true, winningUrl: raw };
    } catch (_) {
      return { ok: false };
    }
  }

  const candidates = buildImageCandidates(raw);
  if (candidates.length === 0) return { ok: false };

  for (const url of candidates) {
    if (imageCache.has(url)) {
      img.src = imageCache.get(url);
      return { ok: true, winningUrl: url };
    }
    try {
      setImgCORS(img, true);
      const proxyUrl = gridProxyUrl(url) || url;
      await queueImageLoad(() => loadImageWithTimeout(img, proxyUrl, 4000));
      imageCache.set(url, url);
      return { ok: true, winningUrl: url };
    } catch (_) {
      /* try next candidate */
    }
  }
  return { ok: false };
}

/** Full thumbnail load for manual picker — mirrors `loadTileImage` (proxy + fallbacks), then decode / size check. */
async function startManualModalThumbnailLoad(img, cell, retryBtn, nft, { bumpSettled } = {}) {
  const st = manualModal.imageLoadState;
  cell.classList.remove("manual-nft-tile--error");
  retryBtn.hidden = true;
  delete cell.dataset.thumbCandIdx;

  const raw = getImage(nft);
  if (!raw || !String(raw).trim()) {
    img.src = TILE_PLACEHOLDER_SRC;
    retryBtn.hidden = true;
    if (bumpSettled && st) {
      st.settled++;
      updateManualModalLoadProgress();
    }
    return;
  }

  img.src = GRID_LOADING_PLACEHOLDER_SRC;

  const res = await resolveRawUrlOntoImage(img, raw);
  let ok = res.ok;
  if (ok) {
    try {
      if (typeof img.decode === "function") await img.decode();
    } catch (_) {
      ok = false;
    }
    if (ok && !isManualModalImageRenderable(img)) ok = false;
  }

  if (!ok) {
    retryBtn.hidden = false;
    cell.classList.add("manual-nft-tile--error");
    img.src = TILE_PLACEHOLDER_SRC;
  } else {
    retryBtn.hidden = true;
    cell.classList.remove("manual-nft-tile--error");
    if (nft) primeImageCacheFromManualPreview(nft, img);
  }

  if (bumpSettled && st) {
    st.settled++;
    updateManualModalLoadProgress();
  }
}

function retryManualModalImage(img, nft, retryBtn, cell) {
  void startManualModalThumbnailLoad(img, cell, retryBtn, nft, { bumpSettled: false });
}

async function retryAllFailedManualModalImages() {
  const grid = document.getElementById("manualSelectionGrid");
  const c = state.collections.find((x) => x.key === manualModal.collectionKey);
  const bulk = document.getElementById("manualSelectionRetryFailed");
  if (!grid || !c) return;
  const cells = [...grid.querySelectorAll(".manual-nft-tile--error")];
  if (!cells.length) return;
  if (bulk) {
    bulk.disabled = true;
    bulk.dataset.prevLabel = bulk.textContent || "";
    bulk.textContent = "⏳ Retrying…";
  }
  try {
    await Promise.all(
      cells.map(async (cell) => {
        const k = cell.dataset.nftKey;
        const nft = (c.nfts || []).find((n) => getNFTSelectionKey(n) === k);
        if (!nft) return;
        const img = cell.querySelector("img");
        const retryBtn = cell.querySelector(".manual-nft-tile-retry");
        if (img && retryBtn) await startManualModalThumbnailLoad(img, cell, retryBtn, nft, { bumpSettled: false });
      })
    );
  } finally {
    if (bulk) {
      bulk.disabled = false;
      bulk.textContent = bulk.dataset.prevLabel || "↻ Retry failed images";
      delete bulk.dataset.prevLabel;
    }
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
      void startManualModalThumbnailLoad(img, cell, retryBtn, nft, { bumpSettled: true });
    } else {
      img.src = src;
    }
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

// ---------- Collection logos (Worker: Alchemy or Moralis contract metadata, async) ----------
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
    const u = obj.imageUrl || obj.image_url || obj.logo || obj.coverImageUrl;
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
  const col = nft.collection;
  if (col && typeof col === "object") {
    const u =
      pick(col.openSeaMetadata) ||
      pick(col.openSea) ||
      (typeof col.imageUrl === "string" && col.imageUrl.trim() ? col.imageUrl.trim() : null) ||
      (typeof col.image_url === "string" && col.image_url.trim() ? col.image_url.trim() : null);
    if (u) return u;
  }
  return null;
}

/** Square thumb: contract/collection logo only (proxied). No token image fallback. */
function buildCollectionLogoThumb(c) {
  const wrap = document.createElement("div");
  wrap.className = "collectionLogoWrap";

  const showPlaceholder = () => {
    wrap.innerHTML = "";
    wrap.appendChild(makeCollectionLogoPlaceholder());
  };

  /** List UI only — omit crossOrigin so more CDNs load; try proxy then direct gateways. */
  const appendImgWaterfall = (urls) => {
    const list = [...new Set((urls || []).filter(Boolean))];
    if (!list.length) {
      showPlaceholder();
      return;
    }
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
    let i = 0;
    img.onerror = () => {
      i++;
      if (i >= list.length) {
        showPlaceholder();
        return;
      }
      img.src = list[i];
    };
    wrap.appendChild(img);
    enqueueCollectionListImageLoad(() => {
      i = 0;
      img.src = list[0];
    });
  };

  const logoRaw = getCollectionLogoUrlForRow(c);
  if (logoRaw) {
    const raw = String(logoRaw).trim();
    const urls = buildImageCandidates(raw);
    if (urls.length) {
      appendImgWaterfall(urls);
      return wrap;
    }
    const nu = normalizeImageUrl(raw);
    if (nu) appendImgWaterfall([nu]);
    else showPlaceholder();
    return wrap;
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
          <button type="button" class="collection-actions-back" id="collectionActionsBack">← SELECT MORE COLLECTIONS</button>
          <button type="button" class="collection-actions-close" id="collectionActionsCloseX" aria-label="Close">×</button>
        </div>
        <img class="collection-actions-topBanner" src="src/assets/images/header.png" alt="" aria-hidden="true" />
        <h3 class="collection-actions-title" id="collectionActionsTitle"></h3>
      </div>

      <div class="collection-actions-body">
        <p class="collection-actions-summary" id="collectionActionsSummary"></p>

        <div class="collection-actions-btns">
          <button type="button" class="btn collection-actions-choice" id="collectionActionsLogo">Add collection logo</button>
          <button type="button" class="btn collection-actions-choice" id="collectionActionsSelectAll">Select all NFTs</button>
          <button type="button" class="btn collection-actions-choice" id="collectionActionsSelectManual">Select manually</button>
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

  if (btnAll) {
    btnAll.disabled = !hasNfts;
    btnAll.classList.toggle("collection-actions-choice--active", mode === "all");
  }
  if (btnManual) {
    btnManual.disabled = !hasNfts;
    btnManual.classList.toggle("collection-actions-choice--active", mode === "manual");
  }
  if (btnLogo) {
    btnLogo.disabled = !canAddLogo;
    btnLogo.setAttribute("aria-pressed", logoOn ? "true" : "false");
    btnLogo.classList.toggle("collection-actions-choice--active", logoOn && canAddLogo);
    btnLogo.textContent = logoOn ? "Collection logo in grid" : "Add collection logo";
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
      const nfts = await fetchNFTsFromWorker({
        wallet,
        chain,
        contractAddresses: normAddr,
      }).catch(() => []);
      allNfts.push(...(nfts || []));
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
    const normalized = validNfts.map((n) => normalizeNFT(n, chain));
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
  const wm = document.getElementById("wmGrid");
  const p = getGridPrimary();
  const o = getGridOverflow();
  if (wm && p) {
    const stack = p.closest(".gridStack");
    const wrap = p.closest(".gridWrap");
    if (stack) stack.appendChild(wm);
    else if (wrap) wrap.appendChild(wm);
  }
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
  for (const wrapId of ["stageLayoutPickerBtns", "settingsLayoutPicker"]) {
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
  refreshGridAfterCustomImagesCleared();
  renderCustomImagesPanel();
  updateBuildButtonAvailability();
  updateGuideGlow();
  setStatus("Custom images cleared");
  renderSettingsPanel();
}

/**
 * File-upload grid tiles only. Collection logo tiles also set `isCustom` for tile keys — they must
 * not be removed when clearing imports.
 */
function isUserImportedCustomGridItem(it) {
  return !!(it && it.isCustom === true && it.sourceKey === "custom");
}

/** Show “Remove imports” on the grid toolbar only when there are uploaded custom images. */
function syncGridRemoveImportedBtnVisibility() {
  const btn = $("gridRemoveImportedBtn");
  if (!btn) return;
  const show = (state.customImages || []).length > 0;
  btn.hidden = !show;
  btn.setAttribute("aria-hidden", show ? "false" : "true");
}

/** If the live grid still shows imported tiles, drop them and re-render (classic / template). */
function refreshGridAfterCustomImagesCleared() {
  if (currentStep !== 3 || !Array.isArray(state.currentGridItems) || !state.currentGridItems.length) return;
  if (!state.currentGridItems.some((it) => isUserImportedCustomGridItem(it))) return;

  const meta = state.gridLayoutMeta;
  const filtered = state.currentGridItems.filter((it) => !isUserImportedCustomGridItem(it));
  const dense = filtered.filter((it) => !isGridSlotEmpty(it));
  BUILD_ID = Date.now();

  if (meta?.mode === "template" && meta.layoutId) {
    renderFullLayoutFromItems(dense, meta.layoutId, BUILD_ID);
  } else if (meta?.mode === "classic" && meta.columns != null && meta.totalSlots != null) {
    const padded = buildClassicPaddedItems(dense, meta.totalSlots);
    state.currentGridItems = padded;
    syncOrderedItemsFromGrid();
    reapplyLayoutAfterOrderChange();
  } else {
    renderFullLayoutFromItems(dense, "classic", BUILD_ID);
  }
  enableDragDrop();
  if (state.imageLoadState.total > 0) updateImageProgress();
  requestAnimationFrame(syncWatermarkDOMToOneTile);
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
        <a class="settings-linkbtn" href="https://x.com/littleollienft" target="_blank" rel="noopener noreferrer">𝕏 Follow us on Twitter / X</a>
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
      <section class="settings-section settings-section--comingSoon" aria-label="Text (coming soon)">
        <h3 class="settings-section-title">Text</h3>
        <p class="settings-coming-soon">Coming soon</p>
        <p class="settings-hint settings-hint--muted">Caption and text styling will land here in a future update.</p>
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
  if (!list) {
    syncGridRemoveImportedBtnVisibility();
    return;
  }
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
  syncGridRemoveImportedBtnVisibility();
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
  let current = state.currentGridItems;
  let merged = getMergedSortedGridItems();
  if (merged.length > FLEX_GRID_MAX_NFTS) {
    merged = merged.slice(0, FLEX_GRID_MAX_NFTS);
  }
  if (!merged.length) return false;

  if (!Array.isArray(current) || current.length === 0) {
    const dim = computeGridDimensionsForCount(merged.length);
    const padded = buildClassicPaddedItems(merged, dim.totalSlots);
    state.currentGridItems = padded;
    syncOrderedItemsFromGrid();
    return true;
  }

  const keys = new Set(
    current
      .filter((it) => !isGridSlotEmpty(it))
      .map((it) => getGridItemKey(it))
      .filter(Boolean)
  );
  const additions = merged.filter((it) => !keys.has(getGridItemKey(it)));
  if (!additions.length) return false;
  // Preserve explicit empty slots: fill the first currently-empty cells, then append overflow.
  const next = current.slice();
  let ai = 0;
  for (let i = 0; i < next.length && ai < additions.length; i++) {
    if (isGridSlotEmpty(next[i])) {
      next[i] = additions[ai++];
    }
  }
  while (ai < additions.length) {
    next.push(additions[ai++]);
  }
  state.currentGridItems = next;
  syncOrderedItemsFromGrid();
  return true;
}

/** Classic grid: grow columns/rows when a new import does not fit the current slot count (e.g. full 3×3 + import). */
function expandClassicGridAfterImportOverflow() {
  const meta = state.gridLayoutMeta;
  if (meta?.mode !== "classic" || meta.totalSlots == null) return false;
  const arr = state.currentGridItems;
  if (!Array.isArray(arr)) return false;
  const dense = arr.filter((it) => !isGridSlotEmpty(it));
  if (dense.length <= meta.totalSlots && arr.length <= meta.totalSlots) return false;

  const dim = computeGridDimensionsForCount(dense.length);
  const padded = buildClassicPaddedItems(dense, dim.totalSlots);
  state.currentGridItems = padded;
  syncOrderedItemsFromGrid();
  BUILD_ID = Date.now();
  renderFullLayoutFromItems(padded, "classic", BUILD_ID, {
    cols: dim.cols,
    rows: dim.rows,
    totalSlots: dim.totalSlots,
  });
  return true;
}

function finalizeCustomImageImport(addedCount) {
  if (!addedCount) return;
  if (currentStep === 3) {
    if (appendNewItemsToCurrentGridFromSelection()) {
      if (!expandClassicGridAfterImportOverflow()) {
        reapplyLayoutAfterOrderChange();
      } else {
        enableDragDrop();
        if (state.imageLoadState.total > 0) updateImageProgress();
        requestAnimationFrame(syncWatermarkDOMToOneTile);
      }
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

/** Index of first non-empty collection-logo tile in grid order (for shuffle pinning). */
function findFirstCollectionLogoIndex(items) {
  const arr = items || [];
  return arr.findIndex((it) => !isGridSlotEmpty(it) && it.isLogo);
}

function shuffleCurrentGridOrder() {
  const items = state.currentGridItems;
  if (!items?.length) return;
  const meta = state.gridLayoutMeta;
  let nextItems;
  if (meta?.mode === "classic" && meta.totalSlots != null) {
    const dense = items.filter((it) => !isGridSlotEmpty(it));
    const li = findFirstCollectionLogoIndex(dense);
    const headLogo = li >= 0 ? dense[li] : null;
    const pool =
      li >= 0 ? dense.slice(0, li).concat(dense.slice(li + 1)) : dense.slice();
    if (!headLogo && pool.length < 2) return;
    if (headLogo && pool.length < 1) return;
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const denseNext = headLogo ? [headLogo, ...arr] : arr;
    nextItems = buildClassicPaddedItems(denseNext, meta.totalSlots);
  } else {
    const arr0 = items.slice();
    const li = findFirstCollectionLogoIndex(arr0);
    const headLogo = li >= 0 ? arr0[li] : null;
    const pool =
      li >= 0 ? arr0.slice(0, li).concat(arr0.slice(li + 1)) : arr0.slice();
    if (!headLogo && pool.length < 2) return;
    if (headLogo && pool.length < 1) return;
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    nextItems = headLogo ? [headLogo, ...arr] : arr;
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

  syncSelectedKeysFromSelection();
  if (state.selectedKeys.size > 0) {
    state.selectedCustomImageIds.clear();
    renderCustomImagesPanel();
    updateBuildButtonAvailability();
    updateGuideGlow();
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

  const stageMeta = $("stageMeta");
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

/** Prefer `dataset.rawUrl`; fall back to `currentGridItems` so Retry missing still works if DOM attrs were cleared. */
function getRawArtUrlForGridTile(tile) {
  const fromDom = (tile?.dataset?.rawUrl || "").trim();
  if (fromDom) return fromDom;
  const key = (tile?.dataset?.key || "").trim();
  if (!key) return "";
  const collKeyNorm = (s) => String(s || "").trim().toLowerCase();
  const wantColl = collKeyNorm(tile?.dataset?.collectionKey);
  const items = state.currentGridItems || [];
  const tryMatch = (requireCollMatch) => {
    for (const it of items) {
      if (isGridSlotEmpty(it)) continue;
      if (getGridItemKey(it) !== key) continue;
      if (requireCollMatch && wantColl && collKeyNorm(it?.sourceKey) !== wantColl) continue;
      let raw = "";
      try {
        if (typeof it?._rawImageUrl === "string" && it._rawImageUrl.trim()) raw = it._rawImageUrl.trim();
        if (!raw && typeof it?.image === "string" && it.image.trim()) raw = it.image.trim();
        if (!raw) raw = primaryRawArtUrlForNft(it).trim();
      } catch (_) {
        raw = "";
      }
      if (raw) return raw;
    }
    return "";
  };
  let r = tryMatch(true);
  if (!r && wantColl) r = tryMatch(false);
  return r || "";
}

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
    const rawUrl = getRawArtUrlForGridTile(tile);
    if (!rawUrl) return Promise.resolve();
    try {
      tile.dataset.rawUrl = rawUrl;
    } catch (_) {}
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
  const raw = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!raw) {
    markMissing(tile, img, rawUrl);
    state.imageLoadState.failed++;
    updateImageProgress();
    return false;
  }

  if (raw.startsWith("blob:")) {
    tile.dataset.ipfsPath = "";
  } else {
    tile.dataset.ipfsPath = getIpfsPath(raw) || "";
  }

  const res = await resolveRawUrlOntoImage(img, raw);
  if (res.ok) {
    const win = (res.winningUrl || (img.currentSrc || img.src || "")).trim();
    tile.dataset.src = win;
    tile.classList.remove("isMissing");
    tile.classList.add("isLoaded");
    state.imageLoadState.loaded++;
    updateImageProgress();
    return true;
  }

  markMissing(tile, img, rawUrl);
  state.imageLoadState.failed++;
  updateImageProgress();
  if (!raw.startsWith("blob:")) {
    errorLog.imageErrorCount = (errorLog.imageErrorCount || 0) + 1;
    if (errorLog.imageErrorCount <= (errorLog.imageErrorThrottleMax ?? 3)) {
      addError(new Error("Image failed after fallback: " + raw), "Image Loading");
    }
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

  let raw = "";
  try {
    if (typeof it?._rawImageUrl === "string" && it._rawImageUrl.trim()) raw = it._rawImageUrl.trim();
    if (!raw && typeof it?.image === "string" && it.image.trim()) raw = it.image.trim();
    if (!raw) raw = primaryRawArtUrlForNft(it).trim();
  } catch (_) {
    raw = "";
  }
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
let loadWalletsInFlight = false;
let loadWalletsDebounceTimer = null;

/** Debounced load so rapid clicks / key repeats do not stack multiple Worker runs (saves Alchemy CU). */
function triggerLoadWallets() {
  clearTimeout(loadWalletsDebounceTimer);
  loadWalletsDebounceTimer = setTimeout(() => {
    loadWalletsDebounceTimer = null;
    void loadWallets();
  }, 400);
}

async function loadWallets() {
  syncWalletsFromInput();
  applyChainSelectionFromDom();
  const chain = String($("chainSelect")?.value || state.chain || "eth").trim().toLowerCase();

  if (chain === "solana") return setStatus("Solana coming soon. For now use ETH or Base.");
  if (!state.wallets.length) {
    return setStatus("👋 Enter at least one valid wallet — 0x + 40 hex chars. Separate several with a comma, space, or new line.");
  }

  if (!configLoaded) {
    return setStatus(
      "⚠️ Configuration not loaded. " +
        "Ensure the Worker config is available at " + getWorkerBase() + "/api/config/flex-grid"
    );
  }

  const host = ALCHEMY_HOST[chain];
  if (chain !== "apechain" && !host) return setStatus("Chain not configured.");

  if (loadWalletsInFlight) {
    console.warn("[FlexGrid] Prevented overlapping loadWallets (already in progress)");
    return;
  }
  loadWalletsInFlight = true;

  try {
    try {
      console.log("[FlexGrid] Chain selected:", chain, "→", getAlchemyNetworkId(chain));
    } catch {
      console.log("[FlexGrid] Chain selected:", chain);
    }

    state.chain = chain;
    state.host = chain === "apechain" ? null : host;

    state.contractLogoCache = Object.create(null);
    state.contractLogoInflight.clear();

    const gatherMsg = "Gathering your NFTs";
    showLoading(gatherMsg, "");
    setStatus(`Loading NFTs… (${state.wallets.length} wallet(s))`);

    const allNfts = [];
    const WALLET_BATCH_SIZE = 3;
    for (let i = 0; i < state.wallets.length; i += WALLET_BATCH_SIZE) {
      const batch = state.wallets.slice(i, i + WALLET_BATCH_SIZE);
      const batchNum = Math.floor(i / WALLET_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(state.wallets.length / WALLET_BATCH_SIZE);
      showLoading(gatherMsg, "");
      setStatus(`Gathering NFTs… batch ${batchNum}/${totalBatches}.`);
      const results = await Promise.all(
        batch.map((w) => fetchNFTsFromWorker({ wallet: w, chain }))
      );
      results.forEach((nfts) => allNfts.push(...(nfts || [])));
    }

    showLoading(gatherMsg, "");
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
    const normalized = validNfts.map((n) => normalizeNFT(n, chain));
    if (chain === "apechain" && normalized.length > 0) {
      try {
        const s = normalized[0];
        console.log("[ApeChain Debug] NFT sample:", s);
        console.log("[ApeChain Debug] image fields:", {
          media: s?.media,
          rawMetadata: s?.rawMetadata,
          raw: s?.raw,
          _rawImageUrl: s?._rawImageUrl,
          _displayImageUrl: s?._displayImageUrl,
        });
      } catch (_) {}
    }
    const deduped = dedupeNFTs(normalized);
    const expanded = expandNFTs(deduped);
    if (DEV) console.log("EXPANDED NFT COUNT", expanded.length);
    const grouped = groupByCollection(expanded);
    window.allNFTs = allNfts;
    window.collections = grouped;
    const displayedCount = grouped.reduce((s, c) => s + (c.nfts?.length ?? 0), 0);
    if (DEV) console.log(`NFT load complete: total ${allNfts.length} fetched → ${deduped.length} deduped → ${expanded.length} expanded → ${displayedCount} in ${grouped.length} collections`);

    showLoading(gatherMsg, "");
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

    const stageMeta = $("stageMeta");
    if (stageMeta) stageMeta.textContent = "Wallets loaded — select collections, then 🧩 Build grid.";

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
    } else if (
      raw.includes("timed out") ||
      raw.includes("timeout") ||
      raw.includes("aborterror") ||
      raw.includes("abort")
    ) {
      const fromApi = String(err?.message || "").trim();
      userMsg =
        fromApi && (raw.includes("timed out") || raw.includes("timeout") || raw.includes("aborterror"))
          ? fromApi
          : "Request timed out. Try again in a moment.";
      if (!userMsg.toLowerCase().includes("this happens sometimes")) {
        userMsg += " This happens sometimes.";
      }
    }
    setStatus(`❌ ${userMsg}`);
    addError(err, "Load Wallets");
    showConnectionStatus(false);
  } finally {
    loadWalletsInFlight = false;
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
  const rawArt = primaryRawArtUrlForNft(nft);
  const image = rawArt
    ? (gridProxyUrl(rawArt) || normalizeImageUrl(rawArt) || TILE_PLACEHOLDER_SRC)
    : TILE_PLACEHOLDER_SRC;
  const m = mergedNFTMetadata(nft);
  const name =
    nft?.name ||
    nft?.title ||
    (typeof m?.name === "string" && m.name.trim()) ||
    nft?.metadata?.name ||
    (safeTokenId ? `#${safeTokenId}` : "Unnamed NFT");
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
  if (typeof nft._rawImageUrl === "string" && nft._rawImageUrl.trim()) item._rawImageUrl = nft._rawImageUrl.trim();
  if (typeof nft._displayImageUrl === "string" && nft._displayImageUrl.trim()) item._displayImageUrl = nft._displayImageUrl.trim();
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

/**
 * Normalize NFT into consistent shape with _contractAddress, _tokenId, _tokenType, _balance, _chain.
 * Safe for Alchemy v2/v3 payloads (missing contract or media does not throw).
 */
function normalizeNFT(nft, chain) {
  const _chain = String(chain || state.chain || "eth").toLowerCase();
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
  const merged = mergedNFTMetadata(nft);
  const name =
    (typeof nft.name === "string" && nft.name.trim()) ||
    (typeof nft.title === "string" && nft.title.trim()) ||
    (typeof merged?.name === "string" && merged.name.trim()) ||
    (typeof nft.metadata?.name === "string" && nft.metadata.name.trim()) ||
    "Unnamed NFT";
  const collectionName =
    (typeof nft.collection?.name === "string" && nft.collection.name.trim()) ||
    (typeof nft.contract?.name === "string" && nft.contract.name.trim()) ||
    (typeof nft.contractMetadata?.name === "string" && nft.contractMetadata.name.trim()) ||
    "Unknown Collection";
  let rawImage = null;
  try {
    rawImage = primaryRawArtUrlForNft(nft);
    rawImage = rawImage ? String(rawImage).trim() : null;
  } catch (err) {
    console.warn("[FlexGrid] normalizeNFT image:", err?.message || err);
    rawImage = null;
  }
  const displayImage = rawImage ? (toProxyUrl(rawImage) || normalizeImageUrl(rawImage) || null) : null;
  return {
    ...nft,
    _contractAddress,
    _tokenId,
    _tokenType,
    _balance,
    _chain,
    name,
    collection: nft.collection && typeof nft.collection === "object" ? { ...nft.collection, name: collectionName } : { name: collectionName },
    _rawImageUrl: rawImage,
    _displayImageUrl: displayImage,
    image: displayImage || rawImage || (typeof nft.image === "string" ? nft.image : null) || null,
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
  const merged = mergedNFTMetadata(nft);
  const candidates = [
    merged.image,
    merged.image_url,
    nft?.media?.[0]?.thumbnail,
    nft?.media?.[0]?.gateway,
    nft?.media?.[0]?.raw,
    nft?.raw?.metadata?.image,
    nft?.raw?.metadata?.image_url,
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
    if (typeof c === "object" && c) {
      const ou =
        (typeof c.url === "string" && c.url.trim()) ||
        (typeof c.uri === "string" && c.uri.trim()) ||
        (typeof c.gateway === "string" && c.gateway.trim()) ||
        "";
      if (ou) {
        const s = repairBrokenImageUrl(String(ou).trim());
        if (!s) continue;
        if (normLogo && s === normLogo) continue;
        return s;
      }
      continue;
    }
    const s = repairBrokenImageUrl(String(c).trim());
    if (!s || s === "[object Object]") continue;
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
      collections[k].logo = getCollectionLogoUrlForRow(collections[k]);
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

/** Slightly larger than layout rect — softens JPEG seams; see EXPORT_TILE_BLEED (kept small to avoid tile overlap). */
function exportTileDrawRect(x, y, w, h) {
  const bleed = EXPORT_TILE_BLEED;
  const ox = w * (bleed / 2);
  const oy = h * (bleed / 2);
  return { x: x - ox, y: y - oy, w: w * (1 + bleed), h: h * (1 + bleed) };
}

/** Classic grid may lead with empty filler cells — match pblo to first real tile if possible. */
function flexGridFirstTileForPbloAnchor(tiles) {
  if (!tiles?.length) return null;
  for (const t of tiles) {
    if (t?.dataset?.kind === "empty") continue;
    return t;
  }
  return tiles[0];
}

/** Match CSS object-fit: cover; object-position: center (no stretch). */
function drawImageCover(ctx, img, dx, dy, dw, dh) {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh || !dw || !dh) return;
  const scale = Math.max(dw / nw, dh / nh);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (nw - sw) / 2;
  const sy = (nh - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * PNG export: screen `<img>` can look loaded while canvas draw still fails (decode race, WebKit paint,
 * or rare CORS quirks). Decode + drawImage, then createImageBitmap, then re-fetch via proxy/gateways.
 */
async function drawImageCoverWithExportFallbacks(ctx, tile, img, dx, dy, dw, dh) {
  if (!img || tile?.dataset?.kind === "empty") {
    drawPlaceholder(ctx, dx, dy, dw, dh);
    return;
  }
  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch (_) {}
  }
  if (isImgUsable(img)) {
    try {
      drawImageCover(ctx, img, dx, dy, dw, dh);
      return;
    } catch (e) {
      if (DEV) console.warn("[export] drawImageCover failed, retrying", e);
    }
  }
  try {
    if (typeof createImageBitmap === "function" && isImgUsable(img)) {
      const bmp = await createImageBitmap(img);
      try {
        drawImageCover(ctx, bmp, dx, dy, dw, dh);
        return;
      } finally {
        if (typeof bmp.close === "function") bmp.close();
      }
    }
  } catch (_) {}

  const tryFetchBitmap = async (url) => {
    if (!url || typeof url !== "string" || typeof createImageBitmap !== "function") return false;
    const u = url.trim();
    if (!u || u.startsWith("data:")) return false;
    const res = await fetch(u, { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!res.ok) return false;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    try {
      drawImageCover(ctx, bmp, dx, dy, dw, dh);
      return true;
    } finally {
      if (typeof bmp.close === "function") bmp.close();
    }
  };

  const directSrc = (img.currentSrc || img.src || "").trim();
  try {
    if (await tryFetchBitmap(directSrc)) return;
  } catch (_) {}

  const raw = (tile?.dataset?.rawUrl || "").trim();
  if (raw) {
    const urls = buildImageCandidates(raw);
    for (let i = 0; i < urls.length; i++) {
      try {
        if (await tryFetchBitmap(urls[i])) return;
      } catch (_) {}
    }
  }

  drawPlaceholder(ctx, dx, dy, dw, dh);
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

/** Post-export share sheet (X intent + follow). Shown only after successful grid/GIF export. */
const FLEXGRID_SHARE_PAGE_URL = "https://littleollielabs.com/flexgrid/";
const FLEXGRID_SHARE_TWEET_TEXT =
  "Just turned my NFTs into a FlexGrid 🔥 Multi-chain now live (ETH, Base, ApeChain) 👀";
/**
 * Strict ASCII prefill for Web Intent (X rejects many Unicode chars in query, e.g. em dash U+2014).
 * Link is appended in the same `text` value — skip separate `url` param (fewer edge-case failures).
 */
const FLEXGRID_SHARE_INTENT_BODY =
  "Just turned my NFTs into a FlexGrid - ETH, Base, ApeChain are live. Try it:";

function buildXIntentTweetUrl(_shareText, shareUrl) {
  try {
    const link = String(shareUrl || "").trim() || FLEXGRID_SHARE_PAGE_URL;
    const body = `${FLEXGRID_SHARE_INTENT_BODY} ${link}`.replace(/\s+/g, " ").trim();
    const u = new URL("https://twitter.com/intent/tweet");
    u.searchParams.set("text", body.slice(0, 280));
    return u.href;
  } catch (_) {
    return "https://twitter.com/intent/tweet";
  }
}

function createShareModal({ shareText, shareUrl }) {
  document.querySelector(".flexgrid-share-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "flexgrid-share-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "flexgrid-share-title");

  const modal = document.createElement("div");
  modal.className = "flexgrid-share-modal";
  modal.innerHTML = `
    <div class="flexgrid-share-content">
      <img class="flexgrid-share-banner" src="src/assets/images/header.png" alt="" width="560" height="120" decoding="async" aria-hidden="true" />
      <div class="flexgrid-share-inner">
        <h2 id="flexgrid-share-title">🔥 Your FlexGrid is ready</h2>
        <p class="flexgrid-share-sub">Show it off on X and tag us 👇</p>
        <div class="flexgrid-share-buttons">
          <a href="#" id="flexgrid-share-intent" target="_blank" rel="noopener noreferrer" class="flexgrid-share-btn flexgrid-share-btn--primary">Share on X</a>
          <a href="https://x.com/littleollienft" target="_blank" rel="noopener noreferrer" class="flexgrid-share-btn flexgrid-share-btn--secondary">Follow @littleollienft</a>
        </div>
        <button type="button" class="flexgrid-share-close">Close</button>
      </div>
    </div>
  `;

  const intent = modal.querySelector("#flexgrid-share-intent");
  if (intent instanceof HTMLAnchorElement) {
    intent.href = buildXIntentTweetUrl(shareText, shareUrl);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
  };

  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKeyDown);

  modal.addEventListener("click", (e) => e.stopPropagation());
  modal.querySelector(".flexgrid-share-close")?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
}

/** Fire after download has been triggered; deferred so export is never blocked. */
function offerFlexGridShareAfterExport() {
  requestAnimationFrame(() => {
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(
          `${FLEXGRID_SHARE_TWEET_TEXT} ${FLEXGRID_SHARE_PAGE_URL}`.replace(/\s+/g, " ").trim()
        );
      }
    } catch (_) {}
    createShareModal({
      shareText: FLEXGRID_SHARE_TWEET_TEXT,
      shareUrl: FLEXGRID_SHARE_PAGE_URL,
    });
  });
}

function isImgUsable(img) {
  return img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
}

async function waitForExportImages(tiles) {
  const imgs = tiles.map((t) => t.querySelector("img")).filter(Boolean);
  await Promise.all(
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
          setTimeout(done, 15000);
        })
    )
  );
  await Promise.all(
    imgs.map(async (img) => {
      if (typeof img.decode !== "function") return;
      try {
        await img.decode();
      } catch (_) {}
    })
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
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

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
      await drawImageCoverWithExportFallbacks(ctx, tile, img, dx, dy, dw, dh);
    }

    try {
      const pbloImg = await loadImageWithRetry("src/assets/images/pblo.png", 2, 8000);
      const first = flexGridFirstTileForPbloAnchor(tiles);
      if (first && pbloImg && pbloImg.naturalWidth > 0) {
        const fr = first.getBoundingClientRect();
        const x = pad + (fr.left - gridRect.left);
        const y = pad + (fr.top - gridRect.top);
        const { x: dx, y: dy, w: dtw, h: dth } = exportTileDrawRect(x, y, fr.width, fr.height);
        const { px, py, drawW, drawH } = flexGridPbloLayoutInTileRect(
          dx,
          dy,
          dtw,
          dth,
          pbloImg.naturalWidth,
          pbloImg.naturalHeight
        );
        ctx.drawImage(pbloImg, px, py, drawW, drawH);
      }
    } catch (e) {
      console.warn("pblo overlay failed for PNG export:", e);
    }

    await saveCanvasPNG(canvas, "lo-grid.jpg");

    setStatus("✨ Saved! Check your downloads");
    updateGuideGlow();
    offerFlexGridShareAfterExport();
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
    return new URL("vendor/gif.worker.js", document.baseURI || window.location.href).href;
  } catch (e) {
    return "vendor/gif.worker.js";
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
  if (!img) return;
  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
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
      var downloadOk = false;
      try {
        if (blob) {
          var outBlob = blob && blob.type === "image/gif" ? blob : new Blob([blob], { type: "image/gif" });
          var url = URL.createObjectURL(outBlob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "lo-grid.gif";
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
          downloadOk = true;
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 4000);
        }
      } catch (e) {
        console.error(e);
      }
      if (downloadOk) offerFlexGridShareAfterExport();
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
    const why = e instanceof Error && e.message ? e.message : String(e || "");
    setStatus(
      why
        ? "😕 GIF export failed: " + (why.length > 120 ? why.slice(0, 117) + "…" : why)
        : "😕 GIF export failed. Try again?"
    );
    console.error(e);
    if (gifBtn) gifBtn.disabled = false;
    if (pngBtn) pngBtn.disabled = false;
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
  const header = $("traitOrderSectionHeader");
  if (el) {
    if (state.traitOrderCollapsed) el.classList.add("collapsed");
    else el.classList.remove("collapsed");
  }
  if (header) header.setAttribute("aria-expanded", state.traitOrderCollapsed ? "false" : "true");
}

function toggleStageLayoutSection() {
  const el = $("stageLayoutSection");
  const header = $("stageLayoutSectionHeader");
  if (!el) return;
  el.classList.toggle("collapsed");
  const collapsed = el.classList.contains("collapsed");
  if (header) header.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

// ---------- Events + Retry ----------
(function bindEvents() {
  const hubBackBtn = $("hubBackBtn");
  if (hubBackBtn && !hubBackBtn.dataset.boundHubBack) {
    hubBackBtn.dataset.boundHubBack = "1";
    hubBackBtn.addEventListener("click", onHubBackClick);
  }
  syncHubBackButton();

  const walletInput = $("walletInput");
  if (walletInput) {
    walletInput.autocapitalize = "none";
    walletInput.autocomplete = "off";
    walletInput.spellcheck = false;
    walletInput.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        triggerLoadWallets();
      }
    });
    walletInput.addEventListener("input", () => {
      if (walletValidationDebounce) clearTimeout(walletValidationDebounce);
      walletValidationDebounce = setTimeout(() => {
        syncWalletsFromInput();
        walletValidationDebounce = null;
      }, 200);
    });
    walletInput.addEventListener("blur", () => {
      if (walletValidationDebounce) clearTimeout(walletValidationDebounce);
      walletValidationDebounce = null;
      syncWalletsFromInput();
    });
  }

  const selectAllBtn = $("selectAllBtn");
  const selectNoneBtn = $("selectNoneBtn");
  if (selectAllBtn) selectAllBtn.addEventListener("click", () => setAllCollections(true));
  if (selectNoneBtn) selectNoneBtn.addEventListener("click", () => setAllCollections(false));

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
  const gridImportImageBtn = $("gridImportImageBtn");
  if (gridImportImageBtn && importInput) gridImportImageBtn.addEventListener("click", () => importInput.click());

  const gridRemoveImportedBtn = $("gridRemoveImportedBtn");
  if (gridRemoveImportedBtn) {
    gridRemoveImportedBtn.addEventListener("click", () => {
      if (!state.customImages?.length) {
        setStatus("No imported images to remove");
        return;
      }
      clearAllCustomImages();
    });
  }

  const gridShuffleBtn = $("gridShuffleBtn");
  if (gridShuffleBtn) gridShuffleBtn.addEventListener("click", () => shuffleCurrentGridOrder());

  const chainSelect = $("chainSelect");
  if (chainSelect) {
    chainSelect.addEventListener("change", () => {
      applyChainSelectionFromDom();
      const ch = String(chainSelect.value || "eth").trim().toLowerCase();
      console.log("[FlexGrid] Chain selected:", ch);
    });
  }

  const loadBtn = $("loadBtn");
  if (loadBtn) loadBtn.addEventListener("click", triggerLoadWallets);
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
  if (collectionsBackBtn) collectionsBackBtn.addEventListener("click", () => goToStep(1));
  if (collectionsNextBtn) collectionsNextBtn.addEventListener("click", () => {
    if (!hasItemsForBuild()) {
      setStatus("🎯 Select collections or custom images to continue");
      return;
    }
    goToStep(3);
  });

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

  const stageLayoutSectionHeader = $("stageLayoutSectionHeader");
  if (stageLayoutSectionHeader) {
    stageLayoutSectionHeader.addEventListener("click", toggleStageLayoutSection);
    stageLayoutSectionHeader.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleStageLayoutSection(); }
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
    setStatus("");
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
