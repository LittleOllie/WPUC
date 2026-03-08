/**
 * Seed the Firestore challenges collection with built-in challenge definitions.
 * Run from browser console when logged in: import('./js/seed-challenges.js').then(m => m.seedChallenges())
 */
import { collection, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { CHALLENGE_DEFINITIONS } from "./challenge-definitions.js";

export async function seedChallenges() {
  console.log("[Seed] Seeding challenges collection...");
  for (const c of CHALLENGE_DEFINITIONS) {
    const ref = doc(db, "challenges", c.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      console.log("[Seed] Challenge already exists:", c.id);
      continue;
    }
    await setDoc(ref, {
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      habitName: c.habitName,
      durationDays: c.durationDays,
    });
    console.log("[Seed] Created challenge:", c.name);
  }
  console.log("[Seed] Done.");
}
