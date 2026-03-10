/**
 * Challenges page: Active, Completed, Challenge Library.
 * Starts challenges, adds associated habit to habits list, tracks progress.
 * Flow: 1) Create habit if needed, 2) Create active challenge record, 3) Refresh UI.
 */
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { escapeHtml, escapeAttr, showToast } from "./utils.js";
import { CHALLENGE_DEFINITIONS } from "./challenge-definitions.js";
import { getAuthState } from "./auth-state.js";
import { openChallengeShareModal } from "./challenge-share.js";

const HABITS_CHANNEL = "mim-habits-changed";

let currentUser = null;
let lastChallenges = [];
let lastChallengeMap = new Map();
let lastActive = [];
let lastCompleted = [];
let activeChallengesUnsubscribe = null;

function getChallengesRef() {
  return collection(db, "challenges");
}

function getActiveChallengesRef() {
  if (!currentUser) return null;
  return collection(db, "users", currentUser.uid, "activeChallenges");
}

function getCompletedChallengesRef() {
  if (!currentUser) return null;
  return collection(db, "users", currentUser.uid, "completedChallenges");
}

function getHabitsRef() {
  if (!currentUser) return null;
  return collection(db, "users", currentUser.uid, "habits");
}

/** Notify other tabs/pages that habits have changed (for refresh). */
function broadcastHabitsChanged() {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      new BroadcastChannel(HABITS_CHANNEL).postMessage("changed");
    }
  } catch (e) {
    console.warn("[Challenges] BroadcastChannel not supported:", e);
  }
}

async function loadChallengesFromFirestore() {
  try {
    const snapshot = await getDocs(getChallengesRef());
    if (snapshot.empty) return null;
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[Challenges] Firestore challenges read error:", err);
    return null;
  }
}

async function getChallenges() {
  const fromFirestore = await loadChallengesFromFirestore();
  if (fromFirestore && fromFirestore.length > 0) return fromFirestore;
  return CHALLENGE_DEFINITIONS;
}

/**
 * Ensure the challenge habit exists. If not, create it with isShared and sharedWithGroups.
 * Query: users/{uid}/habits where name == challenge.habitName (case-insensitive).
 */
async function ensureChallengeHabitExists(challenge) {
  const habitsRef = getHabitsRef();
  if (!habitsRef) {
    console.warn("[Challenges] ensureChallengeHabitExists: no habitsRef");
    return false;
  }

  const habitName = String(challenge.habitName || "").trim();
  if (!habitName) {
    console.warn("[Challenges] ensureChallengeHabitExists: empty habitName");
    return false;
  }

  const snapshot = await getDocs(habitsRef);
  const existing = snapshot.docs.find(
    (d) => (d.data().name || "").trim().toLowerCase() === habitName.toLowerCase()
  );
  if (existing) {
    const data = existing.data();
    const hasChallengeId = data.challengeId === challenge.id;
    if (!hasChallengeId) {
      await updateDoc(doc(db, "users", currentUser.uid, "habits", existing.id), {
        source: "challenge",
        challengeId: challenge.id,
      });
    }
    console.log("[Challenges] Habit already exists:", habitName);
    return { habitId: existing.id };
  }

  const createdDate = new Date().toISOString().split("T")[0];
  const habitData = {
    name: habitName,
    createdAt: serverTimestamp(),
    createdDate,
    completedDates: [],
    isShared: true,
    source: "challenge",
    challengeId: challenge.id,
  };

  const ref = await addDoc(habitsRef, habitData);
  console.log("[Challenges] Habit created:", habitName, "id:", ref.id);
  return { habitId: ref.id };
}

