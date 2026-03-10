/**
 * Habit Library: predefined habits users can add with one click.
 * Library habits are created in Firestore with the same structure as custom habits.
 * habitId is a stable identifier used for group challenges and duplicate prevention.
 */
export const HABIT_LIBRARY = [
  { habitId: "drink-water", name: "Drink Water", icon: "💧" },
  { habitId: "exercise", name: "Exercise", icon: "🏃" },
  { habitId: "walk", name: "Walk", icon: "🚶" },
  { habitId: "stretch", name: "Stretch", icon: "🤸" },
  { habitId: "read", name: "Read", icon: "📚" },
  { habitId: "meditate", name: "Meditate", icon: "🧘" },
  { habitId: "journal", name: "Journal", icon: "✍️" },
  { habitId: "sleep-8-hours", name: "Sleep 8 Hours", icon: "😴" },
  { habitId: "cold-shower", name: "Cold Shower", icon: "🚿" },
  { habitId: "post-progress", name: "Post Progress", icon: "🐦" },
];
