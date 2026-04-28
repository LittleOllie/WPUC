import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  limit,
  orderBy,
  startAfter,
  onSnapshot,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { seedNFTs } from "./data.js";
import { loadNFTsFromWalletOnChain, groupNFTsByCollection, isValidEvmAddress } from "./nftLoader.js";

const $ = (id) => document.getElementById(id);

// Let the loading screen know the module actually started executing.
globalThis.__LO_DON_BOOTED__ = true;
try {
  globalThis.__loSetLoadingStatus?.("Loading game…");
} catch {
  /* ignore */
}

function getNumber(value) {
  return typeof value === "number" ? value : 0;
}

/** Global in-memory cache (filled from Firestore once per load). */
let allNFTs = [];
/** @type {Record<string, any>} */
let nftMap = {};

/** Shuffled once per cycle; each NFT shown once before reshuffle. */
/** @type {any[]} */
let sessionQueue = [];
const sessionSeen = new Set();
let sessionRated = 0;
let activeCollectionFilter = null;
let progressBumpT = 0;
let progressGlowT = 0;
let nftsRealtimeListenerStarted = false;

function isCollectionMode() {
  return !!activeCollectionFilter;
}

function showCollectionModeMessage() {
  const el = document.getElementById("collection-mode-banner");
  if (!el) return;
  el.classList.add("visible");
  window.setTimeout(() => el.classList.remove("visible"), 1500);
}

// -------------------------
// Pick 3 mode (separate)
// -------------------------
let pick3NFTs = [];
let nextPick3NFTs = [];
let pickStep = 0;
let pick3Timer = null;
let timeLeft = 10;
let pick3LargeIndex = 0;
let pick3Submitting = false;
let pick3SubmitInFlight = false;
/** @type {Map<string, { root: HTMLElement, stamp: HTMLElement }>} */
const pick3ElById = new Map();

const PICK_STEPS = [
  { key: "pick", label: "FLEX IT", color: "green" },
  { key: "hold", label: "HOLD IT", color: "yellow" },
  { key: "cut", label: "SEND IT", color: "red" },
];

const STAMP_LABELS = {
  pick: "FLEX IT",
  hold: "HOLD IT",
  cut: "SEND IT",
};

const PICK3_SUCCESS_MESSAGES = ["Choices locked 🔥", "Bold calls 😅", "Interesting picks 👀", "The Cut has spoken 🔥"];

function getRandomPick3Message() {
  return PICK3_SUCCESS_MESSAGES[Math.floor(Math.random() * PICK3_SUCCESS_MESSAGES.length)];
}

/** NFTs in this round: already pulled from queue + still waiting (updates live when new NFTs are added). */
function getSessionProgressDenom() {
  return sessionSeen.size + sessionQueue.length;
}

/** @param {{ glow?: boolean }} [opts] */
function updateProgressBadge(opts = {}) {
  const el = $("progress-badge");
  if (!el) return;

  const total = Math.max(0, getSessionProgressDenom());
  const rated = total ? Math.min(Math.max(0, sessionRated), total) : 0;
  el.textContent = `${rated} / ${total}`;
  el.setAttribute("aria-label", total ? `${rated} of ${total} NFTs rated this round` : "No NFTs in round");

  el.classList.remove("bump");
  el.classList.add("bump");
  window.clearTimeout(progressBumpT);
  progressBumpT = window.setTimeout(() => el.classList.remove("bump"), 150);

  if (opts.glow) {
    el.classList.remove("progress-badge--glow");
    void el.offsetWidth;
    el.classList.add("progress-badge--glow");
    window.clearTimeout(progressGlowT);
    progressGlowT = window.setTimeout(() => el.classList.remove("progress-badge--glow"), 700);
  }
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getFilteredNFTs() {
  if (!activeCollectionFilter) return allNFTs;
  return allNFTs.filter((nft) => String(nft?.collection || "").trim() === activeCollectionFilter);
}

function updatePick3Header() {
  const el = $("pick3-header");
  const timerEl = $("pick3-timer");
  if (!el) return;

  el.classList.remove("is-green", "is-yellow", "is-red", "is-done");
  if (pickStep >= 3) {
    el.textContent = "Done 👀";
    el.classList.add("is-done");
    if (timerEl) timerEl.textContent = "⏱️ —";
    return;
  }
  const step = PICK_STEPS[pickStep];
  el.textContent = `Next: ${step.label}`;
  el.classList.add(step.color === "green" ? "is-green" : step.color === "yellow" ? "is-yellow" : "is-red");
  if (timerEl) timerEl.textContent = `⏱️ ${timeLeft}`;
}

function renderPick3() {
  const container = $("pick3-grid");
  if (!container) return;

  container.innerHTML = "";
  pick3ElById.clear();

  // Always layout as: two on top, then the "large" one underneath.
  const order = [0, 1, 2].filter((i) => i !== pick3LargeIndex).concat([pick3LargeIndex]);
  order.forEach((i) => {
    const nft = pick3NFTs[i];
    if (!nft) return;
    const el = document.createElement("div");
    el.className = "pick3-item";
    if (i === pick3LargeIndex) el.classList.add("large");

    el.innerHTML = `
      <img src="${nft.image}" alt="NFT" loading="lazy" decoding="async" />
      <div class="stamp ${nft.assigned || ""}"></div>
    `;

    el.addEventListener("click", () => handlePick3Click(nft));
    const stamp = el.querySelector(".stamp");
    if (stamp && nft?.id != null) pick3ElById.set(String(nft.id), { root: el, stamp });
    container.appendChild(el);
  });

  updatePick3Header();
}

function setPick3Stamp(nft) {
  if (!nft?.id) return;
  const ref = pick3ElById.get(String(nft.id));
  if (!ref) return;
  ref.stamp.classList.remove("green", "yellow", "red");
  ref.stamp.textContent = "";
  if (nft.assigned) {
    ref.stamp.classList.add(nft.assigned);
    ref.stamp.textContent = nft.assignedLabel || "";
  }
}

function stopPick3Timer() {
  window.clearInterval(pick3Timer);
  pick3Timer = null;
}

function preloadPick3Images(nfts) {
  if (!Array.isArray(nfts)) return;
  for (const nft of nfts) {
    const url = nft?.image;
    if (!url) continue;
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
  }
}

function generatePick3Set() {
  const source = getFilteredNFTs();
  return shuffleArray(source)
    .slice(0, 3)
    .map((n) => ({
      ...n,
      assigned: null,
      assignedLabel: null,
      assignedKey: null,
    }));
}

function updateTimerUI() {
  const el = $("pick3-timer");
  if (el) el.textContent = `⏱️ ${timeLeft}`;
}

function handleTimeUp() {
  if (pick3SubmitInFlight) return;
  const remaining = pick3NFTs.filter((n) => !n.assigned);
  for (const nft of remaining) {
    const step = PICK_STEPS[pickStep];
    if (!step) break;
    nft.assigned = step.color;
    nft.assignedLabel = step.label;
    nft.assignedKey = step.key;
    pickStep++;
    setPick3Stamp(nft);
  }
  void submitPick3Round("Time’s up ⏱️");
}

function startPick3Timer() {
  stopPick3Timer();
  timeLeft = 10;
  updateTimerUI();
  pick3Timer = window.setInterval(() => {
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 0) {
      stopPick3Timer();
      handleTimeUp();
    }
  }, 1000);
}

