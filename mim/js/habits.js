/**
 * Habits page: add, delete, load habits from Firestore at users/{uid}/habits/{habitId}
 * Waits for auth via onAuthStateChanged before any Firestore access.
 */
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { escapeHtml, escapeAttr, showToast } from "./utils.js";

let currentUser = null;
let habitsUnsubscribe = null;

function getHabitsRef() {
  if (!currentUser) return null;
  return collection(db, "users", currentUser.uid, "habits");
}

function showError(message) {
  const el = document.getElementById("habitsError");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  console.error("[Habits] Error:", message);
}

function clearError() {
  const el = document.getElementById("habitsError");
  if (el) {
    el.textContent = "";
    el.hidden = true;
  }
}

function init() {
  console.log("[Habits] DOM ready, attaching listeners and waiting for auth");

  const habitList = document.getElementById("habitList");
  const addHabitBtn = document.getElementById("addHabitBtn");
  const newHabitInput = document.getElementById("newHabitInput");
  const addHabitForm = document.getElementById("addHabitForm");

  if (!habitList || !addHabitBtn || !newHabitInput) {
    console.error("[Habits] Missing DOM elements", {
      habitList: !!habitList,
      addHabitBtn: !!addHabitBtn,
      newHabitInput: !!newHabitInput,
    });
    return;
  }

  async function loadHabits() {
    if (!currentUser) {
      console.warn("[Habits] loadHabits skipped: no user");
      return;
    }
    const habitsRef = getHabitsRef();
    if (!habitsRef) {
      console.warn("[Habits] loadHabits skipped: no habits ref");
      return;
    }
    const path = `users/${currentUser.uid}/habits`;
    console.log("[Habits] Firestore read: loading habits from", path);
    habitList.innerHTML = "<p class=\"habits-empty\">Loading…</p>";
    clearError();
    try {
      const snapshot = await getDocs(habitsRef);
      console.log("[Habits] Firestore read success: got", snapshot.size, "habits");
      habitList.innerHTML = "";
      if (snapshot.empty) {
        habitList.innerHTML = '<p class="habits-empty">No habits yet. Add one below.</p>';
        return;
      }
      const docs = snapshot.docs.slice().sort((a, b) => {
        const ta = a.data().createdAt?.toMillis?.() ?? 0;
        const tb = b.data().createdAt?.toMillis?.() ?? 0;
        return ta - tb;
      });
      docs.forEach((docItem) => {
        const habit = docItem.data();
        const name = habit.name || "Unnamed";
        const isShared = habit.isShared === true;
        const card = document.createElement("div");
        card.className = "habit-card";
        card.dataset.habitId = docItem.id;
        card.dataset.isShared = isShared ? "true" : "false";
        const shareBadge = isShared ? '<span class="habit-shared-badge" aria-label="Shared with groups">👥</span>' : "";
        card.innerHTML =
          `<span class="habit-card-name">${escapeHtml(name)}${shareBadge}</span>` +
          `<div class="habit-card-actions">` +
          `<button type="button" data-id="${escapeAttr(docItem.id)}" class="habit-card-edit" aria-label="Edit habit">Edit</button>` +
          `<button type="button" data-id="${escapeAttr(docItem.id)}" class="habit-card-delete" aria-label="Delete habit">Delete</button>` +
          `</div>`;
        habitList.appendChild(card);
      });
    } catch (err) {
      console.error("[Habits] Firestore read error", err.code || err.message, err);
      habitList.innerHTML = "";
      showError(err.message || "Could not load habits. Check console and Firestore rules.");
    }
  }

  async function handleAddHabit(e) {
    if (e) e.preventDefault();
    const name = (newHabitInput && newHabitInput.value) ? newHabitInput.value.trim() : "";
    if (!name) {
      console.warn("[Habits] Add skipped: empty habit name");
      showError("Please enter a habit name.");
      return;
    }
    if (!currentUser) {
      console.warn("[Habits] Add skipped: user not loaded yet");
      showError("Please wait for sign-in to complete.");
      return;
    }
    const habitsRef = getHabitsRef();
    if (!habitsRef) {
      showError("Cannot add habit: invalid session.");
      return;
    }
    console.log("[Habits] Add habit event: submitting", name);
    addHabitBtn.disabled = true;
    clearError();
    const isShared = document.getElementById("newHabitShare")?.checked === true;
    addHabitBtn.textContent = "Saving...";
    try {
      const ref = await addDoc(habitsRef, {
        name,
        createdAt: serverTimestamp(),
        completedDates: [],
        isShared: !!isShared,
        source: "manual",
      });
      console.log("[Habits] Firestore write success: habit added with id", ref.id);
      showToast("Habit saved ✓");
      if (newHabitInput) newHabitInput.value = "";
      const shareCheckbox = document.getElementById("newHabitShare");
      if (shareCheckbox) shareCheckbox.checked = false;
      await loadHabits();
    } catch (err) {
      console.error("[Habits] Firestore write error", err.code || err.message, err);
      showError(err.message || "Could not add habit. Check console and Firestore rules.");
    } finally {
      addHabitBtn.disabled = false;
      addHabitBtn.textContent = "Add Habit";
    }
  }

  addHabitBtn.addEventListener("click", (e) => {
    e.preventDefault();
    handleAddHabit(null);
  });

  if (addHabitForm) {
    addHabitForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleAddHabit(e);
    });
  }

  habitList.addEventListener("click", async (e) => {
    const card = e.target.closest(".habit-card");
    if (!card) return;

      const editBtn = e.target.closest(".habit-card-edit");
    if (editBtn) {
      e.preventDefault();
      const habitId = editBtn.dataset.id;
      const nameEl = card.querySelector(".habit-card-name");
      const rawText = nameEl ? nameEl.textContent : "";
      const currentName = rawText.replace(/\s*👥\s*$/, "").trim();
      const currentShare = card.dataset.isShared === "true";
      if (!habitId || !currentUser) return;
      card.dataset.habitId = habitId;
      card.classList.add("habit-card--editing");
      card.innerHTML =
        `<input type="text" class="habit-card-input input-field" value="${escapeAttr(currentName)}" maxlength="100" placeholder="Habit name" />` +
        `<label class="habit-share-wrap habit-share-wrap--edit">` +
        `<input type="checkbox" class="habit-share-input habit-card-share-input" ${currentShare ? "checked" : ""} />` +
        `<span class="habit-share-label">Share this habit with groups</span>` +
        `</label>` +
        `<div class="habit-card-actions">` +
        `<button type="button" class="habit-card-save">Save</button>` +
        `<button type="button" class="habit-card-cancel">Cancel</button>`;
      const input = card.querySelector(".habit-card-input");
      input.focus();
      input.select();
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          card.querySelector(".habit-card-save").click();
        }
      });
      return;
    }

    const saveBtn = e.target.closest(".habit-card-save");
    if (saveBtn) {
      e.preventDefault();
      const habitId = card.dataset.habitId;
      const input = card.querySelector(".habit-card-input");
      const shareInput = card.querySelector(".habit-card-share-input");
      const newName = input ? input.value.trim() : "";
      const isShared = shareInput ? shareInput.checked : false;
      if (!habitId || !currentUser) return;
      if (!newName) {
        showError("Please enter a habit name.");
        return;
      }
      const habitRef = doc(db, "users", currentUser.uid, "habits", habitId);
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;
      try {
        await updateDoc(habitRef, { name: newName, isShared: !!isShared, shareWithGroups: !!isShared });
        console.log("[Habits] Habit updated:", habitId);
        showToast("Habit updated ✓");
        loadHabits();
      } catch (err) {
        console.error("[Habits] updateDoc error", err);
        showError(err.message || "Could not update habit.");
      } finally {
        saveBtn.textContent = "Save";
        saveBtn.disabled = false;
      }
      return;
    }

    const cancelBtn = e.target.closest(".habit-card-cancel");
    if (cancelBtn) {
      e.preventDefault();
      loadHabits();
      return;
    }

    const deleteBtn = e.target.closest(".habit-card-delete");
    if (deleteBtn) {
      e.preventDefault();
      const habitId = deleteBtn.dataset.id;
      if (!habitId || !currentUser) return;
      const habitRef = doc(db, "users", currentUser.uid, "habits", habitId);
      try {
        await deleteDoc(habitRef);
        console.log("[Habits] Habit deleted:", habitId);
        loadHabits();
      } catch (err) {
        console.error("[Habits] Firestore delete error", err.code || err.message, err);
        showError(err.message || "Could not delete habit.");
      }
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.log("[Habits] Auth state: no user, redirecting to login");
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    if (habitsUnsubscribe) {
      habitsUnsubscribe();
      habitsUnsubscribe = null;
    }
    const habitsRef = getHabitsRef();
    if (habitsRef) {
      habitsUnsubscribe = onSnapshot(habitsRef, () => {
        loadHabits();
      }, (err) => {
        console.error("[Habits] onSnapshot error:", err);
        loadHabits();
      });
    }
    console.log("[Habits] Auth state: user loaded", user.uid);
    loadHabits();
  });

  try {
    const bc = new BroadcastChannel("mim-habits-changed");
    bc.onmessage = () => {
      if (currentUser) loadHabits();
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
