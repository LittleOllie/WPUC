import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);

const THEME_STORAGE_KEY = "lo-labs-theme";
const LAST_CODE_KEY = "ogt_vote_last_code_v1";
const VOTER_ID_KEY = "ogt_vote_voter_id_v1";

/** @type {(() => void) | null} */
let currentRoomCleanup = null;

function getVoterId() {
  try {
    const existing = localStorage.getItem(VOTER_ID_KEY);
    if (existing) return existing;
    const id = `v_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    localStorage.setItem(VOTER_ID_KEY, id);
    return id;
  } catch {
    return `v_mem_${Math.random().toString(16).slice(2)}`;
  }
}

function isTrue(v) {
  return v === true || v === "true" || v === 1;
}

/** @type {unknown} */
let dbInstance = null;

function getDb() {
  if (!isFirebaseConfigured()) return null;
  const g = globalThis;
  if (!g.firebase?.initializeApp) {
    console.error("OGTVote: load Firebase compat scripts before app.js");
    return null;
  }
  if (!g.firebase.apps?.length) {
    g.firebase.initializeApp(firebaseConfig);
  }
  if (!dbInstance) dbInstance = g.firebase.firestore();
  return dbInstance;
}

function makeCode() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `OGT-${n}`;
}

function sanitizeCode(input) {
  const s = String(input || "").trim().toUpperCase();
  if (!s) return "";
  if (s.startsWith("OGT-")) return s;
  const digits = s.replace(/[^0-9]/g, "");
  return digits.length >= 3 ? `OGT-${digits.slice(0, 4)}` : s;
}

/**
 * @param {string} url
 * @returns {string | null}
 */
function extractTweetId(url) {
  const match = String(url || "").trim().match(/status\/(\d+)/);
  return match ? match[1] : null;
}

function pointsForRank(rank) {
  if (rank === 1) return 3;
  if (rank === 2) return 2;
  if (rank === 3) return 1;
  return 0;
}

function byScoreDesc(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return (a.name || "").localeCompare(b.name || "");
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

/**
 * Resize/compress an image file so it fits Firestore doc limits.
 * @param {File} file
 * @param {{ maxDim?: number, quality?: number }} [opts]
 * @returns {Promise<string>} data URL (image/jpeg)
 */
async function imageFileToCompressedDataUrl(file, opts) {
  const maxDim = Math.max(320, Number(opts?.maxDim || 1400));
  const quality = Math.min(0.92, Math.max(0.5, Number(opts?.quality || 0.78)));

  // Decode
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Fallback for older browsers
  }

  const img = new Image();
  const src = await fileToDataUrl(file);
  if (!src) return "";
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  });

  const w0 = bitmap ? bitmap.width : img.naturalWidth || img.width;
  const h0 = bitmap ? bitmap.height : img.naturalHeight || img.height;
  if (!w0 || !h0) return "";

  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (bitmap) ctx.drawImage(bitmap, 0, 0, w, h);
  else ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return "";
  const outFile = new File([blob], "entry.jpg", { type: "image/jpeg" });
  return await fileToDataUrl(outFile);
}

/**
 * @param {ClipboardEvent} ev
 * @returns {File | null}
 */
function getImageFileFromClipboard(ev) {
  const items = ev.clipboardData?.items;
  if (!items) return null;
  for (const it of items) {
    if (it.kind === "file" && it.type && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

function setTab(root, tabName) {
  const allowed = new Set(["entries", "vote", "results"]);
  const tab = allowed.has(tabName) ? tabName : "entries";
  for (const r of root.querySelectorAll('input[name="ogtvote-room-tab"]')) {
    if (r instanceof HTMLInputElement) r.checked = r.value === tab;
  }
  const panes = Array.from(root.querySelectorAll(".tabpane"));
  for (const p of panes) {
    const active = p.dataset.pane === tab;
    p.classList.toggle("is-active", active);
  }
}

/** @param {ParentNode | null} root */
function getCurrentTabFromDom(root) {
  const r = root?.querySelector?.('input[name="ogtvote-room-tab"]:checked');
  if (r instanceof HTMLInputElement && r.value) return r.value;
  return null;
}

function copyToClipboard(text) {
  const s = String(text || "");
  if (!s) return;
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(s);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = s;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* ignore */
  }
  ta.remove();
}

function setupThemeToggle() {
  const html = document.documentElement;
  const btn = $("theme-toggle");
  function syncButton() {
    if (!btn) return;
    const t = html.getAttribute("data-theme") || "dark";
    const isLight = t === "light";
    btn.setAttribute("aria-checked", isLight ? "true" : "false");
    btn.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
  }
  function applyTheme(next) {
    if (next !== "light" && next !== "dark") next = "dark";
    html.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    syncButton();
  }
  if (btn && !btn.dataset.ogtvoteThemeBound) {
    btn.dataset.ogtvoteThemeBound = "1";
    btn.addEventListener("click", () => {
      const cur = html.getAttribute("data-theme") || "dark";
      applyTheme(cur === "dark" ? "light" : "dark");
    });
  }
  syncButton();
}

function wireLookupShell(shell) {
  if (!shell || shell.dataset.ogtvoteShellBound) return;
  shell.dataset.ogtvoteShellBound = "1";
  const toggle = shell.querySelector(".lookup-shell__toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") !== "false";
    const nextExpanded = !expanded;
    toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
    shell.classList.toggle("is-collapsed", !nextExpanded);
  });
}

/**
 * @param {unknown} ts
 * @returns {number}
 */
function tsToMs(ts) {
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts === "number") return ts;
  return 0;
}

/**
 * @param {{ collection: (path: string) => { where: Function, limit: Function } }} db
 * @returns {Promise<string>}
 */
async function allocateUniqueCode(db) {
  const col = db.collection("votes");
  for (let i = 0; i < 40; i++) {
    const code = makeCode();
    const q = await col.where("code", "==", code).limit(1).get();
    if (q.empty) return code;
  }
  throw new Error("Could not allocate a room code");
}

function showLoading(label = "Loading…") {
  const el = $("ogtvote-loading");
  const lbl = $("ogtvote-loading-label");
  if (lbl) lbl.textContent = label;
  el?.classList.add("is-active");
  el?.setAttribute("aria-hidden", "false");
}

function hideLoading() {
  const el = $("ogtvote-loading");
  el?.classList.remove("is-active");
  el?.setAttribute("aria-hidden", "true");
}

function renderFirebaseMissing(app) {
  app.innerHTML = `
    <section class="lookup-shell" aria-label="Setup required">
      <div class="lookup-shell__body">
        <section class="panel mode-panel">
          <h2 class="mode-title">Firebase not configured</h2>
          <p class="mode-desc">Edit <span class="mono">OGTVote/firebase-config.js</span> with your project keys, deploy Firestore rules, then reload.</p>
          <p class="hint">Rules: <span class="mono">OGTVote/firestore.rules</span></p>
        </section>
      </div>
    </section>
  `;
}

function goHome() {
  const next = "";
  if (window.location.hash !== next) window.location.hash = next;
  else window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function parseRoute() {
  const h = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(h);
  const code = sanitizeCode(params.get("code") || "");
  const rawTab = String(params.get("tab") || "entries");
  const allowedTabs = new Set(["entries", "vote", "results"]);
  const tab = allowedTabs.has(rawTab) ? rawTab : "entries";
  const flowRaw = String(params.get("flow") || "").toLowerCase();
  const allowedFlows = new Set(["create", "join", "history"]);
  const flow = allowedFlows.has(flowRaw) ? flowRaw : "";
  return { code, tab, flow };
}

/**
 * @param {{ code?: string; tab?: string; flow?: string }} opts
 */
function setRoute(opts) {
  const { code, tab, flow } = opts;
  const p = new URLSearchParams();
  if (code) {
    p.set("code", code);
    p.set("tab", tab && new Set(["entries", "vote", "results"]).has(tab) ? tab : "entries");
  } else if (flow && new Set(["create", "join", "history"]).has(flow)) {
    p.set("flow", flow);
  }
  const next = p.toString() ? `#${p.toString()}` : "";
  if (window.location.hash !== next) window.location.hash = next;
  else window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function renderLanding(app) {
  const tpl = $("tpl-landing");
  if (!tpl) return;
  app.replaceChildren(tpl.content.cloneNode(true));
  if (!isFirebaseConfigured() || !getDb()) {
    app.insertAdjacentHTML(
      "afterbegin",
      `<div class="lookup-shell" style="margin-bottom:1rem"><div class="lookup-shell__body"><p class="status error" style="margin:0.85rem 1rem">Connect Firebase in <span class="mono">firebase-config.js</span> to use voting.</p></div></div>`,
    );
    return;
  }
  app.querySelectorAll("[data-flow]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = String(btn.getAttribute("data-flow") || "");
      setRoute({ flow: f });
    });
  });
}