function loadPick3NFTs({ startTimer = true } = {}) {
  // Always clear any previous round locks.
  pick3Submitting = false;
  pick3SubmitInFlight = false;

  if (nextPick3NFTs.length === 3) {
    pick3NFTs = nextPick3NFTs;
  } else {
    pick3NFTs = generatePick3Set();
  }

  // Prepare the next round immediately so round transitions feel instant.
  nextPick3NFTs = generatePick3Set();
  preloadPick3Images(nextPick3NFTs);
  preloadPick3Images(pick3NFTs);

  pickStep = 0;
  pick3LargeIndex = Math.floor(Math.random() * 3);
  renderPick3();
  if (startTimer) startPick3Timer();
}

function showPick3Results(message = null) {
  const el = $("pick3-overlay");
  if (!el) {
    // fallback to next round
    window.setTimeout(() => loadPick3NFTs(), 450);
    return;
  }

  el.innerHTML = `
    <div class="pick3-result">
      <div>${message || "Done 👀"}</div>
    </div>
  `;
  el.classList.add("visible");
  el.setAttribute("aria-hidden", "false");

  window.setTimeout(() => {
    el.classList.remove("visible");
    el.setAttribute("aria-hidden", "true");
    requestAnimationFrame(() => loadPick3NFTs());
  }, 850);
}

async function submitPick3Round(message = null) {
  if (!pick3Submitting) pick3Submitting = true;
  if (pick3SubmitInFlight) return;
  pick3SubmitInFlight = true;

  const assigned = pick3NFTs.filter((nft) => nft.assignedKey);
  if (assigned.length !== 3) {
    console.warn("Pick 3 submit skipped: not all NFTs assigned");
    pick3SubmitInFlight = false;
    pick3Submitting = false;
    return;
  }

  if (isCollectionMode()) {
    showCollectionModeMessage();
    showPick3Results("Collection mode — scores not counted 👀");
    window.setTimeout(() => {
      pick3SubmitInFlight = false;
      pick3Submitting = false;
    }, 900);
    return;
  }

  try {
    await Promise.all(assigned.map((nft) => updatePick3ResultInDB(nft, nft.assignedKey)));
    showPick3Results(message || getRandomPick3Message());
  } catch (error) {
    console.error("Failed to submit Pick 3 round:", error);
    showPick3Results("Something went wrong 😅");
  } finally {
    // Do not unlock immediately; prevents double submits during the result overlay + transition.
    window.setTimeout(() => {
      pick3SubmitInFlight = false;
      pick3Submitting = false;
    }, 1500);
  }
}

function handlePick3Click(nft) {
  if (!nft) return;
  if (pick3Submitting) return;

  if (nft.assigned) {
    nft.assigned = null;
    nft.assignedLabel = null;
    nft.assignedKey = null;
    pickStep = Math.max(0, pickStep - 1);
    setPick3Stamp(nft);
    updatePick3Header();
    return;
  }

  if (pickStep >= 3) return;

  const step = PICK_STEPS[pickStep];
  nft.assigned = step.color;
  nft.assignedLabel = STAMP_LABELS[step.key] || step.label;
  nft.assignedKey = step.key;
  pickStep++;

  setPick3Stamp(nft);
  updatePick3Header();

  if (pickStep === 3 && !pick3Submitting) {
    pick3Submitting = true;
    stopPick3Timer();
    window.setTimeout(() => {
      void submitPick3Round();
    }, 200);
  }
}

