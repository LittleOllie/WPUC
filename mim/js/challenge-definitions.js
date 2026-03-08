/**
 * Challenge definitions.
 * Challenges are goal-based activities. When started, the associated habit
 * is added to the user's habits list. Progress is tracked per challenge.
 * Can be overridden by Firestore challenges collection.
 */

/** @typedef {{ id: string; name: string; description: string; icon: string; habitName: string; durationDays: number }} ChallengeDef */

/** Built-in challenge definitions. Can be overridden by Firestore challenges collection. */
export const CHALLENGE_DEFINITIONS = [
  {
    id: "become-a-fish",
    name: "Become a Fish",
    description: "Drink 2L water every day for 7 days",
    icon: "🐟",
    habitName: "Drink 2L Water",
    durationDays: 7,
  },
  {
    id: "week-of-reading",
    name: "Week of Reading",
    description: "Read for at least 20 minutes every day for 7 days",
    icon: "📚",
    habitName: "Read 20 Minutes",
    durationDays: 7,
  },
  {
    id: "daily-meditation",
    name: "Daily Meditation",
    description: "Meditate for 10 minutes every day for 7 days",
    icon: "🧘",
    habitName: "Meditate 10 Minutes",
    durationDays: 7,
  },
  {
    id: "hydration-hero",
    name: "Hydration Hero",
    description: "Drink water every day for 14 days",
    icon: "💧",
    habitName: "Drink Water Daily",
    durationDays: 14,
  },
];