function renderFlowCreate(app) {
  const tpl = $("tpl-flow-create");
  if (!tpl) return;
  app.replaceChildren(tpl.content.cloneNode(true));
  app.querySelector(".ogtvote-flow__back")?.addEventListener("click", goHome);

  const db = getDb();
  if (!db) {
    renderFirebaseMissing(app);
    return;
  }

  const nameEl = $("flow-create-name");
  const descEl = $("flow-create-desc");
  const btn = $("flow-btn-create");
  const status = $("flow-create-status");
  const creatorId = getVoterId();

  btn?.addEventListener("click", async () => {
    const name = nameEl?.value.trim() || "";
    if (!name) {
      nameEl?.focus();
      return;
    }
    const desc = descEl?.value.trim() || "";
    const vtInput = app.querySelector('input[name="flow-voting-type"]:checked');
    const votingType = vtInput instanceof HTMLInputElement && vtInput.value === "top1" ? "top1" : "top3";
    if (status) {
      status.textContent = "";
      status.classList.remove("error");
    }
    btn.disabled = true;
    showLoading("Creating room…");
    try {
      const code = await allocateUniqueCode(db);
      const fv = globalThis.firebase.firestore.FieldValue;
      await db.collection("votes").add({
        code,
        name,
        description: desc,
        votingType,
        locked: false,
        shuffle: false,
        finished: false,
        createdBy: creatorId,
        createdAt: fv.serverTimestamp(),
      });
      try {
        localStorage.setItem(LAST_CODE_KEY, code);
      } catch {
        /* ignore */
      }
      hideLoading();
      setRoute({ code, tab: "entries" });
    } catch (e) {
      console.error(e);
      hideLoading();
      if (status) {
        status.textContent = "Could not create. Check rules and network.";
        status.classList.add("error");
      }
    } finally {
      btn.disabled = false;
    }
  });
}

