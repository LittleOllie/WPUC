import { db } from "../firebase-init.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function boardPath(difficulty) {
  return `leaderboards/slider_${difficulty}/entries`;
}

export async function submitScore(name, difficulty, timeSeconds, moves) {
  await addDoc(collection(db, boardPath(difficulty)), {
    playerName: name,
    difficulty: difficulty,
    timeSeconds: timeSeconds,
    moves: moves,
    createdAt: Date.now()
  });
}

export async function getLeaderboard(difficulty) {
  const q = query(
    collection(db, boardPath(difficulty)),
    orderBy("timeSeconds", "asc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  list.sort((a, b) => {
    if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
    return (a.moves ?? 0) - (b.moves ?? 0);
  });
  return list.slice(0, 20);
}
