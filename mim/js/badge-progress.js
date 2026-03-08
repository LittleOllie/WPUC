/**
 * Badge progress tracking. Updates users/{uid}/badgeProgress when habits are completed.
 * Call updateBadgeProgress(uid, habits, checkins) after habit completion to sync progress.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { BADGE_DEFINITIONS, computeBadgeProgress } from "./badge-definitions.js";

/** Get date string YYYY-MM-DD for N days ago. */
function getDateId(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

/**
 * Load checkin history for the last 400 days.
 * @param {string} uid
 * @returns {Promise<{ dateId: string; habitsCompleted: string[] }[]>}
 */
async function loadCheckinHistory(uid) {
  const checkinsRef = collection(db, "users", uid, "checkins");
  const snap = await getDocs(checkinsRef);
  const list = [];
  snap.forEach((d) => {
    const data = d.data();
    list.push({
      dateId: d.id,
      habitsCompleted: Array.isArray(data.habitsCompleted) ? data.habitsCompleted : [],
    });
  });
  return list.sort((a, b) => (b.dateId > a.dateId ? 1 : -1));
}

/**
 * Load habits for user.
 */
async function loadHabits(uid) {
  const habitsRef = collection(db, "users", uid, "habits");
  const snap = await getDocs(habitsRef);
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, name: d.data().name || "" }));
  return list;
}

/**
 * Update badge progress for user. Call after habit completion.
 * @param {string} uid
 * @returns {Promise<{ id: string; name: string; icon: string } | null>} Newly unlocked badge, if any
 */
export async function updateBadgeProgress(uid) {
  if (!uid) return null;

  const habits = await loadHabits(uid);
  const checkinHistory = await loadCheckinHistory(uid);
  let newlyUnlocked = null;

  for (const badge of BADGE_DEFINITIONS) {
    const { progress, total, unlocked } = computeBadgeProgress(badge, habits, checkinHistory);
    const progressRef = doc(db, "users", uid, "badgeProgress", badge.id);
    const existing = await getDoc(progressRef);
    const wasUnlocked = existing.exists() && existing.data().unlocked === true;

    await setDoc(progressRef, {
      progress,
      total,
      unlocked,
      badgeId: badge.id,
      badgeName: badge.name,
      badgeIcon: badge.icon,
      updatedAt: serverTimestamp(),
      ...(unlocked && !wasUnlocked ? { unlockedAt: serverTimestamp() } : {}),
    }, { merge: true });

    if (unlocked && !wasUnlocked) {
      newlyUnlocked = { id: badge.id, name: badge.name, icon: badge.icon, description: badge.description };
    }
  }

  return newlyUnlocked;
}

/**
 * Get current badge progress for user.
 * @param {string} uid
 * @returns {Promise<Map<string, { progress: number; total: number; unlocked: boolean }>>}
 */
export async function getBadgeProgress(uid) {
  if (!uid) return new Map();

  const habits = await loadHabits(uid);
  const checkinHistory = await loadCheckinHistory(uid);
  const map = new Map();

  for (const badge of BADGE_DEFINITIONS) {
    const result = computeBadgeProgress(badge, habits, checkinHistory);
    map.set(badge.id, result);
  }

  return map;
}
