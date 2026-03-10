/**
 * Dashboard habits: rolling weekly view, day selector, habit completion per date.
 * Completion stored in habit.completedDates and synced to checkins for streak/badge.
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
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { escapeHtml, escapeAttr, getWeekStart, showToast } from "./utils.js";
import { subscribeAuth, getAuthState } from "./auth-state.js";
import { shareAchievement } from "./share-achievement.js";
import { awardGroupChallengePoints, revokeGroupChallengePoints } from "./group-challenges.js";

/** Context-specific prompts for habit notes by habitId from library. */
const HABIT_NOTE_PROMPTS = {
  "exercise": "What did you do? (e.g. ran 3 miles, 30 min weights)",
  "walk": "Where did you walk? How far?",
  "read": "What book? How many pages?",
  "sleep-8-hours": "How many hours did you sleep?",
  "post-progress": "Share your Twitter/X link",
  "drink-water": "Any notes?",
  "stretch": "What stretches? How long?",
  "meditate": "How long? Any notes?",
  "journal": "Any highlights to remember?",
  "cold-shower": "How long? Any notes?",
};

let currentUser = null;
let habits = [];
let habitsUnsubscribe = null;
/** Currently selected date (YYYY-MM-DD). Default: today. */
let selectedDate = "";
/** Checkin data for selected date (habitNotes, etc.) */
let checkinDataForDate = { habitNotes: {} };
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

function getNotePromptForHabit(habit) {
  const habitId = habit?.habitId || "";
  return HABIT_NOTE_PROMPTS[habitId] || "Any notes? (optional)";
}

async function loadCheckinForDate(dateId) {
  if (!currentUser || !dateId) return;
  try {
    const ref = getCheckinRef(dateId);
    if (!ref) return;
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    checkinDataForDate = { habitNotes: data.habitNotes || {} };
  } catch (err) {
    console.error("[Checkin] loadCheckinForDate error", err);
    checkinDataForDate = { habitNotes: {} };
  }
}

/** Show floating "+X" text near habit when challenge points are awarded. Animates up and fades out. */
function showHabitPointsFloat(checkboxEl, points) {
  const row = checkboxEl?.closest(".habit-check");
  if (!row) return;
  const float = document.createElement("span");
  float.className = "habit-points-float";
  float.textContent = "+" + points;
  row.appendChild(float);
  requestAnimationFrame(() => float.classList.add("habit-points-float--animate"));
  setTimeout(() => float.remove(), 1100);
}

