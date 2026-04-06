import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";

const COLLECTION_NAME = "leaderboard";

/** One row for the leaderboard UI — plain data, safe for React state. */
export type LeaderboardEntry = {
  id: string;
  handle: string;
  score: number;
  character: string;
  scene: string;
  createdAt: Date | null;
};

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/**
 * Upserts a leaderboard row by `handle`.
 * Creates a new document if none exists; otherwise updates only when `score` is higher than stored.
 */
export async function submitScore(
  handle: string,
  score: number,
  character: string,
  scene: string
): Promise<void> {
  const db = getFirestoreDb();
  const colRef = collection(db, COLLECTION_NAME);
  const q = query(colRef, where("handle", "==", handle), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) {
    await addDoc(colRef, {
      handle,
      score,
      character,
      scene,
      createdAt: serverTimestamp(),
    });
    return;
  }

  const docSnap = snap.docs[0]!;
  const prev = (docSnap.data() as { score?: number }).score;
  const prevScore = typeof prev === "number" ? prev : 0;
  if (score > prevScore) {
    await updateDoc(docSnap.ref, {
      score,
      character,
      scene,
    });
  }
}

/**
 * Returns the top 25 scores, highest first.
 */
export async function getTopScores(): Promise<LeaderboardEntry[]> {
  const db = getFirestoreDb();
  const q = query(collection(db, COLLECTION_NAME), orderBy("score", "desc"), limit(25));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as {
      handle?: string;
      score?: number;
      character?: string;
      scene?: string;
      createdAt?: unknown;
    };
    return {
      id: d.id,
      handle: typeof data.handle === "string" ? data.handle : "",
      score: typeof data.score === "number" ? data.score : 0,
      character: typeof data.character === "string" ? data.character : "",
      scene: typeof data.scene === "string" ? data.scene : "",
      createdAt: toDate(data.createdAt),
    };
  });
}