function initSessionQueue() {
  const seen = new Set();
  const unique = [];
  const source = getFilteredNFTs();
  for (const n of source) {
    if (!n?.id || seen.has(n.id)) continue;
    seen.add(n.id);
    unique.push(n);
  }
  sessionQueue = shuffleArray(unique);
  sessionSeen.clear();
  sessionRated = 0;
  updateProgressBadge();
}

function collectionKeyForFeed(nft) {
  const s = String(nft?.collection ?? "").trim();
  return s || "Unknown Collection";
}

/** Prefer an NFT whose collection differs from the last queued (reduces back-to-back same collection). */
function getNextNFT(avoidCollectionKey) {
  if (!allNFTs.length) return null;
  if (!sessionQueue.length) return null;

  const avoid = (avoidCollectionKey || "").trim() || null;
  let pickIdx = 0;
  if (avoid) {
    const idx = sessionQueue.findIndex((n) => collectionKeyForFeed(n) !== avoid);
    if (idx !== -1) pickIdx = idx;
  }

  const nft = sessionQueue.splice(pickIdx, 1)[0];
  if (nft?.id != null) sessionSeen.add(nft.id);
  return nft;
}

async function loadNFTsFromDB() {
  allNFTs = [];
  nftMap = {};

  // Load *all* NFTs in pages (no artificial 200 cap).
  // We order by document id to enable stable pagination.
  const pageSize = 500;
  let lastDoc = null;

  while (true) {
    const base = collection(db, "nfts");
    const q = lastDoc
      ? query(base, orderBy("__name__"), startAfter(lastDoc), limit(pageSize))
      : query(base, orderBy("__name__"), limit(pageSize));

    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const nft = { ...data, _docId: docSnap.id };
      allNFTs.push(nft);
      if (nft?.id != null) nftMap[nft.id] = nft;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1] || lastDoc;
    if (snapshot.size < pageSize) break;
  }
}