async function startChallenge(challenge) {
  const challengeId = challenge?.id;
  console.log("[Challenges] Starting challenge:", challengeId);

  if (!currentUser) {
    console.error("[Challenges] No current user");
    return;
  }

  const activeRef = getActiveChallengesRef();
  if (!activeRef) {
    console.error("[Challenges] No activeChallenges ref");
    return;
  }

  const docRef = doc(db, "users", currentUser.uid, "activeChallenges", challengeId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log("[Challenges] Challenge already active:", challengeId);
    showToast("You already have this challenge active.");
    return;
  }

  let habitId = null;
  try {
    const result = await ensureChallengeHabitExists(challenge);
    habitId = result?.habitId ?? null;
  } catch (err) {
    console.error("[Challenges] Challenge start failed (habit):", err);
    showToast("Could not add habit. Please try again.");
    return;
  }

  const challengeData = {
    challengeId,
    habitName: challenge.habitName,
    habitId: habitId || null,
    startDate: serverTimestamp(),
    progress: 0,
    durationDays: challenge.durationDays,
    completed: false,
  };

  try {
    await setDoc(docRef, challengeData);
    console.log("[Challenges] Active challenge created:", challengeId);
  } catch (err) {
    console.error("[Challenges] Challenge start failed (activeChallenge):", err);
    showToast("Could not start challenge. Check console and Firestore rules.");
    return;
  }

  showToast(`Challenge started: ${challenge.name}`);
  broadcastHabitsChanged();
  await loadAll();
}

function renderActiveChallenge(active, challengeDef) {
  const def = challengeDef || { name: active.challengeId, icon: "🎯", durationDays: active.durationDays };
  const progress = Number(active.progress) || 0;
  const total = Number(active.durationDays) || 7;
  const pct = total ? Math.min(100, (progress / total) * 100) : 0;

  const card = document.createElement("div");
  card.className = "challenge-card challenge-card--active";
  card.dataset.challengeId = active.challengeId;
  card.innerHTML =
    `<div class="challenge-card-header">` +
    `<span class="challenge-card-icon">${escapeHtml(def.icon || "🎯")}</span>` +
    `<span class="challenge-card-name">${escapeHtml(def.name || active.challengeId)}</span>` +
    `</div>` +
    `<div class="challenge-card-progress">` +
    `<div class="progress-bar challenge-progress-bar">` +
    `<div class="progress-fill" style="width: ${pct}%;"></div>` +
    `</div>` +
    `<p class="challenge-progress-text">${progress} / ${total} days</p>` +
    `</div>`;
  return card;
}

function renderCompletedChallenge(completed, challengeDef) {
  const def = challengeDef || { name: completed.challengeId, icon: "🎯", durationDays: completed.durationDays };
  const card = document.createElement("div");
  card.className = "challenge-card challenge-card--completed";
  card.dataset.challengeId = completed.challengeId;
  card.innerHTML =
    `<div class="challenge-card-header">` +
    `<span class="challenge-card-icon">${escapeHtml(def.icon || "🎯")}</span>` +
    `<span class="challenge-card-name">${escapeHtml(def.name || completed.challengeId)}</span>` +
    `<span class="challenge-completed-badge">✓</span>` +
    `</div>` +
    `<p class="challenge-completed-subtitle">${Number(completed.durationDays) || 0} days completed</p>` +
    `<div class="challenge-card-actions">` +
    `<button type="button" class="challenge-share-btn button-primary button-small" data-challenge-id="${escapeAttr(completed.challengeId)}">Share</button>` +
    `</div>`;
  return card;
}

function renderLibraryChallenge(challenge, activeIds, completedIds) {
  const isActive = activeIds.includes(challenge.id);
  const isCompleted = completedIds.includes(challenge.id);
  let btnLabel = "Start Challenge";
  let disabled = false;
  if (isCompleted) {
    btnLabel = "Completed ✓";
    disabled = true;
  } else if (isActive) {
    btnLabel = "Challenge Active";
    disabled = true;
  }

  const card = document.createElement("div");
  card.className = "challenge-library-card";
  card.innerHTML =
    `<div class="challenge-library-card-header">` +
    `<span class="challenge-library-icon">${escapeHtml(challenge.icon || "🎯")}</span>` +
    `<div class="challenge-library-info">` +
    `<h3 class="challenge-library-name">${escapeHtml(challenge.name || "Challenge")}</h3>` +
    `<p class="challenge-library-desc">${escapeHtml(challenge.description || "")}</p>` +
    `<p class="challenge-library-habit">Habit: ${escapeHtml(challenge.habitName || "")} · ${challenge.durationDays || 7} days</p>` +
    `</div>` +
    `</div>` +
    `<button type="button" class="challenge-start-btn button-primary full-width" data-challenge-id="${escapeAttr(challenge.id)}" ${disabled ? "disabled" : ""}>` +
    escapeHtml(btnLabel) +
    `</button>`;
  return card;
}

