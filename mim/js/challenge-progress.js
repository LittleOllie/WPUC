/**
 * Challenge progress: when a habit is completed, increment active challenge progress.
 * When progress reaches durationDays, show Keep/Remove modal, then move to completedChallenges.
 */
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { showChallengeCompletePopup } from "./challenge-complete-popup.js";
import { CHALLENGE_DEFINITIONS } from "./challenge-definitions.js";

function getTodayId() {
  return new Date().toISOString().split("T")[0];
}

async function loadChallengesFromFirestore() {
  try {
    const snapshot = await getDocs(collection(db, "challenges"));
    if (snapshot.empty) return null;
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return null;
  }
}

async function getChallengeDef(challengeId) {
  const fromFirestore = await loadChallengesFromFirestore();
  if (fromFirestore) {
    const found = fromFirestore.find((c) => c.id === challengeId);
    if (found) return found;
  }
  return CHALLENGE_DEFINITIONS.find((c) => c.id === challengeId);
}

/**
 * Update challenge progress when a habit is completed.
 * Call from checkin.js when a habit is checked (added to habitsCompleted).
 * @param {string} uid - User ID
 * @param {{ id: string; name: string }} habit - The habit that was completed
 */
export async function updateChallengeProgress(uid, habit) {
  if (!uid || !habit?.name) return;

  const habitName = String(habit.name).trim();
  const today = getTodayId();
  const activeRef = collection(db, "users", uid, "activeChallenges");
  const snapshot = await getDocs(activeRef);

  for (const d of snapshot.docs) {
    const data = d.data();
    const challengeHabitName = String(data.habitName || "").trim();
    if (challengeHabitName !== habitName) continue;

    const challengeId = data.challengeId || d.id;
    const progress = Number(data.progress) || 0;
    const durationDays = Number(data.durationDays) || 7;
    const lastProgressDate = data.lastProgressDate || null;

    if (lastProgressDate === today) continue;

    const newProgress = progress + 1;

    if (newProgress >= durationDays) {
      const def = await getChallengeDef(challengeId);
      if (typeof globalThis.confetti === "function") {
        globalThis.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      const choice = await showChallengeCompletePopup({ ...def, durationDays });
      const habitKept = choice === "keep";

      if (!habitKept) {
        const storedHabitId = data.habitId;
        if (storedHabitId) {
          await deleteDoc(doc(db, "users", uid, "habits", storedHabitId));
        } else {
          const habitsRef = collection(db, "users", uid, "habits");
          const habitsSnap = await getDocs(habitsRef);
          const habitDoc = habitsSnap.docs.find((d) => d.data().challengeId === challengeId);
          if (habitDoc) {
            await deleteDoc(doc(db, "users", uid, "habits", habitDoc.id));
          }
        }
        try {
          if (typeof BroadcastChannel !== "undefined") {
            new BroadcastChannel("mim-habits-changed").postMessage("changed");
          }
        } catch (e) {}
      }

      await setDoc(doc(db, "users", uid, "completedChallenges", challengeId), {
        challengeId,
        completedAt: today,
        habitKept,
      });
      await deleteDoc(doc(db, "users", uid, "activeChallenges", challengeId));
    } else {
      await updateDoc(doc(db, "users", uid, "activeChallenges", challengeId), {
        progress: increment(1),
        lastProgressDate: today,
      });
    }
  }
}
