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
    "buildBtn",
    "exportBtn",
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
  const exportEnabled = !!$("exportBtn") && $("exportBtn").disabled === false;

  // Clear primaryCTA from all CTA buttons
  ["loadBtn", "buildBtn", "exportBtn"].forEach((id) => {
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
    setGuideGlow(["buildBtn"]);
    const buildBtn = $("buildBtn");
    if (buildBtn) buildBtn.classList.add("primaryCTA");
    return;
  }

  // 5) Grid built -> highlight export
  if (gridHasTiles) {
    setGuideGlow(["exportBtn"]);
    const exportBtn = $("exportBtn");
    if (exportBtn) exportBtn.classList.add("primaryCTA");
    return;
  }

  setGuideGlow([]);
}

const state = {
  collections: [],
  selectedKeys: new Set(),
  wallets: [],
  chain: "eth",
  host: "eth-mainnet.g.alchemy.com",
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
        clean();
        reject(new Error("Image failed: " + src));
      };

      // ✅ prevents broken icon / filename flash
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

  if (total === 0) {
    if (barWrap) barWrap.style.display = "none";
    if (retryBtn) retryBtn.classList.remove("pulseAlert");
    return;
  }

  const progress = Math.round((loaded / total) * 100);
  let statusMsg = `Loading images: ${loaded}/${total}`;
  if (failed > 0) statusMsg += ` • ${failed} failed`;
  if (retrying > 0) statusMsg += ` • retrying...`;

  setStatus(statusMsg);

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

function enableButtons() {
  const loadBtn = $("loadBtn");
  const buildBtn = $("buildBtn");
  const exportBtn = $("exportBtn");

  const hasWallets = state.wallets.length > 0;
  if (loadBtn) loadBtn.disabled = !hasWallets;
  if (buildBtn) buildBtn.disabled = state.selectedKeys.size === 0;
  if (exportBtn) exportBtn.disabled = true;

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
  if (ipfsPath) return "ipfs://" + ipfsPath;

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
  enableButtons();
  updateGuideGlow();
  setStatus(`✅ Nice! Wallet added (${state.wallets.length} total)`);
}

function removeWallet(w) {
  state.wallets = state.wallets.filter((x) => x !== w);
  renderWalletList();
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

      const buildBtn = $("buildBtn");
      const exportBtn = $("exportBtn");
      if (buildBtn) buildBtn.disabled = state.selectedKeys.size === 0;
      if (exportBtn) exportBtn.disabled = true;

      updateGuideGlow();
    });

    const label = document.createElement("div");
    label.style.minWidth = "0";

    const name = document.createElement("div");
    name.className = "collectionName";
    name.textContent = c.name;

    const count = document.createElement("div");
    count.className = "collectionCount";
    count.textContent = `${c.count} owned`;

    label.appendChild(name);

    row.appendChild(label);
    row.appendChild(count);
    wrap.appendChild(row);
  });
}

function setAllCollections(checked) {
  state.selectedKeys.clear();
  if (checked) state.collections.forEach((c) => state.selectedKeys.add(c.key));
  renderCollectionsList();

  const buildBtn = $("buildBtn");
  const exportBtn = $("exportBtn");
  if (buildBtn) buildBtn.disabled = state.selectedKeys.size === 0;
  if (exportBtn) exportBtn.disabled = true;

  updateGuideGlow();
}