async function loadAll(activeSnapshot = null) {
  const activeRef = getActiveChallengesRef();
  const [challenges, completedSnap, activeSnap] = await Promise.all([
    getChallenges(),
    getDocs(getCompletedChallengesRef()),
    activeSnapshot ? Promise.resolve(null) : (activeRef ? getDocs(activeRef) : Promise.resolve(null)),
  ]);

  const challengeMap = new Map(challenges.map((c) => [c.id, c]));
  const active = [];
  const completed = [];
  const snapToUse = activeSnapshot || activeSnap;
  if (snapToUse) {
    snapToUse.forEach((d) => active.push({ id: d.id, ...d.data() }));
  }
  completedSnap?.forEach((d) => completed.push({ id: d.id, ...d.data() }));
  const activeIds = active.map((a) => a.challengeId || a.id);
  const completedIds = completed.map((c) => c.challengeId || c.id);

  lastChallenges = challenges;
  lastChallengeMap = challengeMap;
  lastActive = active;
  lastCompleted = completed;

  console.log("[Challenges] loadAll - active:", active.length, "completed:", completed.length);

  const activeList = document.getElementById("activeChallengesList");
  const completedList = document.getElementById("completedChallengesList");
  const libraryList = document.getElementById("challengeLibraryList");

  if (activeList) {
    activeList.innerHTML = "";
    if (active.length === 0) {
      activeList.innerHTML = '<p class="challenges-empty">No active challenges. Start one from the library below.</p>';
    } else {
      active.forEach((a) => {
        activeList.appendChild(renderActiveChallenge(a, challengeMap.get(a.challengeId)));
      });
    }
  }

  if (completedList) {
    completedList.innerHTML = "";
    if (completed.length === 0) {
      completedList.innerHTML = '<p class="challenges-empty">None yet.</p>';
    } else {
      completed.forEach((c) => {
        completedList.appendChild(renderCompletedChallenge(c, challengeMap.get(c.challengeId)));
      });
    }
  }

  if (libraryList) {
    libraryList.innerHTML = "";
    challenges.forEach((c) => {
      libraryList.appendChild(renderLibraryChallenge(c, activeIds, completedIds));
    });
  }
}


function init() {
  document.getElementById("challengeLibraryList")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".challenge-start-btn");
    if (!btn || btn.disabled) return;
    const id = btn.dataset.challengeId;
    const challenge = lastChallengeMap.get(id) || lastChallenges.find((c) => c.id === id);
    if (challenge) {
      btn.disabled = true;
      btn.textContent = "Starting...";
      try {
        await startChallenge(challenge);
      } catch (err) {
        console.error("[Challenges] Start challenge error:", err);
        btn.disabled = false;
        btn.textContent = "Start Challenge";
      }
    }
  });

  document.getElementById("completedChallengesList")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".challenge-share-btn");
    if (!btn) return;
    const id = btn.dataset.challengeId;
    const completedEntry = lastCompleted.find((c) => (c.challengeId || c.id) === id);
    const def = lastChallengeMap.get(id);
    if (completedEntry && def) {
      getAuthState().getUserProfile().then((profile) => {
        openChallengeShareModal(profile || {}, {
          ...def,
          durationDays: completedEntry.durationDays,
        });
      });
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user;

    if (activeChallengesUnsubscribe) {
      activeChallengesUnsubscribe();
      activeChallengesUnsubscribe = null;
    }

    const activeRef = getActiveChallengesRef();
    if (activeRef) {
      activeChallengesUnsubscribe = onSnapshot(activeRef, (snapshot) => {
        console.log("[Challenges] onSnapshot activeChallenges:", snapshot.size);
        loadAll(snapshot);
      }, (err) => {
        console.error("[Challenges] onSnapshot error:", err);
        loadAll();
      });
    } else {
      loadAll();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
