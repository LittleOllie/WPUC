/**
 * habitCompletions: per-date completion records (Part 2).
 * Write-through when completing habits; existing habit.completedDates preserved.
 * Structure: id, userId, habitId, challengeId?, date, completed, points, createdAt
 */
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";

/**
 * Document ID for a habit completion (idempotent per habit+date).
 */
function getCompletionDocId(habitId, dateId) {
  return `${habitId}_${dateId}`;
}

/**
 * Write a habit completion record (Part 2).
 * Call when adding a completion; does NOT delete existing data.
 * @param {string} uid - User ID
 * @param {string} habitId - Habit document ID
 * @param {string} dateId - YYYY-MM-DD
 * @param {boolean} completed - true for complete, false for uncomplete
 * @param {number} points - Points for this completion (0 if not linked to challenge)
 * @param {string} [challengeId] - Optional challenge ID if from group challenge
 */
export async function writeHabitCompletion(uid, habitId, dateId, completed, points = 0, challengeId = null) {
  if (!uid || !habitId || !dateId) return;
  const ref = doc(db, "users", uid, "habitCompletions", getCompletionDocId(habitId, dateId));
  await setDoc(ref, {
    userId: uid,
    habitId,
    challengeId: challengeId || null,
    date: dateId,
    completed: !!completed,
    points: typeof points === "number" ? points : 0,
    createdAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Remove a habit completion record (when unchecking).
 * Keeps document for audit but sets completed: false; or we could delete.
 * Spec says "do NOT delete" - so we update to completed: false.
 */
export async function removeHabitCompletion(uid, habitId, dateId) {
  if (!uid || !habitId || !dateId) return;
  const ref = doc(db, "users", uid, "habitCompletions", getCompletionDocId(habitId, dateId));
  await setDoc(ref, {
    userId: uid,
    habitId,
    challengeId: null,
    date: dateId,
    completed: false,
    points: 0,
    createdAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Backfill habitCompletions from existing habit.completedDates (Part 8 - preserve, migrate).
 * Call once per user; does not delete any existing data.
 */
export async function backfillHabitCompletionsFromHabits(uid, habits) {
  if (!uid || !Array.isArray(habits)) return;
  for (const h of habits) {
    const completed = h.completedDates || [];
    for (const dateId of completed) {
      await writeHabitCompletion(uid, h.id, dateId, true, 0, h.challengeId || null);
    }
  }
}
