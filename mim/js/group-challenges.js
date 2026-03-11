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
  setDoc,
  arrayUnion,
  arrayRemove,
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

/** Normalize date to YYYY-MM-DD string (handles Firestore Timestamp). */
function toDateId(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val && typeof val.toDate === "function") return val.toDate().toISOString().split("T")[0];
  return String(val).slice(0, 10);
}

/**
 * Check if a completion date falls within the challenge's startDate/endDate.
 * @param {object} challengeData - Challenge document data
 * @param {string} dateId - YYYY-MM-DD
 * @returns {boolean}
 */
function isDateWithinChallengeRange(challengeData, dateId) {
  const start = toDateId(challengeData.startDate) || "";
  const end = toDateId(challengeData.endDate) || "";
  if (!start && !end) return true;
  if (start && dateId < start) return false;
  if (end && dateId > end) return false;
  return true;
}

/**
 * Award points when a group challenge habit is completed.
 * Only awards once per habit per date (uses groupChallengeAwardedDates).
 * Only awards if date is within challenge startDate/endDate (Part 5, 7).
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
  if (!isDateWithinChallengeRange(data, dateId)) return 0;

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

/**
 * Revoke points when a group challenge habit is unchecked.
 * Fetches the habit doc from Firestore to get authoritative groupChallengeAwardedDates
 * (in-memory habit can be stale). Only revokes if the date was previously awarded.
 * @param {string} uid - User ID
 * @param {object} habit - Habit object with id, habitId, source, challengeId, groupId
 * @param {string} dateId - YYYY-MM-DD
 * @returns {Promise<number>} - Points revoked, or 0
 */
export async function revokeGroupChallengePoints(uid, habit, dateId) {
  if (!uid || !habit || habit.source !== "groupChallenge") return 0;
  const groupId = habit.groupId;
  const challengeId = habit.challengeId;
  const habitIdForMatch = habit.habitId || habit.groupChallengeHabitId;
  const habitDocId = habit.id;
  if (!groupId || !challengeId || !habitIdForMatch) return 0;

  const habitRef = doc(db, "users", uid, "habits", habitDocId);
  const habitSnap = await getDoc(habitRef);
  const habitData = habitSnap.exists() ? habitSnap.data() : {};
  const awarded = habitData.groupChallengeAwardedDates || [];
  if (!awarded.includes(dateId)) return 0;

  const challengeRef = doc(db, "groups", groupId, "challenges", challengeId);
  const challengeSnap = await getDoc(challengeRef);
  if (!challengeSnap.exists()) return 0;

  const data = challengeSnap.data();
  if (!isDateWithinChallengeRange(data, dateId)) return 0;

  const habits = data.habits || [];
  const habitDef = habits.find((h) => h.habitId === habitIdForMatch);
  if (!habitDef || typeof habitDef.points !== "number") return 0;

  const points = habitDef.points;

  const memberRef = doc(db, "groups", groupId, "members", uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) return 0;

  await updateDoc(memberRef, { points: increment(-points) });
  if (habitDocId) {
    const habitRef = doc(db, "users", uid, "habits", habitDocId);
    await updateDoc(habitRef, { groupChallengeAwardedDates: arrayRemove(dateId) });
  }
  return points;
}

/**
 * Recalculate member points from actual habit completion state.
 * Fixes inconsistencies (e.g. points not revoked on uncheck, stale data).
 * @param {string} uid - User ID
 * @param {string} groupId - Group ID
 * @returns {Promise<number>} - The corrected points total
 */
export async function recalculateGroupMemberPoints(uid, groupId) {
  if (!uid || !groupId) return 0;
  const memberRef = doc(db, "groups", groupId, "members", uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) return 0;

  const habitsRef = collection(db, "users", uid, "habits");
  const habitsSnap = await getDocs(habitsRef);
  const groupChallengeHabits = habitsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((h) => h.source === "groupChallenge" && h.groupId === groupId);

  if (groupChallengeHabits.length === 0) {
    await setDoc(memberRef, { points: 0 }, { merge: true });
    return 0;
  }

  const checkinsRef = collection(db, "users", uid, "checkins");
  const checkinsSnap = await getDocs(checkinsRef);
  const datesFromCheckins = new Map();
  checkinsSnap.docs.forEach((d) => {
    const data = d.data();
    const completed = Array.isArray(data?.habitsCompleted) ? data.habitsCompleted : [];
    completed.forEach((habitId) => {
      if (!datesFromCheckins.has(habitId)) datesFromCheckins.set(habitId, new Set());
      datesFromCheckins.get(habitId).add(d.id);
    });
  });

  let totalPoints = 0;
  for (const habit of groupChallengeHabits) {
    let completed = habit.completedDates || [];
    const fromCheckins = datesFromCheckins.get(habit.id);
    if (fromCheckins && fromCheckins.size > 0) {
      const merged = new Set([...completed, ...fromCheckins]);
      completed = [...merged];
    }
    const awarded = habit.groupChallengeAwardedDates || [];
    const needsSync = awarded.length !== completed.length || completed.some((d) => !awarded.includes(d));

    if (completed.length === 0) {
      if (awarded.length > 0) {
        const habitRef = doc(db, "users", uid, "habits", habit.id);
        await updateDoc(habitRef, { groupChallengeAwardedDates: [] });
      }
      continue;
    }

    const challengeRef = doc(db, "groups", groupId, "challenges", habit.challengeId);
    const challengeSnap = await getDoc(challengeRef);
    if (!challengeSnap.exists()) continue;
    const challengeData = challengeSnap.data();
    const habitDef = (challengeData.habits || []).find(
      (h) => h.habitId === (habit.habitId || habit.groupChallengeHabitId)
    );
    if (!habitDef || typeof habitDef.points !== "number") continue;

    // Part 7: Only count completions within challenge startDate/endDate
    const datesInRange = completed.filter((d) => isDateWithinChallengeRange(challengeData, d));
    totalPoints += datesInRange.length * habitDef.points;

    if (needsSync) {
      const habitRef = doc(db, "users", uid, "habits", habit.id);
      await updateDoc(habitRef, { groupChallengeAwardedDates: datesInRange });
    }
  }

  await setDoc(memberRef, { points: totalPoints }, { merge: true });
  return totalPoints;
}

/**
 * Recalculate points for ALL members in a group (e.g. after challenge dates change).
 * @param {string} groupId - Group ID
 */
export async function recalculateAllMembersInGroup(groupId) {
  if (!groupId) return;
  const membersRef = collection(db, "groups", groupId, "members");
  const membersSnap = await getDocs(membersRef);
  for (const d of membersSnap.docs) {
    await recalculateGroupMemberPoints(d.id, groupId);
  }
}