function renderFlowJoin(app) {
  const tpl = $("tpl-flow-join");
  if (!tpl) return;
  app.replaceChildren(tpl.content.cloneNode(true));
  app.querySelector(".ogtvote-flow__back")?.addEventListener("click", goHome);

  const db = getDb();
  if (!db) {
    renderFirebaseMissing(app);
    return;
  }

  const input = $("flow-join-code");
  const btn = $("flow-btn-join");
  const status = $("flow-join-status");

  try {
    const last = localStorage.getItem(LAST_CODE_KEY);
    if (last && input) input.value = last;
  } catch {
    /* ignore */
  }

  btn?.addEventListener("click", async () => {
    const code = sanitizeCode(input?.value || "");
    if (!code) {
      input?.focus();
      return;
    }
    if (status) {
      status.textContent = "";
      status.classList.remove("error");
    }
    btn.disabled = true;
    showLoading("Joining…");
    try {
      const q = await db.collection("votes").where("code", "==", code).limit(1).get();
      hideLoading();
      if (q.empty) {
        if (status) {
          status.textContent = "No vote found for that code.";
          status.classList.add("error");
        }
        input?.focus();
        input?.select?.();
        return;
      }
      try {
        localStorage.setItem(LAST_CODE_KEY, code);
      } catch {
        /* ignore */
      }
      setRoute({ code, tab: "entries" });
    } catch (e) {
      console.error(e);
      hideLoading();
      if (status) {
        status.textContent = "Could not join. Check network and rules.";
        status.classList.add("error");
      }
    } finally {
      btn.disabled = false;
    }
  });
}

async function renderFlowHistory(app) {
  const tpl = $("tpl-flow-history");
  if (!tpl) return;
  app.replaceChildren(tpl.content.cloneNode(true));
  app.querySelector(".ogtvote-flow__back")?.addEventListener("click", goHome);

  const listEl = $("flow-history-list");
  const db = getDb();
  if (!db || !listEl) {
    renderFirebaseMissing(app);
    return;
  }

  listEl.innerHTML = `<p class="status loading">Loading votes…</p>`;
  showLoading("Loading votes…");
  try {
    const snap = await db.collection("votes").orderBy("createdAt", "desc").limit(40).get();
    hideLoading();
    listEl.innerHTML = "";
    if (snap.empty) {
      const p = document.createElement("p");
      p.className = "empty-hint prominent";
      p.textContent = "No previous votes yet.";
      listEl.appendChild(p);
      return;
    }
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const code = d.code || "—";
      const name = d.name || "Untitled";
      const ms = tsToMs(d.createdAt);
      const dateStr = ms ? new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ogtvote-history-card";
      btn.innerHTML = `<div class="ogtvote-history-card__name"></div><div class="ogtvote-history-card__meta"><span class="ogtvote-history-card__code"></span> · ${dateStr}</div>`;
      btn.querySelector(".ogtvote-history-card__name").textContent = `🗳️ ${name}`;
      btn.querySelector(".ogtvote-history-card__code").textContent = code;
      btn.addEventListener("click", () => setRoute({ code: String(code), tab: "entries" }));
      listEl.appendChild(btn);
    });
  } catch (e) {
    console.error(e);
    hideLoading();
    listEl.innerHTML = "";
    const err = document.createElement("p");
    err.className = "status error";
    err.textContent =
      "Could not load list. You may need a Firestore index on votes.createdAt, or check rules.";
    listEl.appendChild(err);
  }
}