async function addNFTsToDB(nfts) {
  const existingIds = new Set();

  // Scan existing ids in pages so we can scale beyond 200.
  const pageSize = 500;
  let lastDoc = null;
  while (true) {
    const base = collection(db, "nfts");
    const q = lastDoc
      ? query(base, orderBy("__name__"), startAfter(lastDoc), limit(pageSize))
      : query(base, orderBy("__name__"), limit(pageSize));
    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    for (const d of snapshot.docs) {
      const id = d.data()?.id;
      if (id) existingIds.add(id);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1] || lastDoc;
    if (snapshot.size < pageSize) break;
  }

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

async function updatePick3ResultInDB(nft, choiceKey) {
  if (!nft || !nft._docId) {
    console.warn("Pick 3 result skipped: missing Firestore doc id", nft);
    return;
  }

  const ref = doc(db, "nfts", nft._docId);

  if (choiceKey === "pick") {
    await updateDoc(ref, {
      votesHot: increment(2),
      pick3PickCount: increment(1),
      pick3Rounds: increment(1),
    });

    nft.votesHot = getNumber(nft.votesHot) + 2;
    nft.pick3PickCount = getNumber(nft.pick3PickCount) + 1;
    nft.pick3Rounds = getNumber(nft.pick3Rounds) + 1;
    nftMap[nft.id] = nft;
    return;
  }

  if (choiceKey === "hold") {
    await updateDoc(ref, {
      votesHot: increment(1),
      pick3HoldCount: increment(1),
      pick3Rounds: increment(1),
    });

    nft.votesHot = getNumber(nft.votesHot) + 1;
    nft.pick3HoldCount = getNumber(nft.pick3HoldCount) + 1;
    nft.pick3Rounds = getNumber(nft.pick3Rounds) + 1;
    nftMap[nft.id] = nft;
    return;
  }

  if (choiceKey === "cut") {
    await updateDoc(ref, {
      votesCold: increment(1),
      pick3CutCount: increment(1),
      pick3Rounds: increment(1),
    });

    nft.votesCold = getNumber(nft.votesCold) + 1;
    nft.pick3CutCount = getNumber(nft.pick3CutCount) + 1;
    nft.pick3Rounds = getNumber(nft.pick3Rounds) + 1;
    nftMap[nft.id] = nft;
    return;
  }

  console.warn("Unknown Pick 3 choice:", choiceKey);
}

async function appMain() {
  const screenLoading = $("screen-loading");
  const screenMain = $("screen-main");
  const screenAdd = $("screen-add");
  const screenPick3 = $("screen-pick3");

  const nftImg = $("nft-image");
  const nftSkeleton = $("nft-image-skeleton");
  const nftCollection = $("nft-collection");
  const nftScoreBadge = $("nft-score-badge");
  const nftScoreValue = $("nft-score-value");
  const nftScoreVotes = $("nft-score-votes");

  const btnHot = $("btn-hot");
  const btnCold = $("btn-cold");
  const btnAdd = $("btn-add");
  const btnBack = $("btn-back");
  const btnPick3Back = $("btn-pick3-back");
  const btnGameMenu = $("btn-game-menu");
  const gameModal = $("game-modal");
  const btnGameDope = $("btn-game-dope");
  const btnGamePick3 = $("btn-game-pick3");
  const btnGameAdd = $("btn-game-add");
  const btnGameInfo = $("btn-game-info");
  const howModal = $("how-modal");
  const btnHowClose = $("btn-how-close");
  const btnHowGotIt = $("btn-how-gotit");
  const roundCompleteModal = $("round-complete-modal");
  const btnRoundAgain = $("btn-round-again");
  const btnRoundDone = $("btn-round-done");
  const btnRoundReplay = $("btn-round-replay");
  const roundCompleteLine = $("round-complete-line");
  const collectionsBtn = $("collections-btn");
  const collectionsModal = $("collections-modal");
  const collectionsList = $("collections-list");
  const collectionsBack = $("collections-back");
  const collectionsSearch = $("collections-search");
  const clearFilterBtn = $("clear-filter-btn");
  const clearFilterBtnPick3 = $("clear-filter-btn-pick3");

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
  const collectionSearchWrap = $("collection-search-wrap");
  const collectionSearch = $("collection-search");
  const walletLoadingEl = $("wallet-loading");
  const addNftMessage = $("add-nft-message");
  const selectedCount = $("selected-count");
  const btnSubmitNFTs = $("btn-submit-nfts");
  const addSuccess = $("add-success");
  const chainButtons = Array.from(document.querySelectorAll(".chain-btn"));
  let activeChain = "ethereum";

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
  let shareBlobUrl = "";

  function showScreen(name) {
    screenLoading.classList.toggle("screen--active", name === "loading");
    screenMain.classList.toggle("screen--active", name === "main");
    screenAdd.classList.toggle("screen--active", name === "add");
    screenPick3?.classList.toggle("screen--active", name === "pick3");
    if (name !== "pick3") stopPick3Timer();
  }

  function openGameModal() {
    if (!gameModal) return;
    gameModal.classList.add("is-open");
    gameModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeGameModal() {
    if (!gameModal) return;
    gameModal.classList.remove("is-open");
    gameModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openHowModal() {
    if (!howModal) return;
    howModal.classList.add("is-open");
    howModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => btnHowGotIt?.focus(), 50);
  }

  function closeHowModal() {
    if (!howModal) return;
    howModal.classList.remove("is-open");
    howModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => btnGameInfo?.focus(), 50);
  }

  function maybeShowGameModal() {
    // Always show on entry (per requirements).
    openGameModal();
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
    return getNumber(nft.votesHot) + getNumber(nft.votesCold);
  }

  function vibeScore(nft) {
    const hot = getNumber(nft.votesHot);
    const cold = getNumber(nft.votesCold);
    const total = hot + cold;
    return ((hot + 3) / (total + 6)) * 10;
  }

  function updateNftScoreBadge(nft) {
    if (!nftScoreValue) return;
    if (!nft) {
      nftScoreValue.textContent = "—";
      if (nftScoreVotes) nftScoreVotes.textContent = "";
      return;
    }
    const score = vibeScore(nft);
    const votes = totalVotes(nft);
    nftScoreValue.textContent = score.toFixed(1);
    if (nftScoreVotes) {
      nftScoreVotes.textContent = votes === 1 ? "1 vote" : `${votes} votes`;
    }
    if (nftScoreBadge) {
      nftScoreBadge.setAttribute(
        "aria-label",
        `Dope score ${score.toFixed(1)}, ${votes} vote${votes === 1 ? "" : "s"}`
      );
    }
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
    if (!allNFTs.length) return;
    const denom = getSessionProgressDenom();
    if (!denom) return;
    const cap = Math.min(targetLen, denom);
    let guard = 0;
    while (feedQueue.length < cap && guard++ < 100) {
      const last = feedQueue[feedQueue.length - 1];
      const avoidCollection = last ? collectionKeyForFeed(last) : null;
      const next = getNextNFT(avoidCollection);
      if (!next) break;
      if (feedQueue.some((n) => n.id === next.id)) continue;
      feedQueue.push(next);
      void preloadImage(next.image);
    }
  }

  function setButtonsEnabled(enabled) {
    btnHot.disabled = !enabled;
    btnCold.disabled = !enabled;
    if (btnAdd) btnAdd.disabled = !enabled;
  }

  async function renderNFT(nft) {
    currentNFT = nft;
    if (!nft) return;

    nftCollection.textContent = nft.collection || "—";
    updateNftScoreBadge(nft);
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

  function openRoundCompleteModal() {
    if (!roundCompleteModal) return;
    const n = sessionSeen.size;
    if (roundCompleteLine) {
      roundCompleteLine.textContent =
        n === 1
          ? "You've rated every NFT in this round (1 NFT)."
          : `You've rated every NFT in this round (${n} NFTs).`;
    }
    roundCompleteModal.classList.add("is-open");
    roundCompleteModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (btnRoundReplay) btnRoundReplay.setAttribute("hidden", "");
    window.setTimeout(() => btnRoundAgain?.focus(), 50);
  }

  function closeRoundCompleteModal(showReplayAfter) {
    if (!roundCompleteModal) return;
    roundCompleteModal.classList.remove("is-open");
    roundCompleteModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (showReplayAfter && btnRoundReplay && !sessionQueue.length && !feedQueue.length) {
      btnRoundReplay.removeAttribute("hidden");
    }
    if (sessionQueue.length && !feedQueue.length) {
      void (async () => {
        await ensureQueue(4);
        if (!feedQueue[0]) return;
        await renderNFT(feedQueue[0]);
        for (const n of feedQueue.slice(1, 4)) void preloadImage(n.image);
        btnHot.disabled = false;
        btnCold.disabled = false;
        if (btnRoundReplay) btnRoundReplay.setAttribute("hidden", "");
      })();
    }
  }

  async function startNewVotingRound() {
    closeRoundCompleteModal(false);
    if (btnRoundReplay) btnRoundReplay.setAttribute("hidden", "");
    initSessionQueue();
    feedQueue = [];
    await ensureQueue(4);
    if (feedQueue[0]) await renderNFT(feedQueue[0]);
    for (const n of feedQueue.slice(1, 4)) void preloadImage(n.image);
    updateProgressBadge();
    btnHot.disabled = false;
    btnCold.disabled = false;
    if (btnAdd) btnAdd.disabled = false;
  }

  async function advanceFeed() {
    clampRecent(currentNFT?.id);
    feedQueue.shift();
    await ensureQueue(4); // current + next 3
    const next = feedQueue[0];
    if (next) {
      await renderNFT(next);
      for (const n of feedQueue.slice(1, 4)) void preloadImage(n.image);
      if (btnRoundReplay) btnRoundReplay.setAttribute("hidden", "");
      return true;
    }

    currentNFT = null;
    nftImg.removeAttribute("src");
    nftImg.alt = "";
    nftImg.classList.remove("is-ready", "vote-hot", "vote-cold");
    nftImg.classList.add("is-reset");
    nftSkeleton.classList.add("is-hidden");
    nftCollection.textContent = allNFTs.length ? "Round complete" : "—";
    updateNftScoreBadge(null);
    if (microtext) microtext.textContent = "You're all caught up 🔥";
    updateProgressBadge();

    if (allNFTs.length && !sessionQueue.length) {
      openRoundCompleteModal();
    }

    return false;
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
    initSessionQueue();
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
    let voteSaved = false;
    try {
      if (isCollectionMode()) {
        // Local-only feedback: don't write to Firestore while filtering by collection.
        showCollectionModeMessage();
        voteSaved = true;
      } else {
        await voteNFT(currentNFT, isHot);
        voteSaved = true;
      }
    } catch {
      currentNFT.votesHot = prevHot;
      currentNFT.votesCold = prevCold;
    }

    if (voteSaved && getSessionProgressDenom() > 0) {
      sessionRated = Math.min(sessionRated + 1, getSessionProgressDenom());
      updateProgressBadge();
    }

    const score = vibeScore(currentNFT);
    const votes = totalVotes(currentNFT);
    lastResult = { nft: currentNFT, kind, score, votes };
    updateNftScoreBadge(currentNFT);

    nftImg.classList.add(kind === "hot" ? "vote-hot" : "vote-cold");
    showOverlay(kind, score, votes);

    // Intentional reward pause (fast, not laggy)
    await new Promise((r) => setTimeout(r, 800));

    hideOverlay();

    const hasNext = await advanceFeed();

    if (hasNext) {
      setButtonsEnabled(true);
    } else {
      btnHot.disabled = true;
      btnCold.disabled = true;
      if (btnAdd) btnAdd.disabled = false;
    }
    isTransitioning = false;
  }

  function wireTapScale(button) {
    if (!button) return;
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

  function isNftAlreadyInApp(nft) {
    return Boolean(nft?.id && nftMap[nft.id]);
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

  function setCollectionSearchVisible(visible) {
    if (!collectionSearchWrap) return;
    collectionSearchWrap.classList.toggle("is-hidden", !visible);
    collectionSearchWrap.setAttribute("aria-hidden", visible ? "false" : "true");
    if (!visible && collectionSearch) collectionSearch.value = "";
  }

  function setWalletLoading(visible) {
    if (!walletLoadingEl) return;
    walletLoadingEl.classList.toggle("is-hidden", !visible);
    walletLoadingEl.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) walletLoadingEl.setAttribute("aria-busy", "true");
    else walletLoadingEl.removeAttribute("aria-busy");
  }

  function getFilteredCollectionEntries(sortedEntries) {
    const q = (collectionSearch?.value || "").trim().toLowerCase();
    if (!q) return sortedEntries;
    return sortedEntries.filter(([name]) => String(name).toLowerCase().includes(q));
  }

  function renderCollectionList(groups) {
    activeCollectionName = null;
    walletGrid.innerHTML = "";

    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    const entries = getFilteredCollectionEntries(sorted);

    if (!sorted.length) {
      setCollectionSearchVisible(false);
      showAddNFTMessage("No collections found.");
      return;
    }

    if (!entries.length) {
      setCollectionSearchVisible(true);
      showAddNFTMessage("No collections match your search.");
      return;
    }

    setCollectionSearchVisible(true);
    showAddNFTMessage("");

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
    setCollectionSearchVisible(false);
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
      const wrap = document.createElement("div");
      wrap.className = "nft-select-tile-wrap";

      const tile = document.createElement("button");
      tile.className = "nft-select-tile";
      tile.type = "button";
      tile.dataset.nftId = nft.id;

      if (selectedNFTs[nft.id]) tile.classList.add("selected");

      const inApp = isNftAlreadyInApp(nft);
      if (inApp) {
        tile.classList.add("nft-select-tile--in-app");
        tile.setAttribute("aria-label", `${nft.name || "NFT"} — already in Dope or Nope`);
      }

      const img = document.createElement("img");
      img.alt = nft.name || "NFT";
      img.loading = "lazy";
      img.decoding = "async";

      const check = document.createElement("span");
      check.className = "selected-check";
      check.textContent = "✓";

      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "nft-tile-retry is-hidden";
      retryBtn.textContent = "Refresh";
      retryBtn.setAttribute("aria-label", `Retry image for ${nft.name || "NFT"}`);

      tile.appendChild(img);
      if (inApp) {
        const badge = document.createElement("span");
        badge.className = "nft-in-app-badge";
        badge.textContent = "In app";
        tile.appendChild(badge);
      }
      tile.appendChild(check);

      wrap.appendChild(tile);
      wrap.appendChild(retryBtn);

      const baseUrl = String(nft.image || "").trim();

      function finalizeImageOk() {
        tile.disabled = false;
        tile.classList.remove("nft-select-tile--image-loading", "nft-select-tile--image-failed");
        wrap.classList.remove("nft-select-tile-wrap--failed");
        retryBtn.classList.add("is-hidden");
      }

      function finalizeImageFail() {
        tile.disabled = true;
        tile.classList.remove("nft-select-tile--image-loading");
        tile.classList.add("nft-select-tile--image-failed");
        wrap.classList.add("nft-select-tile-wrap--failed");
        if (baseUrl) retryBtn.classList.remove("is-hidden");
        else retryBtn.classList.add("is-hidden");
        if (selectedNFTs[nft.id]) {
          delete selectedNFTs[nft.id];
          tile.classList.remove("selected");
          updateSelectedCount();
        }
      }

      let imageResolved = false;

      function clearImgHandlers() {
        img.onload = null;
        img.onerror = null;
      }

      function armImgHandlers() {
        imageResolved = false;
        img.onload = () => {
          if (imageResolved) return;
          imageResolved = true;
          clearImgHandlers();
          finalizeImageOk();
        };
        img.onerror = () => {
          if (imageResolved) return;
          imageResolved = true;
          clearImgHandlers();
          finalizeImageFail();
        };
      }

      function startImageLoad(url) {
        if (!url) {
          tile.classList.add("nft-select-tile--image-loading");
          tile.disabled = true;
          finalizeImageFail();
          return;
        }
        tile.disabled = true;
        tile.classList.add("nft-select-tile--image-loading");
        tile.classList.remove("nft-select-tile--image-failed");
        wrap.classList.remove("nft-select-tile-wrap--failed");
        retryBtn.classList.add("is-hidden");
        armImgHandlers();
        img.src = url;
        window.requestAnimationFrame(() => {
          if (imageResolved) return;
          if (img.complete) {
            imageResolved = true;
            clearImgHandlers();
            if (img.naturalWidth > 0) finalizeImageOk();
            else finalizeImageFail();
          }
        });
      }

      startImageLoad(baseUrl);

      retryBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const u = baseUrl;
        if (!u) {
          startImageLoad("");
          return;
        }
        const join = u.includes("?") ? "&" : "?";
        startImageLoad(`${u}${join}_retry=${Date.now()}`);
      });

      tile.addEventListener("click", () => {
        if (tile.disabled || tile.classList.contains("nft-select-tile--image-failed")) return;
        toggleSelectNFT(nft);
        tile.classList.toggle("selected", !!selectedNFTs[nft.id]);
      });

      grid.appendChild(wrap);
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

    try {
      btnLoadWallet.disabled = true;
      setWalletLoading(true);
      showAddNFTMessage("");

      const nfts = await loadNFTsFromWalletOnChain(wallet, activeChain);

      if (!nfts.length) {
        walletLoadedNFTs = [];
        collectionGroups = {};
        walletGrid.innerHTML = "";
        setCollectionSearchVisible(false);
        showAddNFTMessage("No NFTs found for this wallet.");
        return;
      }

      walletLoadedNFTs = nfts;
      collectionGroups = groupNFTsByCollection(nfts);

      renderCollectionList(collectionGroups);
      updateSelectedCount();
      showAddNFTMessage(`Loaded NFTs from ${activeChain.toUpperCase()}`);

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
      setWalletLoading(false);
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

  function getCollectionCounts() {
    /** @type {Record<string, number>} */
    const map = {};
    for (const nft of allNFTs) {
      const name = String(nft?.collection || "").trim() || "Unknown";
      map[name] = (map[name] || 0) + 1;
    }
    return map;
  }

  function showActiveCollectionBanner(name) {
    if (!clearFilterBtn) return;
    clearFilterBtn.classList.remove("hidden");
    clearFilterBtn.textContent = `✕ ${name} (scores don’t count)`;
    clearFilterBtn.classList.add("clear-filter-btn--glow");
    if (clearFilterBtnPick3) {
      clearFilterBtnPick3.classList.remove("hidden");
      clearFilterBtnPick3.textContent = `✕ ${name} (scores don’t count)`;
      clearFilterBtnPick3.classList.add("clear-filter-btn--glow");
    }
  }

  function hideActiveCollectionBanner() {
    if (!clearFilterBtn) return;
    clearFilterBtn.classList.add("hidden");
    clearFilterBtn.textContent = "✕ Clear Filter";
    clearFilterBtn.classList.remove("clear-filter-btn--glow");
    if (clearFilterBtnPick3) {
      clearFilterBtnPick3.classList.add("hidden");
      clearFilterBtnPick3.textContent = "✕ Clear Filter";
      clearFilterBtnPick3.classList.remove("clear-filter-btn--glow");
    }
  }

  async function refreshFeedForCurrentFilter() {
    feedQueue = [];
    initSessionQueue();

    await ensureQueue(4);
    if (feedQueue[0]) {
      await renderNFT(feedQueue[0]);
      for (const n of feedQueue.slice(1, 4)) void preloadImage(n.image);
      setButtonsEnabled(true);
      if (btnRoundReplay) btnRoundReplay.setAttribute("hidden", "");
      return true;
    }

    // Empty state for this mode
    currentNFT = null;
    nftImg.removeAttribute("src");
    nftImg.alt = "";
    nftImg.classList.remove("is-ready", "vote-hot", "vote-cold");
    nftImg.classList.add("is-reset");
    nftSkeleton.classList.add("is-hidden");
    nftCollection.textContent = activeCollectionFilter ? activeCollectionFilter : "—";
    updateNftScoreBadge(null);
    if (microtext) microtext.textContent = "No NFTs in this collection yet.";
    updateProgressBadge();
    btnHot.disabled = true;
    btnCold.disabled = true;
    if (btnAdd) btnAdd.disabled = false;
    return false;
  }

  async function applyCollectionFilter(collectionName) {
    activeCollectionFilter = collectionName || null;
    if (activeCollectionFilter) showActiveCollectionBanner(activeCollectionFilter);
    else hideActiveCollectionBanner();

    closeCollectionsModal();
    if (collectionsSearch) collectionsSearch.value = "";
    await refreshFeedForCurrentFilter();
  }

  function renderCollections() {
    if (!collectionsList) return;
    const data = getCollectionCounts();
    const q = (collectionsSearch?.value || "").trim().toLowerCase();
    const entries = Object.entries(data)
      .filter(([name]) => (q ? String(name).toLowerCase().includes(q) : true))
      .sort((a, b) => b[1] - a[1]);

    collectionsList.innerHTML = "";

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "collection-item";
      empty.innerHTML = q
        ? `<span>No matches</span><span class="collection-item__count">0</span>`
        : `<span>No collections yet</span><span class="collection-item__count">0</span>`;
      collectionsList.appendChild(empty);
      return;
    }

    for (const [name, count] of entries) {
      const item = document.createElement("div");
      item.className = "collection-item";
      if (activeCollectionFilter && name === activeCollectionFilter) item.classList.add("is-active");

      const left = document.createElement("span");
      left.textContent = name;

      const right = document.createElement("span");
      right.className = "collection-item__count";
      right.textContent = String(count);

      item.appendChild(left);
      item.appendChild(right);
      item.addEventListener("click", () => void applyCollectionFilter(name));
      collectionsList.appendChild(item);
    }
  }

  function openCollectionsModal() {
    if (!collectionsModal) return;
    renderCollections();
    collectionsModal.classList.remove("hidden");
    collectionsModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => collectionsSearch?.focus(), 50);
  }

  function closeCollectionsModal() {
    if (!collectionsModal) return;
    collectionsModal.classList.add("hidden");
    collectionsModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // --- Navigation ---
  btnAdd?.addEventListener("click", () => {
    selectedNFTs = {};
    walletLoadedNFTs = [];
    collectionGroups = {};
    activeCollectionName = null;
    walletGrid.innerHTML = "";
    setCollectionSearchVisible(false);
    showAddNFTMessage("");
    updateSelectedCount();
    addSuccess.textContent = "";
    showScreen("add");
    walletInput.focus();
  });

  btnBack.addEventListener("click", () => {
    showScreen("main");
    openGameModal();
  });

  btnPick3Back?.addEventListener("click", () => {
    showScreen("main");
    openGameModal();
  });

  btnGameMenu?.addEventListener("click", () => {
    openGameModal();
  });

  btnGameDope?.addEventListener("click", () => {
    closeGameModal();
    showScreen("main");
  });

  btnGamePick3?.addEventListener("click", () => {
    closeGameModal();
    loadPick3NFTs();
    showScreen("pick3");
  });

  btnGameAdd?.addEventListener("click", () => {
    closeGameModal();
    selectedNFTs = {};
    walletLoadedNFTs = [];
    collectionGroups = {};
    activeCollectionName = null;
    walletGrid.innerHTML = "";
    setCollectionSearchVisible(false);
    showAddNFTMessage("");
    updateSelectedCount();
    addSuccess.textContent = "";
    showScreen("add");
    walletInput.focus();
  });

  btnGameInfo?.addEventListener("click", () => openHowModal());
  btnHowClose?.addEventListener("click", () => closeHowModal());
  btnHowGotIt?.addEventListener("click", () => closeHowModal());

  howModal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-how-close") === "backdrop") {
      closeHowModal();
    }
  });

  gameModal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-game-close") === "backdrop") {
      closeGameModal();
    }
  });

  btnLoadWallet.addEventListener("click", () => void handleLoadWalletNFTs());

  for (const btn of chainButtons) {
    btn.addEventListener("click", () => {
      for (const b of chainButtons) b.classList.remove("active");
      btn.classList.add("active");
      activeChain = String(btn.dataset.chain || "ethereum");
    });
  }

  btnSubmitNFTs.addEventListener("click", () => void handleSubmitSelectedNFTs());

  collectionSearch?.addEventListener("input", () => {
    if (!collectionSearchWrap || collectionSearchWrap.classList.contains("is-hidden")) return;
    if (!Object.keys(collectionGroups).length) return;
    renderCollectionList(collectionGroups);
  });

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

  btnRoundAgain?.addEventListener("click", () => void startNewVotingRound());
  btnRoundReplay?.addEventListener("click", () => void startNewVotingRound());
  btnRoundDone?.addEventListener("click", () => closeRoundCompleteModal(true));

  collectionsBtn?.addEventListener("click", openCollectionsModal);
  collectionsBack?.addEventListener("click", closeCollectionsModal);
  collectionsSearch?.addEventListener("input", renderCollections);
  clearFilterBtn?.addEventListener("click", () => void applyCollectionFilter(null));
  clearFilterBtnPick3?.addEventListener("click", () => void applyCollectionFilter(null));
  collectionsModal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-collections-close") === "overlay") closeCollectionsModal();
  });

  roundCompleteModal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-round-complete-close") === "backdrop") {
      closeRoundCompleteModal(true);
    }
  });

  const FIRESTORE_BOOT_MS = 12000;

  function startNftsRealtimeSync() {
    if (nftsRealtimeListenerStarted) return;
    nftsRealtimeListenerStarted = true;

    const q = query(collection(db, "nfts"), limit(200));
    let firstSnapshot = true;

    onSnapshot(
      q,
      (snap) => {
        if (firstSnapshot) {
          firstSnapshot = false;
          return;
        }

        const prevDenom = getSessionProgressDenom();
        let addedForPrefetch = false;
        let refreshScore = false;

        for (const change of snap.docChanges()) {
          const data = change.doc.data();
          if (!data) continue;
          const id = data.id;
          if (!id) continue;

          if (change.type === "modified") {
            const ex = nftMap[id];
            if (ex) {
              ex.votesHot = Number(data.votesHot) || 0;
              ex.votesCold = Number(data.votesCold) || 0;
              if (currentNFT?.id === id) refreshScore = true;
            } else {
              const nft = { ...data, _docId: change.doc.id };
              allNFTs.push(nft);
              nftMap[id] = nft;
              if (
                !sessionSeen.has(id) &&
                (!activeCollectionFilter || String(nft?.collection || "").trim() === activeCollectionFilter)
              ) {
                sessionQueue.push(nft);
                addedForPrefetch = true;
              }
            }
          } else if (change.type === "added") {
            if (nftMap[id]) continue;
            const nft = { ...data, _docId: change.doc.id };
            allNFTs.push(nft);
            nftMap[id] = nft;
            if (
              !sessionSeen.has(id) &&
              (!activeCollectionFilter || String(nft?.collection || "").trim() === activeCollectionFilter)
            ) {
              sessionQueue.push(nft);
              addedForPrefetch = true;
            }
          }
        }

        const newDenom = getSessionProgressDenom();
        const poolGrew = newDenom > prevDenom;
        updateProgressBadge({ glow: poolGrew });
        if (refreshScore && currentNFT) updateNftScoreBadge(currentNFT);
        if (addedForPrefetch && !roundCompleteModal?.classList.contains("is-open")) void ensureQueue(4);
      },
      (err) => console.warn("NFTs realtime listener:", err)
    );
  }

  const INTRO_MODAL_KEY = "dopeornope_intro_v2";
  const introModal = $("intro-modal");
  const btnIntroContinue = $("btn-intro-continue");

  function openIntroModal() {
    if (!introModal) return;
    introModal.classList.add("is-open");
    introModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => btnIntroContinue?.focus(), 50);
  }

  function closeIntroModal() {
    if (!introModal) return;
    introModal.classList.remove("is-open");
    introModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function maybeShowIntroModal() {
    if (!introModal) return;
    try {
      if (sessionStorage.getItem(INTRO_MODAL_KEY)) return;
    } catch {
      /* private mode */
    }
    openIntroModal();
  }

  btnIntroContinue?.addEventListener("click", () => {
    try {
      sessionStorage.setItem(INTRO_MODAL_KEY, "1");
    } catch {
      /* ignore */
    }
    closeIntroModal();
  });

  introModal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-intro-close") === "backdrop") {
      try {
        sessionStorage.setItem(INTRO_MODAL_KEY, "1");
      } catch {
        /* ignore */
      }
      closeIntroModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!collectionsModal?.classList.contains("hidden")) {
      closeCollectionsModal();
      return;
    }
    if (roundCompleteModal?.classList.contains("is-open")) {
      closeRoundCompleteModal(true);
      return;
    }
    if (!introModal?.classList.contains("is-open")) return;
    try {
      sessionStorage.setItem(INTRO_MODAL_KEY, "1");
    } catch {
      /* ignore */
    }
    closeIntroModal();
  });

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
      initSessionQueue();
      await ensureQueue(4);
      if (feedQueue[0]) await renderNFT(feedQueue[0]);
      for (const n of feedQueue.slice(1, 4)) void preloadImage(n.image);
    }
    showScreen("main");
    maybeShowGameModal();
    startNftsRealtimeSync();
  }

  // `type="module"` is deferred; DOMContentLoaded may have already fired before this file runs.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot());
  } else {
    void boot();
  }
}

void appMain();
