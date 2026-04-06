import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { normalizeHandleInput } from "./xhandle";

export const COLLECTION_NAME = "leaderboard";

const MAX_SCORE = 10_000_000;
const MAX_META_LEN = 64;

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

function clampMeta(s: string): string {
  return s.slice(0, MAX_META_LEN);
}

function assertValidScore(score: number): number {
  if (!Number.isFinite(score)) throw new Error("Invalid score");
  const n = Math.floor(score);
  if (n < 1 || n > MAX_SCORE) throw new Error("Invalid score");
  return n;
}

/**
 * Upserts a leaderboard row: document ID is the normalized handle.
 * Uses a transaction so concurrent updates cannot corrupt the row.
 */
export async function submitScore(handle: string, score: number, character: string, scene: string): Promise<void> {
  const h = normalizeHandleInput(handle);
  if (!h) throw new Error("Invalid handle");

  const n = assertValidScore(score);
  const ch = clampMeta(character);
  const sc = clampMeta(scene);

  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTION_NAME, h);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) {
      transaction.set(docRef, {
        handle: h,
        score: n,
        character: ch,
        scene: sc,
        createdAt: serverTimestamp(),
      });
      return;
    }
    const prev = snap.data() as { score?: unknown };
    const prevScore = typeof prev.score === "number" && Number.isFinite(prev.score) ? Math.floor(prev.score) : 0;
    if (n > prevScore) {
      transaction.update(docRef, {
        score: n,
        character: ch,
        scene: sc,
      });
    }
  });
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
