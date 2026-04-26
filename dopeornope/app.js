import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { seedNFTs } from "./data.js";
import { loadNFTsFromWallet, groupNFTsByCollection, isValidEvmAddress } from "./nftLoader.js";

const $ = (id) => document.getElementById(id);

/** Global in-memory cache (filled from Firestore once per load). */
let allNFTs = [];
/** @type {Record<string, any>} */
let nftMap = {};

async function loadNFTsFromDB() {
  const q = query(collection(db, "nfts"), limit(200));
  const snapshot = await getDocs(q);

  allNFTs = [];
  nftMap = {};

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const nft = { ...data, _docId: docSnap.id };

    allNFTs.push(nft);
    nftMap[nft.id] = nft;
  });
}

async function addNFTsToDB(nfts) {
  const snapshot = await getDocs(collection(db, "nfts"));

  const existingIds = new Set();
  snapshot.forEach((d) => {
    const id = d.data()?.id;
    if (id) existingIds.add(id);
  });

  for (const nft of nfts) {
    if (!nft?.id || existingIds.has(nft.id)) continue;
    const { _docId, ...payload } = nft;
    await addDoc(collection(db, "nfts"), payload);
    existingIds.add(nft.id);
  }

  await loadNFTsFromDB();
}

async function voteNFT(nft, isHot) {
  const hot0 = Number(nft.votesHot) || 0;
  const cold0 = Number(nft.votesCold) || 0;

  if (!nft?._docId) {
    nft.votesHot = hot0 + (isHot ? 1 : 0);
    nft.votesCold = cold0 + (isHot ? 0 : 1);
    nftMap[nft.id] = nft;
    return;
  }

  const ref = doc(db, "nfts", nft._docId);

  const newHot = hot0 + (isHot ? 1 : 0);
  const newCold = cold0 + (isHot ? 0 : 1);

  await updateDoc(ref, {
    votesHot: newHot,
    votesCold: newCold,
  });

  nft.votesHot = newHot;
  nft.votesCold = newCold;
  nftMap[nft.id] = nft;
}

  const screenLoading = $("screen-loading");
  const screenMain = $("screen-main");
  const screenAdd = $("screen-add");

  const nftImg = $("nft-image");
  const nftSkeleton = $("nft-image-skeleton");
  const nftCollection = $("nft-collection");

  const btnHot = $("btn-hot");
  const btnCold = $("btn-cold");
  const btnAdd = $("btn-add");
  const btnBack = $("btn-back");

  const overlay = $("score-overlay");
  const overlayTitle = $("score-title");
  const overlaySubtitle = $("score-subtitle");
  const overlayVotes = $("score-votes");
  const microtext = $("microtext");
  const btnShare = $("btn-share");
  const shareSheet = $("share-sheet");
  const sharePreview = $("share-preview");
  const shareUrl = $("share-url");
  const btnShareClose = $("btn-share-close");
  const btnShareNative = $("btn-share-native");
  const btnShareDownload = $("btn-share-download");

  const walletInput = $("wallet-input");
  const btnLoadWallet = $("btn-load-wallet");
  const walletGrid = $("wallet-grid");
  const addNftMessage = $("add-nft-message");
  const selectedCount = $("selected-count");
  const btnSubmitNFTs = $("btn-submit-nfts");
  const addSuccess = $("add-success");

  /** @type {string[]} */
  const recentlySeen = [];
  let recentLimit = 20;

  /** @type {Map<string, HTMLImageElement>} */
  const preloadCache = new Map();

  /** @type {any[]} */
  let feedQueue = [];

  /** @type {any|null} */
  let currentNFT = null;

  let isTransitioning = false;

  /** One fresh line per NFT (avoid immediate repeat) */
  let lastMicroPhrase = "";

  const phrases = [
    "Dope or Nope? 🤔",
    "What’s the call?",
    "Be honest 😅",
    "Dope or nah?",
    "Quick decision 👇",
    "First instinct wins ⚡",
    "Trust your taste 👀",
    "No overthinking 😎",
    "Hot take time 🔥",
    "One tap, no drama ✨",
    "Would you flex it? 💪",
    "Main character energy? 🌟",
    "Is it giving… vibes? ✨",
    "Cop or drop? 🛒",
    "Keep it 100 🤝",
    "Gut check 👇",
    "Would you show a friend? 👯",
    "Iconic or mid? 😶",
    "Big yes or soft no? 🎲",
    "Would you double-tap? ❤️",
    "Is it a moment? ⏱️",
    "Would you save it? 📌",
    "Chef’s kiss or nah? 👨‍🍳",
    "Would you wear it on a shirt? 👕",
    "Would you put it on a sticker? 🧃",
    "Would you put it in your bio? 📝",
    "Would you hype it in the group chat? 💬",
    "Would you trade snacks for it? 🍿",
    "Would you wake up early for it? ⏰",
    "Would you put it on a playlist cover? 🎧",
    "Dope energy or pass? ⚡",
    "Nope vibes or yes? 🎯",
    "Snap judgment time ⏳",
    "Would you claim it? 🏆",
    "Too cool or too much? 😎",
    "Would you pin it? 📍",
    "Hall of fame or nah? 🏛️",
    "Would you mint the moment? 🪙",
    "Soft launch or smash hit? 📣",
    "Would you rock this? 🎸"
  ];

  let lastResult = null;
  let shareHideT = 0;
  let shareBlobUrl = "";

  function showScreen(name) {
    screenLoading.classList.toggle("screen--active", name === "loading");
    screenMain.classList.toggle("screen--active", name === "main");
    screenAdd.classList.toggle("screen--active", name === "add");
  }

  function updateRecentLimit() {
    const totalPool = allNFTs.length;
    recentLimit = totalPool < 30 ? 10 : 20;
  }

  function clampRecent(id) {
    recentlySeen.push(id);
    while (recentlySeen.length > recentLimit) recentlySeen.shift();
  }

  function totalVotes(nft) {
    return (nft.votesHot || 0) + (nft.votesCold || 0);
  }

  function vibeScore(nft) {
    const hot = nft.votesHot || 0;
    const cold = nft.votesCold || 0;
    const total = hot + cold;
    return ((hot + 3) / (total + 6)) * 10;
  }

  function pickPool() {
    return allNFTs;
  }

  function pickFromPool(pool) {
    if (!pool || pool.length === 0) return null;

    // Priority boost: if <5 votes, always prioritize these first
    const superFresh = pool.filter((n) => totalVotes(n) < 5);
    if (superFresh.length > 0) return superFresh[Math.floor(Math.random() * superFresh.length)] || null;

    const lowVote = pool.filter((n) => totalVotes(n) < 10);
    const preferLow = lowVote.length > 0 && Math.random() < 0.5;
    const source = preferLow ? lowVote : pool;
    return source[Math.floor(Math.random() * source.length)] || null;
  }

  function feedQueuedIds() {
    return new Set(feedQueue.map((n) => n.id));
  }

  function getNextNFT() {
    const pool = pickPool();
    if (!pool || pool.length === 0) return null;

    const blocked = new Set([...recentlySeen, ...feedQueuedIds()]);

    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      const nft = pickFromPool(pool);
      if (!nft) break;
      if (!blocked.has(nft.id)) return nft;
    }

    const candidates = pool.filter((n) => !blocked.has(n.id));
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)] || null;
    }

    // Tiny pool: everything is blocked — allow least-worst random from pool
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  function preloadImage(url) {
    if (!url) return Promise.resolve(null);
    if (preloadCache.has(url)) return Promise.resolve(preloadCache.get(url));
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.onload = () => {
        preloadCache.set(url, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function ensureQueue(targetLen) {
    let guard = 0;
    while (feedQueue.length < targetLen && guard++ < 100) {
      const next = getNextNFT();
      if (!next) break;
      if (feedQueue.some((n) => n.id === next.id)) continue;
      feedQueue.push(next);
      void preloadImage(next.image);
    }
  }

  function setButtonsEnabled(enabled) {
    btnHot.disabled = !enabled;
    btnCold.disabled = !enabled;
    btnAdd.disabled = !enabled;
  }

  async function renderNFT(nft) {
    currentNFT = nft;
    if (!nft) return;

    nftCollection.textContent = nft.collection || "—";
    nftSkeleton.classList.remove("is-hidden");
    nftImg.classList.add("is-reset");
    nftImg.classList.remove("is-ready", "vote-hot", "vote-cold");

    const cached = preloadCache.get(nft.image);
    if (!cached) await preloadImage(nft.image);

    // Swap image source after preload attempt
    nftImg.alt = `NFT from ${nft.collection || "collection"}`;
    nftImg.src = nft.image;

    // Wait a tick so CSS transitions apply nicely
    requestAnimationFrame(() => {
      nftSkeleton.classList.add("is-hidden");
      nftImg.classList.remove("is-reset");
      nftImg.classList.add("is-ready");
      refreshMicrotextForNewNFT();
    });
  }

  function showOverlay(kind, score, votes) {
    const icon = kind === "hot" ? "🔥" : "🧊";
    overlayTitle.textContent = `${icon} ${score.toFixed(1)}`;
    overlaySubtitle.textContent = "Dope Score";
    if (overlayVotes) overlayVotes.textContent = `${votes} vote${votes === 1 ? "" : "s"}`;
    overlay.classList.toggle("is-hot", kind === "hot");
    overlay.classList.toggle("is-cold", kind === "cold");
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
  }

  function hideOverlay() {
    overlay.classList.add("is-hiding");
    window.setTimeout(() => {
      overlay.classList.remove("is-visible", "is-hiding");
      overlay.classList.remove("is-hot", "is-cold");
      overlay.setAttribute("aria-hidden", "true");
    }, 520);
  }

  function refreshMicrotextForNewNFT() {
    if (!microtext) return;
    if (phrases.length === 0) return;

    let next = phrases[Math.floor(Math.random() * phrases.length)];
    let guard = 0;
    while (phrases.length > 1 && next === lastMicroPhrase && guard++ < 12) {
      next = phrases[Math.floor(Math.random() * phrases.length)];
    }
    lastMicroPhrase = next;

    microtext.classList.add("is-fading");
    window.setTimeout(() => {
      microtext.textContent = next;
      microtext.classList.remove("is-fading");
    }, 180);
  }

  function showShareCTA(result) {
    if (!btnShare) return;
    lastResult = result;
    btnShare.classList.add("is-visible");
    window.clearTimeout(shareHideT);
    shareHideT = window.setTimeout(() => btnShare.classList.remove("is-visible"), 2000);
  }

  function closeShareSheet() {
    if (!shareSheet) return;
    shareSheet.classList.remove("is-open");
    shareSheet.setAttribute("aria-hidden", "true");
    if (shareBlobUrl) {
      URL.revokeObjectURL(shareBlobUrl);
      shareBlobUrl = "";
    }
  }

  function openShareSheet() {
    if (!shareSheet) return;
    shareSheet.classList.add("is-open");
    shareSheet.setAttribute("aria-hidden", "false");
  }

  function loadImage(url, crossOrigin) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function buildShareCard(nft, kind, score) {
    const w = 900;
    const h = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");

    // background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#7bb9f9");
    grad.addColorStop(0.5, "#4a8df3");
    grad.addColorStop(1, "#2d6fd4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // card
    const pad = 56;
    const r = 34;
    const cardX = pad;
    const cardY = 168;
    const cardW = w - pad * 2;
    const cardH = 780;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, r);
    ctx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, r);
    ctx.arcTo(cardX, cardY + cardH, cardX, cardY, r);
    ctx.arcTo(cardX, cardY, cardX + cardW, cardY, r);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.restore();

    // NFT image
    const img = await loadImage(nft.image, true);
    const imgR = 28;
    const imgX = cardX + 34;
    const imgY = cardY + 34;
    const imgW = cardW - 68;
    const imgH = imgW;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imgX + imgR, imgY);
    ctx.arcTo(imgX + imgW, imgY, imgX + imgW, imgY + imgH, imgR);
    ctx.arcTo(imgX + imgW, imgY + imgH, imgX, imgY + imgH, imgR);
    ctx.arcTo(imgX, imgY + imgH, imgX, imgY, imgR);
    ctx.arcTo(imgX, imgY, imgX + imgW, imgY, imgR);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, imgX, imgY, imgW, imgH);
    ctx.restore();

    // score
    const icon = kind === "hot" ? "🔥" : "🧊";
    ctx.font = "900 62px ui-rounded, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#1e73ff";
    ctx.fillText(`${icon} ${score.toFixed(1)}`, cardX + 42, cardY + imgH + 140);

    ctx.font = "800 30px ui-rounded, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#0f2f6e";
    ctx.fillText("Vibe Score", cardX + 42, cardY + imgH + 186);

    // LO branding
    try {
      const logo = await loadImage("./assets/lo1.png", true);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(logo, w - pad - 88, 68, 72, 72);
      ctx.globalAlpha = 1;
    } catch {
      // ignore
    }

    // footer url
    const urlText = `Rate yours → ${window.location.href}`;
    ctx.font = "900 26px ui-rounded, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillText(urlText, pad, h - 64);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("no-blob");
    return blob;
  }

  async function advanceFeed() {
    clampRecent(currentNFT?.id);
    feedQueue.shift();
    await ensureQueue(4); // current + next 3
    await renderNFT(feedQueue[0]);
    // keep preloading next 3 for smoothness
    for (const n of feedQueue.slice(1, 4)) void preloadImage(n.image);
  }

  async function reloadFromFirestore(options = {}) {
    const { resetRecent } = options;
    await loadNFTsFromDB();
    if (!allNFTs.length) {
      await addNFTsToDB(seedNFTs);
    }
    if (!allNFTs.length) {
      allNFTs = seedNFTs.map((n) => ({ ...n }));
      nftMap = {};
      for (const n of allNFTs) nftMap[n.id] = n;
    }
    for (const row of allNFTs) {
      row.votesHot = Number(row.votesHot) || 0;
      row.votesCold = Number(row.votesCold) || 0;
    }
    updateRecentLimit();
    if (resetRecent) recentlySeen.length = 0;
    feedQueue = [];
    await ensureQueue(4);
    if (feedQueue[0]) await renderNFT(feedQueue[0]);
    for (const n of feedQueue.slice(1, 4)) void preloadImage(n.image);
  }

  async function handleVote(kind) {
    if (!currentNFT || isTransitioning) return;
    isTransitioning = true;
    setButtonsEnabled(false);

    const isHot = kind === "hot";
    const prevHot = Number(currentNFT.votesHot) || 0;
    const prevCold = Number(currentNFT.votesCold) || 0;
    try {
      await voteNFT(currentNFT, isHot);
    } catch {
      currentNFT.votesHot = prevHot;
      currentNFT.votesCold = prevCold;
    }

    const score = vibeScore(currentNFT);
    const votes = totalVotes(currentNFT);

    nftImg.classList.add(kind === "hot" ? "vote-hot" : "vote-cold");
    showOverlay(kind, score, votes);

    // Intentional reward pause (fast, not laggy)
    await new Promise((r) => setTimeout(r, 800));

    hideOverlay();
    // Share prompt right after score fades
    window.setTimeout(() => showShareCTA({ nft: currentNFT, kind, score, votes }), 140);

    await advanceFeed();

    setButtonsEnabled(true);
    isTransitioning = false;
  }

  function wireTapScale(button) {
    const press = () => button.classList.add("is-pressed");
    const release = () => {
      button.classList.remove("is-pressed");
      button.classList.add("is-bouncing");
      if (button === btnHot) button.classList.add("glow-hot");
      if (button === btnCold) button.classList.add("glow-cold");
      window.setTimeout(() => button.classList.remove("is-bouncing"), 160);
      window.setTimeout(() => button.classList.remove("glow-hot", "glow-cold"), 220);
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  }

  // --- Add Your NFTs (real wallet + mock fallback) ---
  let walletLoadedNFTs = [];
  let collectionGroups = {};
  let activeCollectionName = null;
  /** @type {Record<string, any>} */
  let selectedNFTs = {};
  const MAX_SELECTED_NFTS = 10;

  function hashStringToInt(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function makeMockWalletNFTs(wallet) {
    const base = hashStringToInt(wallet || "wallet");
    const out = [];
    for (let i = 0; i < 24; i++) {
      const seed = `${base}-${i}`;
      out.push({
        id: `mock_wallet${base}_${i}`,
        image: `https://picsum.photos/seed/lo-wallet-${seed}/600/600`,
        collection: "Demo wallet",
        name: `Demo #${i}`,
        votesHot: 0,
        votesCold: 0,
        createdAt: Date.now(),
        source: "mock",
      });
    }
    return out;
  }

  function showAddNFTMessage(text) {
    if (addNftMessage) addNftMessage.textContent = text || "";
  }

  function updateSelectedCount() {
    const count = Object.keys(selectedNFTs).length;
    selectedCount.textContent = `${count} / ${MAX_SELECTED_NFTS} selected`;
    btnSubmitNFTs.disabled = count === 0;
  }

  function toggleSelectNFT(nft) {
    if (selectedNFTs[nft.id]) {
      delete selectedNFTs[nft.id];
      updateSelectedCount();
      return;
    }

    if (Object.keys(selectedNFTs).length >= MAX_SELECTED_NFTS) {
      showAddNFTMessage("Max 10 NFTs selected.");
      return;
    }

    selectedNFTs[nft.id] = nft;
    showAddNFTMessage("");
    updateSelectedCount();
  }

  function renderCollectionList(groups) {
    activeCollectionName = null;
    walletGrid.innerHTML = "";

    const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

    if (!entries.length) {
      showAddNFTMessage("No collections found.");
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "collection-list";

    for (const [collectionName, nfts] of entries) {
      const item = document.createElement("button");
      item.className = "collection-item";
      item.type = "button";

      const nameEl = document.createElement("span");
      nameEl.className = "collection-name";
      nameEl.textContent = collectionName;

      const countEl = document.createElement("span");
      countEl.className = "collection-count";
      countEl.textContent = `${nfts.length} NFTs`;

      item.appendChild(nameEl);
      item.appendChild(countEl);

      item.addEventListener("click", () => {
        activeCollectionName = collectionName;
        renderCollectionNFTs(collectionName, nfts);
      });

      wrapper.appendChild(item);
    }

    walletGrid.appendChild(wrapper);
  }

  function renderCollectionNFTs(collectionName, nfts) {
    walletGrid.innerHTML = "";

    const header = document.createElement("div");
    header.className = "collection-picker-header";

    const backBtn = document.createElement("button");
    backBtn.className = "collection-back-btn";
    backBtn.type = "button";
    backBtn.textContent = "← Collections";
    backBtn.addEventListener("click", () => {
      renderCollectionList(collectionGroups);
    });

    const title = document.createElement("div");
    title.className = "active-collection-title";
    title.textContent = collectionName;

    header.appendChild(backBtn);
    header.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "nft-select-grid";

    for (const nft of nfts) {
      const tile = document.createElement("button");
      tile.className = "nft-select-tile";
      tile.type = "button";
      tile.dataset.nftId = nft.id;

      if (selectedNFTs[nft.id]) tile.classList.add("selected");

      const img = document.createElement("img");
      img.alt = nft.name || "NFT";
      img.loading = "lazy";
      img.src = nft.image || "";

      const check = document.createElement("span");
      check.className = "selected-check";
      check.textContent = "✓";

      tile.appendChild(img);
      tile.appendChild(check);

      tile.addEventListener("click", () => {
        toggleSelectNFT(nft);
        tile.classList.toggle("selected", !!selectedNFTs[nft.id]);
      });

      grid.appendChild(tile);
    }

    walletGrid.appendChild(header);
    walletGrid.appendChild(grid);
  }

  async function handleLoadWalletNFTs() {
    const wallet = walletInput.value.trim();

    if (!isValidEvmAddress(wallet)) {
      showAddNFTMessage("Please enter a valid 0x wallet address.");
      return;
    }

    const prevLabel = btnLoadWallet.textContent;
    try {
      btnLoadWallet.disabled = true;
      btnLoadWallet.textContent = "Loading...";
      showAddNFTMessage("");

      const nfts = await loadNFTsFromWallet(wallet);

      if (!nfts.length) {
        walletLoadedNFTs = [];
        collectionGroups = {};
        walletGrid.innerHTML = "";
        showAddNFTMessage("No NFTs found for this wallet.");
        btnLoadWallet.disabled = false;
        btnLoadWallet.textContent = prevLabel;
        return;
      }

      walletLoadedNFTs = nfts;
      collectionGroups = groupNFTsByCollection(nfts);

      renderCollectionList(collectionGroups);
      updateSelectedCount();

      for (const n of nfts.slice(0, 24)) void preloadImage(n.image);
    } catch (err) {
      console.warn("Real NFT loading failed. Falling back to mock NFTs.", err);
      showAddNFTMessage("Couldn’t load real NFTs. Showing demo NFTs for now.");

      const fallbackNFTs = makeMockWalletNFTs(wallet);
      walletLoadedNFTs = fallbackNFTs;
      collectionGroups = groupNFTsByCollection(fallbackNFTs);
      renderCollectionList(collectionGroups);
      updateSelectedCount();
      for (const n of fallbackNFTs.slice(0, 24)) void preloadImage(n.image);
    } finally {
      btnLoadWallet.disabled = false;
      btnLoadWallet.textContent = "Load NFTs";
    }
  }

  async function handleSubmitSelectedNFTs() {
    const selected = Object.values(selectedNFTs);

    if (!selected.length) {
      showAddNFTMessage("Please select at least one NFT.");
      return;
    }

    const prevSubmit = btnSubmitNFTs.textContent;
    btnSubmitNFTs.disabled = true;
    btnSubmitNFTs.textContent = "Adding...";

    try {
      const additions = selected.map((n) => ({
        id: n.id,
        image: n.image,
        collection: n.collection || "Unknown Collection",
        votesHot: Number(n.votesHot) || 0,
        votesCold: Number(n.votesCold) || 0,
        createdAt: n.createdAt || Date.now(),
      }));

      await addNFTsToDB(additions);

      selectedNFTs = {};
      updateSelectedCount();

      showAddNFTMessage("Your NFTs are live 🔥");

      await reloadFromFirestore({ resetRecent: true });
      showScreen("main");
    } catch (error) {
      console.error(error);
      showAddNFTMessage("Couldn’t add NFTs. Please try again.");
    } finally {
      btnSubmitNFTs.disabled = Object.keys(selectedNFTs).length === 0;
      btnSubmitNFTs.textContent = prevSubmit;
    }
  }

  function toast(message) {
    addSuccess.textContent = message;
    addSuccess.classList.add("is-visible");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => addSuccess.classList.remove("is-visible"), 1400);
  }

  // --- Navigation ---
  btnAdd.addEventListener("click", () => {
    selectedNFTs = {};
    walletLoadedNFTs = [];
    collectionGroups = {};
    activeCollectionName = null;
    walletGrid.innerHTML = "";
    showAddNFTMessage("");
    updateSelectedCount();
    addSuccess.textContent = "";
    showScreen("add");
    walletInput.focus();
  });

  btnBack.addEventListener("click", () => {
    showScreen("main");
  });

  btnLoadWallet.addEventListener("click", () => void handleLoadWalletNFTs());

  btnSubmitNFTs.addEventListener("click", () => void handleSubmitSelectedNFTs());

  // --- Boot ---
  wireTapScale(btnHot);
  wireTapScale(btnCold);
  wireTapScale(btnAdd);

  btnShare?.addEventListener("click", async () => {
    if (!lastResult) return;
    openShareSheet();
    const urlText = window.location.href;
    if (shareUrl) shareUrl.textContent = urlText;

    try {
      const blob = await buildShareCard(lastResult.nft, lastResult.kind, lastResult.score);
      if (shareBlobUrl) URL.revokeObjectURL(shareBlobUrl);
      shareBlobUrl = URL.createObjectURL(blob);
      if (sharePreview) sharePreview.src = shareBlobUrl;

      const file = new File([blob], "lo-hot-or-not.png", { type: "image/png" });
      btnShareNative.disabled = !navigator.share;
      btnShareNative.onclick = async () => {
        try {
          if (navigator.canShare && !navigator.canShare({ files: [file] })) throw new Error("no-canShare");
          await navigator.share({
            files: [file],
            title: "Dope or Nope",
            text: "I rated this NFT on Dope or Nope 🔥",
          });
          closeShareSheet();
        } catch {
          // stay open
        }
      };

      btnShareDownload.onclick = () => {
        const a = document.createElement("a");
        a.href = shareBlobUrl;
        a.download = "lo-hot-or-not.png";
        a.click();
      };
    } catch {
      // Canvas can be blocked by CORS; fall back to URL-only share
      if (sharePreview) sharePreview.removeAttribute("src");
      btnShareNative.disabled = !navigator.share;
      btnShareNative.onclick = async () => {
        try {
          await navigator.share({
            title: "Dope or Nope",
            text: "I rated this NFT on Dope or Nope 🔥",
            url: window.location.href,
          });
          closeShareSheet();
        } catch {
          // ignore
        }
      };
      btnShareDownload.onclick = () => closeShareSheet();
    }
  });

  btnShareClose?.addEventListener("click", closeShareSheet);
  shareSheet?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-close") === "true") closeShareSheet();
  });

  btnHot.addEventListener("click", () => void handleVote("hot"));
  btnCold.addEventListener("click", () => void handleVote("cold"));

  const FIRESTORE_BOOT_MS = 12000;

  async function boot() {
    showScreen("loading");
    try {
      await Promise.race([
        reloadFromFirestore({ resetRecent: true }),
        new Promise((_, rej) => window.setTimeout(() => rej(new Error("firestore-timeout")), FIRESTORE_BOOT_MS)),
      ]);
    } catch {
      allNFTs = seedNFTs.map((n) => ({ ...n }));
      nftMap = {};
      for (const n of allNFTs) nftMap[n.id] = n;
      updateRecentLimit();
      feedQueue = [];
      await ensureQueue(4);
      if (feedQueue[0]) await renderNFT(feedQueue[0]);
      for (const n of feedQueue.slice(1, 4)) void preloadImage(n.image);
    }
    showScreen("main");
  }

  // `type="module"` is deferred; DOMContentLoaded may have already fired before this file runs.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot());
  } else {
    void boot();
  }