/** Date string YYYY-MM-DD for N days ago (0 = today). */
function getDateId(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

const DAY_NAMES_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
function getDayNameShort(dateId) {
  const d = new Date(dateId + "T12:00:00Z");
  return DAY_NAMES_SHORT[d.getUTCDay()];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function getDayName(dateId) {
  const d = new Date(dateId + "T12:00:00Z");
  return DAY_NAMES[d.getUTCDay()];
}

/** Whether the date is editable (today or up to 3 days in the past). */
function isDayEditable(dateId) {
  const today = getTodayId();
  if (dateId > today) return false;
  const dToday = new Date(today + "T12:00:00Z").getTime();
  const dDate = new Date(dateId + "T12:00:00Z").getTime();
  const daysDiff = Math.floor((dToday - dDate) / (24 * 60 * 60 * 1000));
  return daysDiff <= 3;
}

/** Whether the date is in the future. */
function isDayInFuture(dateId) {
  return dateId > getTodayId();
}

/** Habits that existed on the given day. Legacy habits without createdDate count for all days. */
function getActiveHabitsForDate(dateId) {
  return habits.filter((h) => {
    if (!h.createdDate) return true;
    return h.createdDate <= dateId;
  });
}

/** Day status: "complete" | "incomplete" | "future" */
function getDayStatus(dateId) {
  if (isDayInFuture(dateId)) return "future";
  const activeHabits = getActiveHabitsForDate(dateId);
  const completedForDay = activeHabits.filter((h) => (h.completedDates || []).includes(dateId)).length;
  const total = activeHabits.length;
  if (total === 0) return "complete";
  return completedForDay === total ? "complete" : "incomplete";
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

function getCheckinRef(dateId) {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid, "checkins", dateId || getTodayId());
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
  const activeHabits = getActiveHabitsForDate(selectedDate);
  const total = activeHabits.length;
  const completedForSelected = activeHabits.filter((h) => (h.completedDates || []).includes(selectedDate)).length;
  const percent = total ? Math.round((completedForSelected / total) * 100) : 0;

  console.log("[Checkin] Total habits:", total, "Completed for", selectedDate + ":", completedForSelected);

  const titleEl = document.getElementById("todayProgressTitle");
  if (titleEl) {
    if (selectedDate === getTodayId()) {
      titleEl.textContent = "Today's Progress";
    } else {
      const d = new Date(selectedDate + "T12:00:00Z");
      const options = { month: "short", day: "numeric", year: "numeric" };
      titleEl.textContent = d.toLocaleDateString(undefined, options) + " Progress";
    }
  }

  if (progressTextEl) {
    progressTextEl.textContent = total
      ? `${completedForSelected} / ${total} habits completed`
      : "Add habits to track your progress.";
  }
  if (progressFillEl) {
    progressFillEl.style.width = percent + "%";
  }
  if (completeMsgEl) {
    const allDone = total > 0 && completedForSelected === total;
    completeMsgEl.textContent = "All habits completed 🎉";
    completeMsgEl.hidden = !allDone;
  }
  const shareBtn = document.getElementById("shareAchievementBtn");
  const isToday = selectedDate === getTodayId();
  if (shareBtn) shareBtn.hidden = !(total > 0 && completedForSelected === total && isToday);
}

/** Render the rolling weekly day selector. Today on far right. */
function renderDaySelector() {
  const container = document.getElementById("weeklyDaySelector");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 6; i >= 0; i--) {
    const dateId = getDateId(i);
    const dayName = getDayNameShort(dateId);
    const status = getDayStatus(dateId);
    const editable = isDayEditable(dateId);
    const future = isDayInFuture(dateId);
    const isSelected = dateId === selectedDate;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "weekly-day-btn";
    btn.textContent = dayName;
    btn.dataset.dateId = dateId;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", isSelected ? "true" : "false");

    if (status === "complete") btn.classList.add("weekly-day-btn--complete");
    else if (status === "incomplete") btn.classList.add("weekly-day-btn--incomplete");
    else if (future) btn.classList.add("weekly-day-btn--future");

    if (isSelected) btn.classList.add("weekly-day-btn--selected");

    if (!editable) {
      btn.classList.add("weekly-day-btn--locked");
      btn.setAttribute("data-tooltip", "Past entries older than 3 days cannot be edited.");
    }

    btn.addEventListener("click", async () => {
      if (!editable) {
        showToast("Past entries older than 3 days cannot be edited.");
        return;
      }
      selectedDate = dateId;
      await loadCheckinForDate(dateId);
      renderDaySelector();
      render();
      updateProgressText();
    });

    container.appendChild(btn);
  }
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
  const visibleHabits = habits.filter((h) => {
    if (!h.createdDate) return true;
    return h.createdDate <= selectedDate;
  });
  const future = isDayInFuture(selectedDate);
  const editable = isDayEditable(selectedDate);
  const disableCheckboxes = future || !editable;

  if (visibleHabits.length === 0) {
    container.innerHTML =
      '<p class="today-habits-empty">No habits were tracked on this date.</p>';
    updateProgressText();
    return;
  }
  visibleHabits.forEach((habit) => {
    const completedDates = habit.completedDates || [];
    const checked = completedDates.includes(selectedDate);
    const note = checkinDataForDate?.habitNotes?.[habit.id] || "";
    const row = document.createElement("div");
    row.className = "habit-check";
    row.innerHTML =
      `<label class="habit-check-label">` +
      `<input type="checkbox" ${checked ? "checked" : ""} ${disableCheckboxes ? "disabled" : ""} data-habit-id="${escapeAttr(habit.id)}" />` +
      `<span class="habit-check-name">${escapeHtml(habit.name || "Unnamed")}</span>` +
      `</label>` +
      (checked && note ? `<p class="habit-check-note muted-text small-text">${escapeHtml(note)}</p>` : "");
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

  /** Backfill habit.completedDates from checkins (one-time migration). */
  async function backfillCompletedDatesFromCheckins() {
    const checkinsRef = collection(db, "users", currentUser.uid, "checkins");
    const snap = await getDocs(checkinsRef);
    let migrated = 0;
    for (const d of snap.docs) {
      const dateId = d.id;
      const data = d.data();
      const completedIds = Array.isArray(data.habitsCompleted) ? data.habitsCompleted : [];
      for (const habitId of completedIds) {
        const habit = habits.find((h) => h.id === habitId);
        if (!habit) continue;
        const cd = habit.completedDates || [];
        if (!cd.includes(dateId)) {
          const habitRef = doc(db, "users", currentUser.uid, "habits", habitId);
          await updateDoc(habitRef, { completedDates: arrayUnion(dateId) });
          habit.completedDates = [...cd, dateId];
          migrated++;
        }
      }
    }
    if (migrated > 0) console.log("[Checkin] Migrated", migrated, "habit completions from checkins");
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
        const completedDates = Array.isArray(data.completedDates) ? [...data.completedDates] : [];
        habits.push({ id: d.id, ...data, shareWithGroups, completedDates });
      });
      habits.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return ta - tb;
      });
      await backfillCompletedDatesFromCheckins();
      console.log("[Checkin] Habits loaded:", habits.length);
    } catch (err) {
      console.error("[Checkin] loadHabits error", err);
      habits = [];
    }
  }

  async function loadCheckin() {
    const ref = getCheckinRef(getTodayId());
    if (!ref) return;
    try {
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      celebrationShownToday = data.celebrationShown === true;
    } catch (err) {
      console.error("[Checkin] loadCheckin error", err);
      celebrationShownToday = false;
    }
  }


  /** Streak + shields: day counts if habits completed for today. One shield per 7 days. Missed day: use shield or reset. */
  async function updateStreakIfNeeded() {
    const todayActiveHabits = getActiveHabitsForDate(getTodayId());
    const todayCompleted = todayActiveHabits.filter((h) => (h.completedDates || []).includes(getTodayId())).length;
    if (todayCompleted === 0) return;
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

  async function writeHabitActivityToGroup(habitId, habitName, gid, userName, photoURL, note) {
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
      note: note || null,
      likes: [],
      likesCount: 0,
      createdAt: serverTimestamp(),
    });
  }

  async function updateHabitActivityNoteInGroups(habitId, dateId, note) {
    if (!currentUser) return;
    try {
      const data = await getAuthState().getUserProfile();
      const groupIds = (data && data.groupIds) || [];
      if (groupIds.length === 0) return;
      const activityId = `habit_${currentUser.uid}_${habitId}_${dateId}`;
      await Promise.all(
        groupIds.map(async (gid) => {
          const activityRef = doc(db, "groups", gid, "activity", activityId);
          const snap = await getDoc(activityRef);
          if (snap.exists()) await updateDoc(activityRef, { note: note || null });
        })
      );
    } catch (err) {
      console.error("[Checkin] updateHabitActivityNoteInGroups error", err);
    }
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

  function showHabitNotesModal(habit, onSave) {
    const modal = document.getElementById("habitNotesModal");
    const promptEl = document.getElementById("habitNotesModalPrompt");
    const inputEl = document.getElementById("habitNotesInput");
    const titleEl = document.getElementById("habitNotesModalTitle");
    const skipBtn = document.getElementById("habitNotesSkipBtn");
    const submitBtn = document.getElementById("habitNotesSubmitBtn");
    const backdrop = modal?.querySelector(".habit-notes-modal-backdrop");
    if (!modal || !inputEl) return;
    if (titleEl) titleEl.textContent = habit?.name || "Add a note";
    if (promptEl) promptEl.textContent = getNotePromptForHabit(habit);
    inputEl.value = "";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    inputEl.focus();
    const close = () => {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    };
    const handleSave = async () => {
      const note = (inputEl.value || "").trim();
      close();
      if (note && onSave) await onSave(note);
    };
    skipBtn?.replaceWith(skipBtn.cloneNode(true));
    submitBtn?.replaceWith(submitBtn.cloneNode(true));
    document.getElementById("habitNotesSkipBtn")?.addEventListener("click", close);
    document.getElementById("habitNotesSubmitBtn")?.addEventListener("click", () => handleSave());
    backdrop?.addEventListener("click", close);
  }

  todayHabitsEl.addEventListener("change", async (e) => {
    if (e.target.type !== "checkbox" || !e.target.dataset.habitId) return;
    if (!isDayEditable(selectedDate) || isDayInFuture(selectedDate)) return;
    const id = e.target.dataset.habitId;
    const isAdding = e.target.checked;
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;

    try {
      const habitRef = doc(db, "users", currentUser.uid, "habits", id);
      if (isAdding) {
        await updateDoc(habitRef, { completedDates: arrayUnion(selectedDate) });
        habit.completedDates = [...(habit.completedDates || []), selectedDate];
      } else {
        await updateDoc(habitRef, { completedDates: arrayRemove(selectedDate) });
        habit.completedDates = (habit.completedDates || []).filter((d) => d !== selectedDate);
      }

      const activeHabits = getActiveHabitsForDate(selectedDate);
      const completedIdsForDate = activeHabits
        .filter((h) => (h.completedDates || []).includes(selectedDate))
        .map((h) => h.id);
      const payload = { habitsCompleted: completedIdsForDate };
      if (selectedDate === getTodayId() && completedIdsForDate.length === activeHabits.length) {
        payload.celebrationShown = true;
      }
      await setDoc(getCheckinRef(selectedDate), payload, { merge: true });

      if (isAdding && selectedDate === getTodayId()) {
        showIdentityReinforcement(habit.identity || null);
        if (habit.identity && habit.shareWithGroups) writeIdentityToGroupFeeds(habit.identity);
        const wasFirst = completedIdsForDate.length === 1;
        if (wasFirst) showDailyWin();
      }

      const fullCompletion = activeHabits.length > 0 && completedIdsForDate.length === activeHabits.length;
      if (fullCompletion && selectedDate === getTodayId()) triggerConfetti();

      console.log("[Checkin] Checkbox saved:", id, isAdding, "for", selectedDate);
    } catch (err) {
      console.error("[Checkin] Checkbox save error", err);
      return;
    }

    updateProgressText();
    renderDaySelector();

    if (selectedDate === getTodayId()) {
      await updateStreakIfNeeded();
      if (habit.shareWithGroups) {
        await writeToGroupFeeds(id, habit.name, isAdding, null);
      }
    }
    if (habit.source === "groupChallenge") {
      try {
        if (isAdding && selectedDate === getTodayId()) {
          const pts = await awardGroupChallengePoints(currentUser.uid, habit, selectedDate);
          if (pts > 0) {
            showToast("+" + pts + " pts!");
            showHabitPointsFloat(e.target, pts);
          }
        } else if (!isAdding) {
          const pts = await revokeGroupChallengePoints(currentUser.uid, habit, selectedDate);
          if (pts > 0) showToast("-" + pts + " pts");
        }
      } catch (err) {
        console.error("[Checkin] groupChallenge points error", err);
      }
    }
    if (isAdding) {
      showHabitNotesModal(habit, async (note) => {
        const checkinRef = getCheckinRef(selectedDate);
        if (!checkinRef) return;
        const snap = await getDoc(checkinRef);
        const data = snap.exists() ? snap.data() : {};
        const habitNotes = { ...(data.habitNotes || {}), [id]: note };
        await setDoc(checkinRef, { habitNotes }, { merge: true });
        checkinDataForDate.habitNotes = habitNotes;
        if (habit.shareWithGroups && selectedDate === getTodayId()) {
          try {
            await updateHabitActivityNoteInGroups(id, selectedDate, note);
          } catch (err) {
            console.error("[Checkin] updateHabitActivityNoteInGroups error", err);
          }
        }
        await loadCheckinForDate(selectedDate);
        render();
        showToast("Note saved");
      });
    }
  });

  const shareBtn = document.getElementById("shareAchievementBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      try {
        shareBtn.disabled = true;
        const profile = await getAuthState().getUserProfile();
        const today = getTodayId();
        const todayActiveHabits = getActiveHabitsForDate(today);
        const completedCount = todayActiveHabits.filter((h) => (h.completedDates || []).includes(today)).length;
        await shareAchievement(profile || {}, {
          completedCount,
          totalCount: todayActiveHabits.length,
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
        renderDaySelector();
        render();
      }, async (err) => {
        console.error("[Checkin] habits onSnapshot error:", err);
        await loadHabits();
        render();
      });
    }
    console.log("[Checkin] Auth loaded:", user.uid);
    selectedDate = getTodayId();
    if (todayHabitsEl) todayHabitsEl.innerHTML = "<p class=\"today-habits-empty\">Loading…</p>";
    await loadHabits();
    await loadCheckin();
    await loadCheckinForDate(selectedDate);
    renderDaySelector();
    render();
  });

  try {
    const bc = new BroadcastChannel("mim-habits-changed");
    bc.onmessage = async () => {
      if (currentUser) {
        await loadHabits();
        renderDaySelector();
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