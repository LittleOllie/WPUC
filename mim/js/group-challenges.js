/**
 * Group challenges: create, accept, and award points when habits are completed.
 * Challenges stored at groups/{groupId}/challenges/{challengeId}
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { HABIT_LIBRARY } from "./habitLibrary.js";

/**
 * Add challenge habits to user. Only adds habits the user doesn't already have (by habitId).
 * Habits are created from the Habit Library; name is looked up by habitId.
 * @param {string} uid - User ID
 * @param {string} groupId - Group ID
 * @param {string} challengeId - Challenge ID
 * @param {Array<{habitId: string, points: number}>} habits - Challenge habits
 * @returns {Promise<number>} - Number of habits added
 */
export async function acceptGroupChallenge(uid, groupId, challengeId, habits) {
  if (!uid || !groupId || !challengeId || !Array.isArray(habits) || habits.length === 0) return 0;

  const habitsRef = collection(db, "users", uid, "habits");
  const habitsSnap = await getDocs(habitsRef);
  const existingHabits = habitsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const createdDate = new Date().toISOString().split("T")[0];
  let added = 0;

  for (const h of habits) {
    const habitId = h.habitId;
    if (!habitId) continue;
    if (existingHabits.some((eh) => eh.habitId === habitId)) continue;

    const lib = HABIT_LIBRARY.find((x) => x.habitId === habitId);
    const name = lib ? lib.name : habitId;

    await addDoc(habitsRef, {
      habitId,
      name,
      source: "groupChallenge",
      challengeId,
      groupId,
      createdDate,
      completedDates: [],
      createdAt: serverTimestamp(),
      isShared: true,
    });
    existingHabits.push({ habitId });
    added++;
  }

  return added;
}

/**
 * Award points when a group challenge habit is completed.
 * Only awards once per habit per date (uses groupChallengeAwardedDates).
 * @param {string} uid - User ID
 * @param {object} habit - Habit object with id, habitId, source, challengeId, groupId, groupChallengeAwardedDates
 * @param {string} dateId - YYYY-MM-DD
 * @returns {Promise<number>} - Points awarded, or 0
 */
export async function awardGroupChallengePoints(uid, habit, dateId) {
  if (!uid || !habit || habit.source !== "groupChallenge") return 0;
  const groupId = habit.groupId;
  const challengeId = habit.challengeId;
  const habitIdForMatch = habit.habitId || habit.groupChallengeHabitId;
  const habitDocId = habit.id;
  if (!groupId || !challengeId || !habitIdForMatch) return 0;

  const awarded = habit.groupChallengeAwardedDates || [];
  if (awarded.includes(dateId)) return 0;

  const challengeRef = doc(db, "groups", groupId, "challenges", challengeId);
  const challengeSnap = await getDoc(challengeRef);
  if (!challengeSnap.exists()) return 0;

  const data = challengeSnap.data();
  const habits = data.habits || [];
  const habitDef = habits.find((h) => h.habitId === habitIdForMatch);
  if (!habitDef || typeof habitDef.points !== "number") return 0;

  const points = habitDef.points;

  const memberRef = doc(db, "groups", groupId, "members", uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) return 0;

  await updateDoc(memberRef, { points: increment(points) });
  if (habitDocId) {
    const habitRef = doc(db, "users", uid, "habits", habitDocId);
    await updateDoc(habitRef, { groupChallengeAwardedDates: arrayUnion(dateId) });
  }
  return points;
}