/**
 * @param {Array<{ id: string, tweetUrl: string, tweetId: string, image?: string, username?: string }>} entries
 * @param {Array<{ selections?: Array<{ entryId: string, rank: number }> }>} ballots
 */
function computeLeaderboard(entries, ballots) {
  /** @type {Record<string, number>} */
  const totals = {};
  /** @type {Record<string, number>} */
  const votesByEntry = {};

  for (const v of ballots) {
    for (const sel of v.selections || []) {
      const pts = pointsForRank(sel.rank);
      totals[sel.entryId] = (totals[sel.entryId] || 0) + pts;
      votesByEntry[sel.entryId] = (votesByEntry[sel.entryId] || 0) + 1;
    }
  }

  const rows = (entries || []).map((e) => ({
    entryId: e.id,
    name: e.username || "—",
    tweetUrl: e.tweetUrl,
    image: e.image || "",
    score: totals[e.id] || 0,
    voteCount: votesByEntry[e.id] || 0,
  }));

  rows.sort(byScoreDesc);
  return rows;
}

/**
 * @param {HTMLElement} app
 * @param {string} code
 * @param {string} tabFromRoute
 * @returns {Promise<(() => void) | null>}
 */
async function mountRoom(app, code, tabFromRoute) {
  const db = getDb();
  if (!db) {
    renderFirebaseMissing(app);
    return null;
  }

  const q = await db.collection("votes").where("code", "==", code).limit(1).get();
  if (q.empty) {
    app.innerHTML = `
      <section class="lookup-shell" aria-label="Not found">
        <div class="lookup-shell__body">
          <section class="panel mode-panel">
            <h2 class="mode-title">Vote not found</h2>
            <p class="mode-desc">No room for <strong class="mono"></strong>.</p>
            <div class="input-row">
              <button type="button" class="btn-primary" id="ogtvote-back-home">🏠 Back home</button>
            </div>
          </section>
        </div>
      </section>
    `;
    const mono = app.querySelector(".mono");
    if (mono) mono.textContent = code;
    $("ogtvote-back-home")?.addEventListener("click", goHome);
    return () => {};
  }

  const voteSnap = q.docs[0];
  const voteId = voteSnap.id;
  const voteRef = db.collection("votes").doc(voteId);

  const state = {
    code,
    name: "",
    description: "",
    votingType: "top3",
    locked: false,
    shuffle: false,
    finished: false,
    createdBy: "",
    entries: /** @type {any[]} */ ([]),
    ballots: /** @type {any[]} */ ([]),
  };

  function applyVoteData(data) {
    if (!data) return;
    state.code = data.code || code;
    state.name = data.name || "";
    state.description = data.description || "";
    state.votingType = data.votingType === "top1" ? "top1" : "top3";
    state.locked = Boolean(data.locked);
    state.shuffle = Boolean(data.shuffle);
    state.finished = Boolean(data.finished);
    state.createdBy = String(data.createdBy || "");
  }

  applyVoteData(voteSnap.data());

  const tpl = $("tpl-room");
  app.replaceChildren(tpl.content.cloneNode(true));
  const root = app.querySelector(".room");
  if (!root) return null;

  const voterId = getVoterId();

  const elCode = $("room-code");
  const elCodeMeta = $("room-code-meta");
  const elTitle = $("room-title");
  const elDesc = $("room-desc");
  const btnCopy = $("btn-copy-code");
  const btnFinish = $("btn-finish");

  const entriesStatus = $("entries-status");
  const entriesCount = $("entries-count");
  const entriesGrid = $("entries-grid");
  const voteGrid = $("vote-grid");
  const voteHint = $("vote-hint");
  const rankPills = $("rank-pills");
  const btnClearVote = $("btn-clear-vote");
  const btnSubmitVote = $("btn-submit-vote");
  const votesCount = $("votes-count");
  const leaderboardEl = $("leaderboard");

  const modal = $("entry-modal");
  const btnOpenAdd = $("btn-open-add-entry");
  const mUrl = $("m-entry-url");
  const mImg = $("m-entry-image");
  const mUser = $("m-entry-user");
  const mSave = $("m-entry-save");
  const mStatus = $("m-entry-status");
  const mClose = $("entry-modal-close");
  const mBackdrop = $("entry-modal-backdrop");
  const mDrop = $("m-image-drop");
  const mPreview = $("m-image-preview");
  const mPreviewImg = $("m-image-preview-img");

  /** @type {{ dataUrl: string } | null} */
  let pastedImage = null;

  /** @type {Map<number, string>} */
  const selectionByRank = new Map();

  function maxRanks() {
    return state.votingType === "top1" ? 1 : 3;
  }

  const rankIcons = { 1: "🥇", 2: "🥈", 3: "🥉" };

  function getMyBallot() {
    return state.ballots.find((b) => b.voterId === voterId) || null;
  }

  function loadSelectionsFromMyVote() {
    selectionByRank.clear();
    const mine = getMyBallot();
    if (!mine) return;
    for (const sel of mine.selections || []) selectionByRank.set(sel.rank, sel.entryId);
  }

  function openEntryModal() {
    if (!modal) return;
    if (mStatus) mStatus.textContent = "";
    if (mUrl) mUrl.value = "";
    if (mImg) mImg.value = "";
    if (mUser) mUser.value = "";
    pastedImage = null;
    if (mPreview) mPreview.hidden = true;
    if (mPreviewImg) mPreviewImg.src = "";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("welcome-modal-active");
    mUrl?.focus();
  }

  function closeEntryModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("welcome-modal-active");
  }

  async function setModalImageFromFile(file) {
    const image = await imageFileToCompressedDataUrl(file);
    if (!image) return false;
    pastedImage = { dataUrl: image };
    if (mPreviewImg) mPreviewImg.src = image;
    if (mPreview) mPreview.hidden = false;
    if (mStatus) mStatus.textContent = "";
    return true;
  }

  async function finishVoting() {
    const ok = window.confirm("🏁 Finish voting?\n\nThis will lock entries and stop new votes.\n\nPress OK to confirm.");
    if (!ok) return;
    const fv = globalThis.firebase.firestore.FieldValue;
    try {
      await voteRef.update({
        finished: true,
        finishedAt: fv.serverTimestamp(),
        locked: true,
      });
    } catch (e) {
      console.error(e);
      window.alert("Could not finish voting.");
    }
  }

  async function saveVoteSelections() {
    const n = maxRanks();
    const selections = [];
    for (let r = 1; r <= n; r++) {
      const entryId = selectionByRank.get(r);
      if (entryId) selections.push({ entryId, rank: r });
    }
    if (selections.length !== n) return false;

    const fv = globalThis.firebase.firestore.FieldValue;
    try {
      await voteRef.collection("votes").doc(voterId).set(
        {
          voterId,
          selections,
          createdAt: fv.serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    } catch (e) {
      console.error(e);
      window.alert("Could not save vote.");
      return false;
    }
  }

  function clearSelections() {
    selectionByRank.clear();
    renderVoteUI();
  }

  function entryOrder(entries) {
    const out = [...entries];
    if (state.shuffle) {
      const seed = `${state.code}:${Math.floor(Date.now() / 86400000)}`;
      let h = 2166136261;
      for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      out.sort((a, b) => {
        const ha = (h ^ a.id.length) >>> 0;
        const hb = (h ^ b.id.length) >>> 0;
        return ha - hb;
      });
    }
    return out;
  }

  function renderEntryCard(entry, mode) {
    const card = document.createElement("div");
    card.className = "entry-card";

    const media = document.createElement("div");
    media.className = "entry-card__media";
    if (entry.image) {
      const img = document.createElement("img");
      img.src = entry.image;
      img.alt = entry.username ? `${entry.username} entry image` : "Entry image";
      media.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "entry-card__body";

    const top = document.createElement("div");
    top.className = "entry-card__top";

    const user = document.createElement("div");
    user.className = "entry-card__user";
    user.textContent = entry.username || "Unknown";

    const rank = document.createElement("div");
    rank.className = "entry-card__rank";
    rank.textContent = "—";

    top.appendChild(user);
    top.appendChild(rank);

    const meta = document.createElement("div");
    meta.className = "entry-card__meta";

    const a = document.createElement("a");
    a.className = "entry-card__link";
    a.href = entry.tweetUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "🔗 View on X";

    meta.appendChild(a);

    if (mode === "entries") {
      const del = document.createElement("button");
      del.className = "entry-card__delete";
      del.type = "button";
      del.textContent = "🗑️ Delete";
      del.disabled = state.locked;
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (state.locked) return;
        const ok = window.confirm("🗑️ Delete this entry? This cannot be undone.");
        if (!ok) return;
        try {
          await voteRef.collection("entries").doc(entry.id).delete();
        } catch (err) {
          console.error(err);
          window.alert("Could not delete entry.");
        }
      });
      meta.appendChild(del);
    }

    body.appendChild(top);
    body.appendChild(meta);

    card.appendChild(media);
    card.appendChild(body);

    const mr = maxRanks();
    if (mode === "vote") {
      card.addEventListener("click", () => {
        if (!state.entries?.length) return;

        let currentRank = null;
        for (let r = 1; r <= mr; r++) {
          if (selectionByRank.get(r) === entry.id) currentRank = r;
        }

        if (currentRank != null) {
          selectionByRank.delete(currentRank);
          renderVoteUI();
          return;
        }

        for (let r = 1; r <= mr; r++) {
          if (!selectionByRank.get(r)) {
            selectionByRank.set(r, entry.id);
            renderVoteUI();
            return;
          }
        }
      });
    }

    if (mode === "vote") {
      for (let r = 1; r <= mr; r++) {
        if (selectionByRank.get(r) === entry.id) {
          rank.textContent = `${rankIcons[r]} #${r}`;
          card.classList.add(`is-ranked-${r}`);
        }
      }
    } else {
      rank.textContent = `#${entry.tweetId || "—"}`;
    }

    return card;
  }

  function renderEntriesUI() {
    elCode.textContent = state.code;
    if (elCodeMeta) elCodeMeta.textContent = state.code;
    elTitle.textContent = state.name;
    elDesc.textContent = state.description || "";

    entriesStatus.textContent = state.finished ? "Finished" : state.locked ? "Locked" : "";
    entriesCount.textContent =
      state.entries.length === 0 ? "No entries yet." : `${state.entries.length} entr${state.entries.length === 1 ? "y" : "ies"}`;
    if (btnOpenAdd) btnOpenAdd.disabled = state.locked || state.finished;

    entriesGrid.innerHTML = "";
    const entries = entryOrder(state.entries);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-hint prominent";
      empty.textContent = "No entries yet. Tap “Add entry” to post the first one.";
      entriesGrid.appendChild(empty);
      return;
    }
    for (const e of entries) entriesGrid.appendChild(renderEntryCard(e, "entries"));
  }

  function renderVoteUI() {
    const mr = maxRanks();
    const picks = [];
    for (let r = 1; r <= mr; r++) {
      const id = selectionByRank.get(r);
      const entry = state.entries.find((x) => x.id === id);
      const label = entry ? (entry.username || "Unknown") : "—";
      const filled = Boolean(entry);
      const lab = document.createElement("label");
      lab.className = "flex-collection-pill";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "flex-collection-pill__input";
      input.disabled = true;
      input.checked = filled;
      input.setAttribute("aria-hidden", "true");
      input.tabIndex = -1;
      const span = document.createElement("span");
      span.className = "flex-collection-pill__label";
      span.textContent = `${rankIcons[r]} ${label}`;
      lab.appendChild(input);
      lab.appendChild(span);
      picks.push(lab);
    }
    rankPills.replaceChildren(...picks);

    const filled = Array.from(selectionByRank.keys()).length;
    voteHint.textContent = state.votingType === "top1" ? "Pick 1 entry." : "Pick 3 entries (3–2–1 pts).";
    btnSubmitVote.disabled = state.finished || filled !== mr;

    voteGrid.innerHTML = "";
    if (!state.entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-hint prominent";
      empty.textContent = "No entries to vote on yet.";
      voteGrid.appendChild(empty);
      return;
    }
    const entries = entryOrder(state.entries);
    for (const e of entries) voteGrid.appendChild(renderEntryCard(e, "vote"));
  }

  function renderResultsUI() {
    const rows = computeLeaderboard(state.entries, state.ballots);
    votesCount.textContent = `${state.ballots.length} vote${state.ballots.length === 1 ? "" : "s"}`;

    leaderboardEl.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "empty-hint prominent";
      empty.textContent = "No entries yet.";
      leaderboardEl.appendChild(empty);
      return;
    }

    if (state.ballots.length === 0) {
      const hint = document.createElement("p");
      hint.className = "empty-hint";
      hint.style.marginBottom = "0.75rem";
      hint.textContent = "No votes yet — rankings appear after people save.";
      leaderboardEl.appendChild(hint);
    }

    let rank = 0;
    for (const row of rows) {
      rank++;
      const wrap = document.createElement("div");
      wrap.className = "leader-row leader-row--rich";
      if (rank === 1) wrap.classList.add("leader-row--top1");
      if (rank === 2) wrap.classList.add("leader-row--top2");
      if (rank === 3) wrap.classList.add("leader-row--top3");

      const thumb = document.createElement("div");
      thumb.className = "leader-row__thumb";
      if (row.image) {
        const im = document.createElement("img");
        im.src = row.image;
        im.alt = "";
        thumb.appendChild(im);
      }

      const left = document.createElement("div");
      left.className = "leader-row__left";

      const name = document.createElement("div");
      name.className = "leader-row__name";
      name.textContent = `${rank}. ${row.name}`;

      const meta = document.createElement("div");
      meta.className = "leader-row__meta";
      meta.textContent = `${row.voteCount} pick${row.voteCount === 1 ? "" : "s"}`;

      left.appendChild(name);
      left.appendChild(meta);

      const right = document.createElement("div");
      right.className = "leader-row__score";
      right.textContent = `${row.score} pts`;

      wrap.appendChild(thumb);
      wrap.appendChild(left);
      wrap.appendChild(right);
      wrap.addEventListener("click", () => window.open(row.tweetUrl, "_blank", "noopener,noreferrer"));

      leaderboardEl.appendChild(wrap);
    }
  }

  function renderAll(tabOverride) {
    elCode.textContent = state.code;
    if (elCodeMeta) elCodeMeta.textContent = state.code;
    elTitle.textContent = state.name;
    elDesc.textContent = state.description || "";
    const tab = tabOverride ?? getCurrentTabFromDom(root) ?? tabFromRoute ?? "entries";
    setTab(root, tab);
    renderEntriesUI();
    renderVoteUI();
    renderResultsUI();

    // Admin-only finish button
    if (btnFinish) {
      const isAdmin = voterId && state.createdBy && voterId === state.createdBy;
      btnFinish.hidden = !isAdmin;
      btnFinish.disabled = state.finished;
      btnFinish.textContent = state.finished ? "🏁 Voting finished" : "🏁 Finish voting";
    }
  }

  const unsubs = [];

  unsubs.push(
    voteRef.onSnapshot((doc) => {
      applyVoteData(doc.data());
      renderAll();
    }),
  );

  unsubs.push(
    voteRef.collection("entries").onSnapshot((snap) => {
      const list = [];
      snap.forEach((d) => {
        const x = d.data() || {};
        list.push({
          id: d.id,
          tweetUrl: x.tweetUrl || "",
          tweetId: x.tweetId || "",
          image: x.image || "",
          username: x.username || "",
          createdAt: tsToMs(x.createdAt),
        });
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      state.entries = list;
      renderAll();
    }),
  );

  unsubs.push(
    voteRef.collection("votes").onSnapshot((snap) => {
      const list = [];
      snap.forEach((d) => {
        const x = d.data() || {};
        list.push({
          id: d.id,
          voterId: x.voterId || d.id,
          selections: Array.isArray(x.selections) ? x.selections : [],
          createdAt: tsToMs(x.createdAt),
        });
      });
      state.ballots = list;
      loadSelectionsFromMyVote();
      renderAll();
    }),
  );

  btnCopy.addEventListener("click", () => copyToClipboard(state.code));
  btnFinish?.addEventListener("click", () => finishVoting());

  btnOpenAdd?.addEventListener("click", () => {
    if (state.locked || state.finished) return;
    openEntryModal();
  });

  mClose?.addEventListener("click", closeEntryModal);
  mBackdrop?.addEventListener("click", closeEntryModal);
  mDrop?.addEventListener("click", () => mImg?.click());

  function onKey(ev) {
    if (ev.key === "Escape" && modal?.classList.contains("is-open")) closeEntryModal();
  }
  document.addEventListener("keydown", onKey);

  function onPaste(ev) {
    if (!modal?.classList.contains("is-open")) return;
    const file = getImageFileFromClipboard(ev);
    if (!file) return;
    ev.preventDefault();
    void setModalImageFromFile(file);
  }
  document.addEventListener("paste", onPaste);

  const dragEnterLeave = (on) => {
    if (!mDrop) return;
    mDrop.classList.toggle("is-dragover", on);
  };
  mDrop?.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragEnterLeave(true);
  });
  mDrop?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dragEnterLeave(true);
  });
  mDrop?.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragEnterLeave(false);
  });
  mDrop?.addEventListener("drop", (e) => {
    e.preventDefault();
    dragEnterLeave(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    void setModalImageFromFile(f);
  });

  mImg?.addEventListener("change", async () => {
    const f = mImg.files?.[0];
    if (!f) return;
    await setModalImageFromFile(f);
  });

  mSave?.addEventListener("click", async () => {
    if (state.locked || state.finished) return;
    const tweetUrl = mUrl?.value.trim() || "";
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetUrl || tweetId == null) {
      mUrl?.focus();
      if (mStatus) mStatus.textContent = "Enter a valid tweet URL.";
      return;
    }
    const image =
      (mImg?.files?.[0] ? await imageFileToCompressedDataUrl(mImg.files[0]) : "") || pastedImage?.dataUrl || "";
    if (!image) {
      mDrop?.focus?.();
      if (mStatus) mStatus.textContent = "Image is required. Paste, drop, or upload one.";
      return;
    }
    if (state.entries.some((e) => e.tweetId === tweetId)) {
      mUrl?.focus();
      mUrl?.select?.();
      if (mStatus) mStatus.textContent = "That tweet is already in this vote.";
      return;
    }
    const deeperDup = await voteRef.collection("entries").where("tweetId", "==", tweetId).limit(1).get();
    if (!deeperDup.empty) {
      mUrl?.focus();
      if (mStatus) mStatus.textContent = "That tweet is already in this vote.";
      return;
    }
    const username = mUser?.value.trim() || "";
    const fv = globalThis.firebase.firestore.FieldValue;
    if (mStatus) mStatus.textContent = "";
    mSave.disabled = true;
    try {
      await voteRef.collection("entries").add({
        tweetUrl,
        tweetId,
        image,
        username,
        createdAt: fv.serverTimestamp(),
      });
      closeEntryModal();
      setRoute({ code: state.code, tab: "entries" });
    } catch (e) {
      console.error(e);
      if (mStatus) {
        const msg = String(e?.message || "");
        if (/longer than/i.test(msg) || /1048/i.test(msg)) {
          mStatus.textContent = "Image too large. Try a smaller screenshot or crop it first.";
        } else {
          mStatus.textContent = "Could not save entry.";
        }
      }
    } finally {
      mSave.disabled = false;
    }
  });

  root.querySelectorAll('input[name="ogtvote-room-tab"]').forEach((r) => {
    r.addEventListener("change", () => {
      if (!(r instanceof HTMLInputElement) || !r.checked) return;
      const t = String(r.value || "entries");
      setRoute({ code: state.code, tab: t });
    });
  });

  btnClearVote.addEventListener("click", clearSelections);
  btnSubmitVote.addEventListener("click", async () => {
    const ok = window.confirm("✅ Submit this vote to the leaderboard?");
    if (!ok) return;
    const saved = await saveVoteSelections();
    if (!saved) return;
    setRoute({ code: state.code, tab: "results" });
  });

  loadSelectionsFromMyVote();
  renderAll(tabFromRoute);
  wireLookupShell($("vote-room-shell"));

  return () => {
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("paste", onPaste);
    document.body.classList.remove("welcome-modal-active");
    for (const u of unsubs) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
  };
}

function main() {
  const app = $("app");
  if (!app) return;

  setupThemeToggle();

  const render = async () => {
    if (currentRoomCleanup) {
      currentRoomCleanup();
      currentRoomCleanup = null;
    }
    const { code, tab, flow } = parseRoute();

    if (!isFirebaseConfigured() || !getDb()) {
      if (code) {
        renderFirebaseMissing(app);
        return;
      }
    }

    if (!code) {
      if (flow === "create") renderFlowCreate(app);
      else if (flow === "join") renderFlowJoin(app);
      else if (flow === "history") await renderFlowHistory(app);
      else renderLanding(app);
      return;
    }

    if (!getDb()) {
      renderFirebaseMissing(app);
      return;
    }
    currentRoomCleanup = await mountRoom(app, code, tab);
  };

  window.addEventListener("hashchange", render);
  void render();
}

main();
