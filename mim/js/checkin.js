/**
 * Dashboard today's habits: load habits, show checkboxes, track completion in
 * users/{uid}/checkins/{date} with habitsCompleted array.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, escapeAttr, getWeekStart } from "./utils.js";
import { subscribeAuth, getAuthState } from "./auth-state.js";
import { shareAchievement } from "./share-achievement.js";
import { updateBadgeProgress } from "./badge-progress.js";
import { showBadgeUnlockPopup } from "./badge-unlock.js";
import { updateChallengeProgress } from "./challenge-progress.js";

let currentUser = null;
let habits = [];
let completedIds = [];
let habitsUnsubscribe = null;
/** Whether we have already shown confetti for today (from checkin doc). */
let celebrationShownToday = false;

function getTodayId() {
  return new Date().toISOString().split("T")[0];
}

function getYesterdayId() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

/** Date string YYYY-MM-DD for N days ago (0 = today). */
function getDateId(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function getDayName(dateId) {
  const d = new Date(dateId + "T12:00:00Z");
  return DAY_NAMES[d.getUTCDay()];
}

function getUserRef() {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid);
}

/** Update streak and shield display (live when first habit checked). */
function updateStreakUI(count) {
  const el = document.getElementById("streakCount");
  if (el) el.textContent = String(count);
}

function updateShieldsUI(count) {
  const el = document.getElementById("shieldCount");
  if (el) el.textContent = String(count);
}

/** Show identity reinforcement popup when a habit is checked. Disappears after 3s. */
function showIdentityReinforcement(identity) {
  const message = identity && identity.trim()
    ? `✔ You reinforced "${String(identity).trim()}"`
    : "✔ You reinforced a positive habit";
  const popup = document.createElement("div");
  popup.className = "identity-popup";
  popup.setAttribute("role", "status");
  popup.textContent = message;
  document.body.appendChild(popup);
  setTimeout(() => {
    popup.classList.add("identity-popup--out");
    setTimeout(() => popup.remove(), 400);
  }, 2600);
}

function getHabitsRef() {
  if (!currentUser) return null;
  return collection(db, "users", currentUser.uid, "habits");
}

function getCheckinRef() {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid, "checkins", getTodayId());
}

/** Trigger confetti when all habits completed (once per day). */
function triggerConfetti() {
  if (typeof globalThis.confetti === "function") {
    globalThis.confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });
  }
}

function updateProgressText() {
  const progressTextEl = document.getElementById("progressText");
  const progressFillEl = document.getElementById("progressFill");
  const completeMsgEl = document.getElementById("todayCompleteMessage");
  const total = habits.length;
  const completedHabitsToday = habits.filter((h) => completedIds.includes(h.id)).length;
  const percent = total ? Math.round((completedHabitsToday / total) * 100) : 0;

  console.log("[Checkin] Total habits:", total, "Completed habits today:", completedHabitsToday);

  if (progressTextEl) {
    progressTextEl.textContent = total
      ? `${completedHabitsToday} / ${total} habits completed`
      : "Add habits to track your progress.";
  }
  if (progressFillEl) {
    progressFillEl.style.width = percent + "%";
  }
  if (completeMsgEl) {
    const allDone = total > 0 && completedHabitsToday === total;
    completeMsgEl.textContent = "All habits completed today 🎉";
    completeMsgEl.hidden = !allDone;
  }
  const shareBtn = document.getElementById("shareAchievementBtn");
  if (shareBtn) shareBtn.hidden = !(total > 0 && completedHabitsToday === total);
}

/** Load last 7 days and render weekly chain. Filled if checkin exists and habitsCompleted.length > 0. */
async function loadAndRenderWeeklyChain() {
  const container = document.getElementById("weeklyChain");
  if (!container || !currentUser) return;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dateId = getDateId(i);
    days.push({ dateId, dayName: getDayName(dateId), filled: false });
  }
  const checkinRefs = days.map((d) => doc(db, "users", currentUser.uid, "checkins", d.dateId));
  const snaps = await Promise.all(checkinRefs.map((ref) => getDoc(ref)));
  snaps.forEach((snap, idx) => {
    const data = snap.exists() ? snap.data() : {};
    const completed = Array.isArray(data.habitsCompleted) ? data.habitsCompleted : [];
    days[idx].filled = completed.length > 0;
  });
  container.innerHTML = "";
  const dayRow = document.createElement("div");
  dayRow.className = "weekly-chain-row weekly-chain-days";
  const squareRow = document.createElement("div");
  squareRow.className = "weekly-chain-row weekly-chain-squares";
  days.forEach((d) => {
    const dayCell = document.createElement("span");
    dayCell.className = "weekly-chain-cell weekly-chain-day";
    dayCell.textContent = d.dayName;
    dayRow.appendChild(dayCell);
    const squareCell = document.createElement("span");
    squareCell.className = "weekly-chain-cell weekly-chain-square" + (d.filled ? " weekly-chain-square--filled" : "");
    squareCell.setAttribute("aria-label", d.filled ? `${d.dayName}: completed` : `${d.dayName}: not completed`);
    squareCell.textContent = d.filled ? "■" : "□";
    squareRow.appendChild(squareCell);
  });
  container.appendChild(dayRow);
  container.appendChild(squareRow);
}

