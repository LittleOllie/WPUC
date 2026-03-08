/**
 * Badge definitions and progress computation.
 * Badges are matched to habits by keyword in habit name (case-insensitive).
 */

/** @typedef {{ id: string; name: string; description: string; icon: string; requirement: string; matchType: 'water'|'read'|'meditate'|'all'; days: number; consecutive: boolean }} BadgeDef */

/** Built-in badge definitions. Can be overridden by Firestore badges collection. */
export const BADGE_DEFINITIONS = [
  {
    id: "become-a-fish",
    name: "Become a Fish",
    description: "Drink 2L of water for 7 consecutive days",
    icon: "🐟",
    requirement: "7 consecutive days",
    matchType: "water",
    days: 7,
    consecutive: true,
  },
  {
    id: "daily-fire",
    name: "Daily Fire",
    description: "Complete all habits for 5 days straight",
    icon: "🔥",
    requirement: "5 consecutive days",
    matchType: "all",
    days: 5,
    consecutive: true,
  },
  {
    id: "ocean-mode",
    name: "Ocean Mode",
    description: "Drink water for 30 days",
    icon: "🌊",
    requirement: "30 days total",
    matchType: "water",
    days: 30,
    consecutive: false,
  },
  {
    id: "brain-builder",
    name: "Brain Builder",
    description: "Read for 10 days",
    icon: "📚",
    requirement: "10 days total",
    matchType: "read",
    days: 10,
    consecutive: false,
  },
  {
    id: "zen-master",
    name: "Zen Master",
    description: "Meditate for 7 days",
    icon: "🧘",
    requirement: "7 days total",
    matchType: "meditate",
    days: 7,
    consecutive: false,
  },
];

/** Check if habit matches badge type by name keywords. */
function habitMatchesType(habit, matchType) {
  const name = (habit?.name || "").toLowerCase();
  if (matchType === "all") return true;
  if (matchType === "water") return name.includes("water") || name.includes("drink");
  if (matchType === "read") return name.includes("read");
  if (matchType === "meditate") return name.includes("meditat");
  return false;
}

/** Get date string YYYY-MM-DD for N days ago (0 = today). */
function getDateId(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

/**
 * Compute badge progress from checkin history.
 * @param {BadgeDef} badge
 * @param {{ id: string; name: string }[]} habits
 * @param {{ dateId: string; habitsCompleted: string[]; allComplete?: boolean }[]} checkinHistory - sorted by date descending (newest first)
 * @returns {{ progress: number; total: number; unlocked: boolean }}
 */
export function computeBadgeProgress(badge, habits, checkinHistory) {
  const total = badge.days;
  const matchType = badge.matchType;
  const consecutive = badge.consecutive;

  /** For each dateId, was the requirement met? */
  function dayQualifies(dateId) {
    const rec = checkinHistory.find((c) => c.dateId === dateId);
    if (!rec) return false;
    const completed = rec.habitsCompleted || [];

    if (matchType === "all") {
      const totalHabits = habits.length;
      return totalHabits > 0 && completed.length === totalHabits;
    }

    const matchingHabits = habits.filter((h) => habitMatchesType(h, matchType));
    if (matchingHabits.length === 0) return false;
    const matchingIds = new Set(matchingHabits.map((h) => h.id));
    return completed.some((id) => matchingIds.has(id));
  }

  if (consecutive) {
    let streak = 0;
    let cursor = 0;
    while (cursor < 500) {
      const dateId = getDateId(cursor);
      if (dayQualifies(dateId)) {
        streak++;
        if (streak >= total) {
          return { progress: total, total, unlocked: true };
        }
      } else {
        streak = 0;
      }
      cursor++;
    }
    const finalStreak = streak;
    return { progress: finalStreak, total, unlocked: false };
  }

  let count = 0;
  for (let i = 0; i < 400; i++) {
    const dateId = getDateId(i);
    if (dayQualifies(dateId)) count++;
    if (count >= total) return { progress: total, total, unlocked: true };
  }
  return { progress: count, total, unlocked: false };
}