function getSelectedCollections() {
  return state.collections.filter((c) => state.selectedKeys.has(c.key));
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
  if (!configLoaded || !ALCHEMY_KEY) {
    setAddStatus("Configuration not loaded.");
    return;
  }
  const host = state.host || ALCHEMY_HOST[state.chain || "eth"];
  if (!host) {
    setAddStatus("Load wallets first to set chain.");
    return;
  }

  try {
    setAddStatus("Fetching…");
    let allNfts = [];
    for (const wallet of state.wallets) {
      const nfts = await fetchNFTsForContractsBatch({
        wallet,
        host,
        contractAddresses: [normAddr],
      }).catch(() => []);
      allNfts.push(...nfts);
    }

    // If Alchemy returns nothing, try Zora as fallback (e.g. OGenie)
    if (allNfts.length === 0 && (state.chain === "eth" || host?.includes("eth"))) {
      setAddStatus("Alchemy had none — trying Zora…");
      for (const wallet of state.wallets) {
        const nfts = await fetchNFTsFromZora({ wallet, contractAddress: normAddr }).catch(() => []);
        allNfts.push(...nfts);
      }
    }

    if (allNfts.length === 0) {
      setAddStatus("No NFTs found for this contract in your wallet(s). Try another chain or contract.");
      return;
    }

    const deduped = dedupeNFTs(allNfts);
    const newGrouped = groupByCollection(deduped);
    const newCol = newGrouped.find((c) => c.key === normAddr) || newGrouped[0];

    if (!newCol) {
      setAddStatus("Could not parse collection.");
      return;
    }

    state.collections = state.collections || [];
    const existing = state.collections.find((c) => c.key === normAddr);
    if (existing) {
      const seen = new Set(existing.items.map((i) => `${i.contract}:${i.tokenId}`));
      for (const it of newCol.items) {
        const k = `${it.contract}:${it.tokenId}`;
        if (!seen.has(k)) {
          seen.add(k);
          existing.items.push(it);
        }
      }
      existing.count = existing.items.length;
    } else {
      state.collections.push(newCol);
      state.collections.sort((a, b) => b.count - a.count);
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
  const all = [];
  chosen.forEach((c) => c.items.forEach((it) => all.push({ ...it, sourceKey: c.key })));
  return all;
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
state.originalGridKeys = [];
state.lastTraitType = "";

function normalizeTraitType(t) {
  const s = String(t || "").trim();
  if (!s) return "";
  const low = s.toLowerCase();

  if (low === "bg" || low === "b/g" || low === "background") return "Background";
  if (low === "hat" || low === "head" || low === "headwear") return "Hat";
  if (low === "eyes" || low === "eye") return "Eyes";
  if (low === "mouth" || low === "smile") return "Mouth";
  if (low === "body" || low === "skin") return "Body";
  if (low === "clothes" || low === "outfit") return "Clothes";

  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractAttributes(item) {
  const attrs = item?.attributes;
  if (!attrs) return [];
  if (Array.isArray(attrs)) return attrs;
  if (typeof attrs === "object") {
    return Object.entries(attrs).map(([k, v]) => ({ trait_type: k, value: v }));
  }
  return [];
}

function getTraitValue(item, traitType) {
  const want = normalizeTraitType(traitType);
  if (!want) return "";

  const attrs = extractAttributes(item);
  for (const a of attrs) {
    const tt = normalizeTraitType(a?.trait_type || a?.traitType || a?.type);
    if (!tt) continue;
    if (tt === want) {
      const v = a?.value;
      return v === null || v === undefined ? "" : String(v);
    }
  }
  return "";
}

function computeTraitTypes(items) {
  const counts = new Map();
  for (const it of items) {
    const attrs = extractAttributes(it);
    for (const a of attrs) {
      const tt = normalizeTraitType(a?.trait_type || a?.traitType || a?.type);
      if (!tt) continue;
      counts.set(tt, (counts.get(tt) || 0) + 1);
    }
  }

  const arr = [...counts.entries()]
    .filter(([_, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1]);

  return arr.slice(0, 10).map(([tt]) => tt);
}

function ensureTraitBar() {
  const stage = document.getElementById("stage");
  if (!stage) return null;

  let bar = document.getElementById("traitBar");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = "traitBar";
  bar.style.display = "flex";
  bar.style.flexWrap = "wrap";
  bar.style.gap = "8px";
  bar.style.padding = "8px 10px";
  bar.style.borderTop = "1px solid rgba(255,255,255,.12)";
  bar.style.background = "rgba(0,0,0,.10)";
  bar.style.alignItems = "center";

  const gridWrap = stage.querySelector(".gridWrap");
  if (gridWrap) stage.insertBefore(bar, gridWrap);
  else stage.appendChild(bar);

  return bar;
}

function renderTraitButtons(items) {
  const bar = ensureTraitBar();
  if (!bar) return;

  bar.innerHTML = "";

  const types = computeTraitTypes(items);
  if (!types.length) {
    const note = document.createElement("div");
    note.style.fontSize = "12px";
    note.style.opacity = "0.9";
    note.textContent = "Trait groups: (none found in metadata for this grid)";
    bar.appendChild(note);
    return;
  }

  const label = document.createElement("div");
  label.style.fontSize = "12px";
  label.style.fontWeight = "900";
  label.style.opacity = "0.95";
  label.textContent = "Group:";
  bar.appendChild(label);

  const originalBtn = document.createElement("button");
  originalBtn.type = "button";
  originalBtn.className = "btnSmall";
  originalBtn.textContent = "↩️ Original";
  originalBtn.addEventListener("click", () => {
    if (!state.originalGridKeys?.length) return;
    reorderGridByKeys(state.originalGridKeys);
    state.lastTraitType = "";
    setStatus("Order: original ✅");
  });
  bar.appendChild(originalBtn);

  types.forEach((tt) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btnSmall";
    b.textContent = tt;

    const isActive = state.lastTraitType === tt;
    if (isActive) {
      b.style.filter = "brightness(1.05)";
      b.style.boxShadow =
        "0 0 0 2px rgba(255,221,85,0.55), 0 10px 18px rgba(0,0,0,.18)";
    }

    b.addEventListener("click", () => applyTraitGrouping(tt));
    bar.appendChild(b);
  });

  const hint = document.createElement("div");
  hint.style.marginLeft = "auto";
  hint.style.fontSize = "12px";
  hint.style.opacity = "0.85";
  hint.textContent = "Click a trait to group tiles instantly.";
  bar.appendChild(hint);
}

function applyTraitGrouping(traitType) {
  const items = state.currentGridItems || [];
  if (!items.length) return;

  const want = normalizeTraitType(traitType);
  state.lastTraitType = want;

  const sorted = items
    .map((it, idx) => {
      const contract = (it?.contract || it?.contractAddress || it?.sourceKey || "").toLowerCase();
      const tokenId = (it?.tokenId || "").toString();
      const key = contract && tokenId ? `${contract}:${tokenId}` : "";

      let v = getTraitValue(it, want);
      v = v ? v.toLowerCase() : "~~~"; // missing last

      return { key, v, idx };
    })
    .filter((x) => x.key);

  sorted.sort((a, b) => {
    if (a.v < b.v) return -1;
    if (a.v > b.v) return 1;
    return a.idx - b.idx;
  });

  const keys = sorted.map((x) => x.key);
  reorderGridByKeys(keys);
  renderTraitButtons(items);

  setStatus(`Grouped by: ${want} ✅`);
}

function reorderGridByKeys(keys) {
  const grid = document.getElementById("grid");
  if (!grid) return;

  const tiles = Array.from(grid.querySelectorAll(".tile"));
  const map = new Map();
  const fillers = [];

  for (const t of tiles) {
    const k = t.dataset.key || "";
    if (k) map.set(k, t);
    else fillers.push(t);
  }

  grid.innerHTML = "";

  for (const k of keys) {
    const t = map.get(k);
    if (t) grid.appendChild(t);
  }

  for (const [k, t] of map.entries()) {
    if (!keys.includes(k)) grid.appendChild(t);
  }

  for (const f of fillers) grid.appendChild(f);

  requestAnimationFrame(() => {
    try { syncWatermarkDOMToOneTile(); } catch (e) {}
    try { enableDragDrop(); } catch (e) {}
    try { updateGuideGlow(); } catch (e) {}
  });
}

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
  const exportBtn = $("exportBtn");

  if (!chosen.length) {
    setStatus("🎯 Pick at least one collection to build your grid!");
    if (exportBtn) exportBtn.disabled = true;
    return;
  }

  let items = flattenItems(chosen); // ✅ always fill in order

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

  // ✅ Remember current grid NFTs for instant trait grouping
  state.currentGridItems = usedItems.slice();
  state.originalGridKeys = usedItems
    .map((it) => {
      const c = (it?.contract || it?.contractAddress || it?.sourceKey || "").toLowerCase();
      const t = (it?.tokenId || "").toString();
      return c && t ? `${c}:${t}` : "";
    })
    .filter(Boolean);
  state.lastTraitType = "";

  setGridColumns(cols);

  const grid = $("grid");
  if (!grid) return;
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

  for (let i = 0; i < usedItems.length; i++) grid.appendChild(makeNFTTile(usedItems[i]));
  const remaining = totalSlots - usedItems.length;
  for (let j = 0; j < remaining; j++) grid.appendChild(makeFillerTile());

  const wm = $("wmGrid");
  if (wm) wm.style.display = "block";

  requestAnimationFrame(syncWatermarkDOMToOneTile);

  if (exportBtn) exportBtn.disabled = false;

  if (state.imageLoadState.total > 0) updateImageProgress();
  else setStatus("🔥 Your grid is ready! (drag tiles to reorder on desktop)");

  enableDragDrop();
  updateGuideGlow();
  renderTraitButtons(state.currentGridItems);
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
}

async function fetchBestAlchemyImage({ contract, tokenId, host }) {
  const meta = await fetchAlchemyNFTMetadata({ contract, tokenId, host });

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
      const metaUrl = await fetchBestAlchemyImage({ contract, tokenId, host: state.host });
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
    // Strategy 3: Direct (DISPLAY-ONLY) fallback (non-IPFS only)
    if (!ipfsPath && /^https?:\/\//i.test(primary)) {
      try {
        setImgCORS(img, false);
        await loadImgNoLimit(img, primary, IMG_LOAD.gridDirectTimeoutMs);
        state.imageLoadState.loaded++;
        updateImageProgress();
        tile.dataset.kind = "loaded";
        tile.classList.remove("isMissing");
        tile.classList.add("isLoaded");
        return true;
      } catch (_) {
        // continue
      } finally {
        setImgCORS(img, true);
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

  const contract = (it?.contract || it?.contractAddress || it?.sourceKey || "").toLowerCase();
  const tokenId = (it?.tokenId || "").toString();
  tile.dataset.contract = contract;
  tile.dataset.tokenId = tokenId;
  tile.dataset.key = contract && tokenId ? `${contract}:${tokenId}` : "";

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

  if (!configLoaded || !ALCHEMY_KEY) {
    return setStatus(
      "⚠️ Configuration not loaded. " +
        "Please set up secure config (see docs/FLEX_GRID_SETUP.md). " +
        "For development, enable DEV_CONFIG in config.js"
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
      const nfts = await fetchAlchemyNFTs({ wallet: w, host });
      allNfts.push(...(nfts || []));
    }

    showLoading("🎨 Sorting your collections...", "", 85);
    const deduped = dedupeNFTs(allNfts);
    const grouped = groupByCollection(deduped);

    showLoading("✨ Almost ready...", "", 100);
    state.collections = grouped;
    state.selectedKeys = new Set();

    renderCollectionsList();
    showControlsPanel(true);
    updateGuideGlow();

    const buildBtn = $("buildBtn");
    const exportBtn = $("exportBtn");
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
  for (const nft of nfts) {
    try {
      const collectionKey = getCollectionKey(nft);
      const tokenId = (nft?.tokenId || "").toString();
      const key = `${collectionKey}:${tokenId}`;
      if (!tokenId || tokenId === "null") continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(nft);
    } catch (_) {}
  }
  return out;
}

function isPageKeySafe(pk) {
  if (!pk || typeof pk !== "string") return false;
  if (pk.includes("null")) return false;
  try {
    const decoded = decodeURIComponent(pk);
    if (decoded.includes("null")) return false;
  } catch (_) {}
  try {
    if (/^[A-Za-z0-9+/]+=*$/.test(pk.replace(/\s/g, ""))) {
      const b64 = atob(pk);
      if (b64.includes("null")) return false;
    }
  } catch (_) {}
  return true;
}

/** Contracts Alchemy discovery often misses — we always try to fetch these */
const PRIORITY_CONTRACTS = [
  "0x5b12e009e1b5f14b1e8f3a3b9fb3ca165702dcbd", // OGenie NFT
].map((a) => a.toLowerCase());

async function fetchAlchemyNFTsWithPageSize({ wallet, host, pageSize }) {
  const baseUrl = `https://${host}/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`;

  let pageKey = null;
  let all = [];
  let hit400 = false;
  const hardCap = 8000; // thorough: capture more collections for large wallets

  while (all.length < hardCap) {
    const url = new URL(baseUrl);

    url.searchParams.set("owner", wallet);
    url.searchParams.set("withMetadata", "true");
    url.searchParams.set("pageSize", String(pageSize));

    // ✅ ONLY use pageKey if it passes strict validation (avoids Alchemy "For input string: null" 400)
    if (isPageKeySafe(pageKey)) {
      url.searchParams.set("pageKey", pageKey);
    }

    let res;
    try {
      res = await fetch(url.toString());
    } catch (err) {
      console.error("NETWORK ERROR:", err);
      break;
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("❌ BAD RESPONSE:", res.status, errorText);

      hit400 = true;
      console.warn("⚠️ Stopping pagination, keeping loaded NFTs");
      break;
    }

    let json;
    try {
      json = await res.json();
    } catch (e) {
      console.error("INVALID JSON RESPONSE");
      break;
    }

    for (const n of json.ownedNfts || []) {
      try {
        if (n?.tokenId && n.tokenId !== "null" && String(n.tokenId).trim() !== "") all.push(n);
      } catch (_) {}
    }

    if (!isPageKeySafe(json.pageKey)) break;
    pageKey = json.pageKey;
  }

  return { nfts: all, hit400 };
}

function isValidContractAddress(addr) {
  return typeof addr === "string" && /^0x[a-f0-9]{40}$/i.test(addr.trim());
}

async function fetchNFTsForContractsBatch({ wallet, host, contractAddresses }) {
  const validAddrs = (contractAddresses || []).filter(isValidContractAddress);
  if (validAddrs.length === 0) return [];
  const baseUrl = `https://${host}/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`;
  const all = [];
  let pageKey = null;
  const maxPages = 15; // thorough: more pages per contract batch

  for (let p = 0; p < maxPages; p++) {
    const url = new URL(baseUrl);
    url.searchParams.set("owner", wallet);
    url.searchParams.set("withMetadata", "true");
    url.searchParams.set("pageSize", "100");
    for (const addr of validAddrs) url.searchParams.append("contractAddresses[]", addr);
    if (pageKey && isPageKeySafe(pageKey)) url.searchParams.set("pageKey", pageKey);

    const res = await fetch(url.toString());
    if (!res.ok) break;
    const json = await res.json().catch(() => ({}));
    const nfts = (json.ownedNfts || []).filter((n) => n?.tokenId && n.tokenId !== "null" && String(n.tokenId).trim() !== "");
    all.push(...nfts);
    if (!isPageKeySafe(json.pageKey)) break;
    pageKey = json.pageKey;
  }
  return all;
}

async function fetchAlchemyNFTs({ wallet, host }) {
  const mergeInto = (target, source) => {
    const seen = new Set();
    for (const n of target) {
      try {
        seen.add(`${getCollectionKey(n)}:${(n?.tokenId || "").toString()}`);
      } catch (_) {}
    }
    for (const n of source) {
      try {
        const key = `${getCollectionKey(n)}:${(n?.tokenId || "").toString()}`;
        if (!seen.has(key)) {
          seen.add(key);
          target.push(n);
        }
      } catch (_) {}
    }
  };

  // Use getNFTsForOwner only (no deprecated getContractsForOwner / getCollectionsForOwner)
  const chain = state.chain || "eth";
  let first = await fetchAlchemyNFTsWithPageSize({ wallet, host, pageSize: 25 });

  if (first.hit400) {
    setStatus("Retrying…");
    const retry = await fetchAlchemyNFTsWithPageSize({ wallet, host, pageSize: 10 });
    mergeInto(first.nfts, retry.nfts);
  }

  const haveContracts = new Set();
  for (const n of first.nfts) {
    const a = (n?.contract?.address || n?.collection?.address || n?.contractAddress || "").toLowerCase();
    if (a && /^0x[a-f0-9]{40}$/i.test(a)) haveContracts.add(a);
  }

  // Fallback: fetch priority contracts (e.g. OGenie) via getNFTsForOwner with contract filter
  const toFetch = PRIORITY_CONTRACTS.filter((a) => !haveContracts.has(a));
  for (const addr of toFetch) {
    setStatus(`Loading priority collection…`);
    let nfts = await fetchNFTsForContractsBatch({ wallet, host, contractAddresses: [addr] }).catch(() => []);
    if (nfts.length === 0 && (chain === "eth" || host?.includes("eth"))) {
      nfts = await fetchNFTsFromZora({ wallet, contractAddress: addr }).catch(() => []);
    }
    if (nfts.length > 0) mergeInto(first.nfts, nfts);
  }

  return first.nfts;
}

async function fetchAlchemyNFTMetadata({ contract, tokenId, host }) {
  if (!tokenId || tokenId === "null" || String(tokenId).trim() === "") {
    throw new Error("Invalid tokenId");
  }
  if (!contract || !/^0x[a-f0-9]{40}$/i.test(String(contract).trim())) {
    throw new Error("Invalid contract address");
  }
  const url = new URL(`https://${host}/nft/v3/${ALCHEMY_KEY}/getNFTMetadata`);
  url.searchParams.set("contractAddress", contract);
  url.searchParams.set("tokenId", String(tokenId));
  url.searchParams.set("refreshCache", "false");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Alchemy metadata error (${res.status})`);

  const json = await res.json();
  if (json.error) throw new Error(`Alchemy metadata error: ${json.error.message || JSON.stringify(json.error)}`);
  return json;
}

function groupByCollection(nfts) {
  const map = new Map();

  for (const nft of nfts) {
    try {
    const tokenId = (nft?.tokenId || "").toString();
    if (!tokenId || tokenId === "null" || tokenId.trim() === "") continue;

    const key = getCollectionKey(nft);
    const colName = nft?.contract?.name || nft?.collection?.name || nft?.title || "Unknown Collection";
    const name = nft?.name || (tokenId ? `#${tokenId}` : "NFT");

    const image =
      nft?.image?.cachedUrl ||
      nft?.image?.pngUrl ||
      nft?.image?.thumbnailUrl ||
      nft?.image?.originalUrl ||
      nft?.rawMetadata?.image ||
      "";

    const contractAddr = (
      nft?.contract?.address ||
      nft?.collection?.address ||
      nft?.contractAddress ||
      ""
    ).toLowerCase();

    if (!map.has(key)) map.set(key, { key, name: colName, count: 0, items: [] });

    const entry = map.get(key);
    entry.count++;

    const attributes =
      nft?.rawMetadata?.attributes ||
      nft?.rawMetadata?.metadata?.attributes ||
      nft?.metadata?.attributes ||
      nft?.contractMetadata?.openSea?.traits ||
      [];

    entry.items.push({
      name,
      tokenId,
      contract: contractAddr,
      image,
      sourceKey: key,
      attributes,
    });
    } catch (_) {}
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
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
  const buildBtn = $("buildBtn");
  const exportBtn = $("exportBtn");
  if (loadBtn) loadBtn.addEventListener("click", loadWallets);
  if (buildBtn) buildBtn.addEventListener("click", buildGrid);
  if (exportBtn) exportBtn.addEventListener("click", exportPNG);

  const retryBtn = $("retryBtn");
  if (retryBtn && typeof retryMissingTiles === "function") {
    retryBtn.addEventListener("click", retryMissingTiles);
  }

  const clearErrBtn = $("clearErrorLog");
  if (clearErrBtn) clearErrBtn.addEventListener("click", clearErrorLog);

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
    const buildBtn = $("buildBtn");
    const exportBtn = $("exportBtn");
    if (loadBtn) loadBtn.disabled = true;
    if (buildBtn) buildBtn.disabled = true;
    if (exportBtn) exportBtn.disabled = true;

    showConnectionStatus(false);
  }
}

initializeConfig();
enableButtons();