function render() {
  const container = document.getElementById("todayHabits");
  if (!container) return;
  container.innerHTML = "";
  if (!habits.length) {
    container.innerHTML =
      '<p class="today-habits-empty">No habits yet. <a href="habits.html">Add habits</a> to get started.</p>';
    updateProgressText();
    return;
  }
  habits.forEach((habit) => {
    const checked = completedIds.includes(habit.id);
    const row = document.createElement("div");
    row.className = "habit-check";
    row.innerHTML =
      `<label class="habit-check-label">` +
      `<input type="checkbox" ${checked ? "checked" : ""} data-habit-id="${escapeAttr(habit.id)}" />` +
      `<span class="habit-check-name">${escapeHtml(habit.name || "Unnamed")}</span>` +
      `</label>`;
    container.appendChild(row);
  });
  updateProgressText();
}

function init() {
  console.log("[Checkin] DOM ready, waiting for auth");

  const todayHabitsEl = document.getElementById("todayHabits");
  const progressTextEl = document.getElementById("progressText");
  if (!todayHabitsEl) {
    console.warn("[Checkin] #todayHabits not found");
    return;
  }

  async function loadHabits() {
    const ref = getHabitsRef();
    if (!ref) return;
    console.log("[Checkin] Loading habits for user", currentUser.uid);
    try {
      const snapshot = await getDocs(ref);
      habits = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const shareWithGroups = data.shareWithGroups === true || data.isShared === true;
        habits.push({ id: d.id, ...data, shareWithGroups });
      });
      habits.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return ta - tb;
      });
      console.log("[Checkin] Habits loaded:", habits.length);
    } catch (err) {
      console.error("[Checkin] loadHabits error", err);
      habits = [];
    }
  }

  async function loadCheckin() {
    const ref = getCheckinRef();
    if (!ref) return;
    console.log("[Checkin] Loading checkin for", getTodayId());
    try {
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      const rawCompleted = Array.isArray(data.habitsCompleted) ? data.habitsCompleted : [];
      completedIds = rawCompleted.filter((id) => habits.some((h) => h.id === id));
      celebrationShownToday = data.celebrationShown === true;
      if (rawCompleted.length !== completedIds.length) {
        console.log("[Checkin] Sanitized completedIds: removed", rawCompleted.length - completedIds.length, "stale entries");
      }
      console.log("[Checkin] Checkins loaded:", completedIds.length, "completed", "celebrationShown:", celebrationShownToday);
    } catch (err) {
      console.error("[Checkin] loadCheckin error", err);
      completedIds = [];
      celebrationShownToday = false;
    }
  }

  /** Streak + shields: day counts if habitsCompleted.length > 0. One shield per 7 days. Missed day: use shield or reset. */
  async function updateStreakIfNeeded() {
    if (completedIds.length === 0) return;
    const userRef = getUserRef();
    if (!userRef) return;
    const today = getTodayId();
    try {
      const userSnap = await getDoc(userRef);
      const data = userSnap.exists() ? userSnap.data() : {};
      let lastCheckinDate = data.lastCheckinDate ?? null;
      if (lastCheckinDate && typeof lastCheckinDate.toDate === "function")
        lastCheckinDate = lastCheckinDate.toDate().toISOString().split("T")[0];
      if (lastCheckinDate === today) {
        console.log("[Streak] Today already counted, skip");
        return;
      }
      const currentStreak = Number(data.currentStreak) || 0;
      const longestStreak = Number(data.longestStreak) || 0;
      let streakShields = Number(data.streakShields) || 0;
      const yesterday = getYesterdayId();
      const yesterdayRef = doc(db, "users", currentUser.uid, "checkins", yesterday);
      const yesterdaySnap = await getDoc(yesterdayRef);
      const yesterdayCompleted =
        yesterdaySnap.exists() &&
        Array.isArray(yesterdaySnap.data().habitsCompleted) &&
        yesterdaySnap.data().habitsCompleted.length > 0;

      let newStreak;
      let newLongest;
      const updatePayload = { lastCheckinDate: today };

      if (yesterdayCompleted) {
        newStreak = currentStreak + 1;
        newLongest = Math.max(longestStreak, newStreak);
        updatePayload.currentStreak = newStreak;
        updatePayload.longestStreak = newLongest;
        if (newStreak > 0 && newStreak % 7 === 0) {
          streakShields += 1;
          updatePayload.streakShields = streakShields;
          updatePayload.lastShieldEarnedAt = today;
          console.log("[Streak] Shield awarded at", newStreak, "days");
        }
      } else {
        if (streakShields > 0) {
          streakShields -= 1;
          newStreak = currentStreak;
          newLongest = longestStreak;
          updatePayload.currentStreak = newStreak;
          updatePayload.longestStreak = newLongest;
          updatePayload.streakShields = streakShields;
          console.log("[Streak] Missed day: 1 shield used, streak preserved at", newStreak);
        } else {
          newStreak = 1;
          newLongest = Math.max(longestStreak, 1);
          updatePayload.currentStreak = newStreak;
          updatePayload.longestStreak = newLongest;
          updatePayload.streakShields = 0;
          console.log("[Streak] Missed day: no shields, streak reset to 1");
        }
      }

      console.log("[Streak] yesterdayCompleted:", yesterdayCompleted, "newStreak:", newStreak, "shields:", streakShields);
      await updateDoc(userRef, updatePayload);
      console.log("[Streak] User doc updated");
      updateStreakUI(newStreak);
      updateShieldsUI(streakShields);
      await writeToGroupFeeds(null, null, false, newStreak);
    } catch (err) {
      console.error("[Streak] updateStreakIfNeeded error", err);
    }
  }

  function getHabitActivityId(uid, habitId, dateId) {
    return `habit_${uid}_${habitId}_${dateId}`;
  }

  async function writeHabitActivityToGroup(habitId, habitName, gid, userName, photoURL) {
    const today = getTodayId();
    const activityId = getHabitActivityId(currentUser.uid, habitId, today);
    const activityRef = doc(db, "groups", gid, "activity", activityId);
    const existing = await getDoc(activityRef);
    if (existing.exists()) return;
    await setDoc(activityRef, {
      type: "habit",
      createdBy: currentUser.uid,
      habitId,
      habitName: habitName || "Habit",
      date: today,
      userName,
      photoURL: photoURL || null,
      likes: [],
      likesCount: 0,
      createdAt: serverTimestamp(),
    });
  }

  async function removeHabitActivityFromGroup(habitId, gid) {
    const today = getTodayId();
    const activityId = getHabitActivityId(currentUser.uid, habitId, today);
    const activityRef = doc(db, "groups", gid, "activity", activityId);
    const existing = await getDoc(activityRef);
    if (existing.exists()) await deleteDoc(activityRef);
  }

  async function writeToGroupFeeds(habitId, habitName, isAdding, streakCount) {
    if (!currentUser) return;
    try {
      const data = await getAuthState().getUserProfile();
      const groupIds = (data && data.groupIds) || [];
      const userName = (data && data.name) || data?.displayName || currentUser.displayName || currentUser.email || "Someone";
      const photoURL = data?.photoURL || null;
      if (groupIds.length === 0) return;
      const weekStart = getWeekStart();
      const today = getTodayId();

      if (habitId && habitName !== undefined) {
        if (isAdding) {
          await Promise.all(
            groupIds.map((gid) => writeHabitActivityToGroup(habitId, habitName, gid, userName, photoURL))
          );
        } else {
          await Promise.all(
            groupIds.map((gid) => removeHabitActivityFromGroup(habitId, gid))
          );
        }
      }

      if (habitId && isAdding) {
        await Promise.all(
          groupIds.map(async (gid) => {
            const statsRef = doc(db, "groups", gid, "memberStats", currentUser.uid);
            const statsSnap = await getDoc(statsRef);
            const prev = statsSnap.exists() ? statsSnap.data() : {};
            const sameWeek = prev.weekStart === weekStart;
            const alreadyCountedToday = prev.lastUpdatedDate === today;
            const newCount = sameWeek && !alreadyCountedToday
              ? (prev.checkinsThisWeek || 0) + 1
              : alreadyCountedToday ? (prev.checkinsThisWeek || 0) : 1;
            await setDoc(statsRef, { weekStart, checkinsThisWeek: newCount, lastUpdatedDate: today }, { merge: true });
          })
        );
      }

      if (streakCount != null && streakCount > 0) {
        await Promise.all(
          groupIds.map((gid) =>
            addDoc(collection(db, "groups", gid, "activity"), {
              type: "streak",
              userName,
              message: "hit a streak",
              count: streakCount,
              createdAt: serverTimestamp(),
              createdBy: currentUser.uid,
            })
          )
        );
      }
    } catch (err) {
      console.error("[Checkin] writeToGroupFeeds error", err);
    }
  }

  async function writeIdentityToGroupFeeds(identity) {
    if (!currentUser || !identity || !identity.trim()) return;
    try {
      const data = await getAuthState().getUserProfile();
      const groupIds = (data && data.groupIds) || [];
      const userName = (data && data.name) || currentUser.displayName || currentUser.email || "Someone";
      if (groupIds.length === 0) return;
      await Promise.all(
        groupIds.map((gid) =>
          addDoc(collection(db, "groups", gid, "activity"), {
            type: "identity",
            userName,
            message: "reinforced identity",
            identity: String(identity).trim(),
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
          })
        )
      );
    } catch (err) {
      console.error("[Checkin] writeIdentityToGroupFeeds error", err);
    }
  }

  todayHabitsEl.addEventListener("change", async (e) => {
    if (e.target.type !== "checkbox" || !e.target.dataset.habitId) return;
    const id = e.target.dataset.habitId;
    if (e.target.checked) {
      if (!completedIds.includes(id)) completedIds.push(id);
      const habit = habits.find((h) => h.id === id);
      showIdentityReinforcement(habit ? habit.identity : null);
      if (habit && habit.identity && habit.shareWithGroups) writeIdentityToGroupFeeds(habit.identity);
      if (completedIds.length === 1) showDailyWin();
    } else {
      completedIds = completedIds.filter((x) => x !== id);
    }
    const ref = getCheckinRef();
    if (!ref) return;
    const sanitizedCompleted = completedIds.filter((id) => habits.some((h) => h.id === id));
    const totalHabits = habits.length;
    const completedHabits = sanitizedCompleted.length;
    const fullCompletion = totalHabits > 0 && completedHabits === totalHabits;
    try {
      const payload = { habitsCompleted: sanitizedCompleted };
      if (fullCompletion) {
        payload.celebrationShown = true;
      }
      await setDoc(ref, payload);
      completedIds = sanitizedCompleted;
      console.log("[Checkin] Checkbox saved:", id, e.target.checked);
      if (fullCompletion) {
        triggerConfetti();
      }
    } catch (err) {
      console.error("[Checkin] setDoc checkin error", err);
    }
    updateProgressText();
    await updateStreakIfNeeded();
    await loadAndRenderWeeklyChain();
    const habit = habits.find((h) => h.id === id);
    if (habit && habit.shareWithGroups) {
      await writeToGroupFeeds(id, habit.name, e.target.checked, null);
    }
    // Update badge progress when habits change
    const newlyUnlocked = await updateBadgeProgress(currentUser.uid);
    if (newlyUnlocked) {
      const profile = await getAuthState().getUserProfile();
      showBadgeUnlockPopup(newlyUnlocked, profile || {});
    }
    // Update challenge progress when habit is checked
    if (e.target.checked) {
      const habit = habits.find((h) => h.id === id);
      if (habit) await updateChallengeProgress(currentUser.uid, habit);
    }
  });

  const shareBtn = document.getElementById("shareAchievementBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      try {
        shareBtn.disabled = true;
        const profile = await getAuthState().getUserProfile();
        const completedCount = habits.filter((h) => completedIds.includes(h.id)).length;
        await shareAchievement(profile || {}, {
          completedCount,
          totalCount: habits.length,
        });
      } catch (err) {
        console.error("[Checkin] Share error", err);
      } finally {
        shareBtn.disabled = false;
      }
    });
  }

  subscribeAuth(async (user) => {
    if (!user) {
      console.log("[Checkin] No user");
      return;
    }
    currentUser = user;
    if (habitsUnsubscribe) {
      habitsUnsubscribe();
      habitsUnsubscribe = null;
    }
    const habitsRef = getHabitsRef();
    if (habitsRef) {
      habitsUnsubscribe = onSnapshot(habitsRef, async () => {
        await loadHabits();
        render();
      }, async (err) => {
        console.error("[Checkin] habits onSnapshot error:", err);
        await loadHabits();
        render();
      });
    }
    console.log("[Checkin] Auth loaded:", user.uid);
    if (todayHabitsEl) todayHabitsEl.innerHTML = "<p class=\"today-habits-empty\">Loading…</p>";
    await loadHabits();
    await loadCheckin();
    await loadAndRenderWeeklyChain();
    render();
  });

  try {
    const bc = new BroadcastChannel("mim-habits-changed");
    bc.onmessage = async () => {
      if (currentUser && typeof loadHabits === "function") {
        await loadHabits();
        render();
      }
    };
  } catch (e) {
    /* BroadcastChannel not supported */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
function showDailyWin() {

    const div = document.createElement("div");
  
    div.className = "daily-win";
  
    div.textContent = "🎉 Momentum Started — Great job showing up today!";
  
    document.body.appendChild(div);
  
    setTimeout(() => {
      div.remove();
    }, 3000);
  
  }