import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseFirestore } from "./firebase";
import { normalizeHandleInput } from "./xhandle";

export const LEADERBOARD_COLLECTION = "leaderboard";

const SCORE_MIN = 1;
const SCORE_MAX = 10_000_000;
const META_MAX_LEN = 64;

export type LeaderboardEntry = {
  id: string;
  handle: string;
  score: number;
  character: string;
  scene: string;
  createdAt: Date | null;
};

function clampMeta(s: string): string {
  const t = s.trim();
  return t.length <= META_MAX_LEN ? t : t.slice(0, META_MAX_LEN);
}

function assertValidScore(score: number): number {
  if (!Number.isFinite(score)) {
    throw new Error("leaderboard: score must be finite");
  }
  const n = Math.round(score);
  if (n < SCORE_MIN || n > SCORE_MAX) {
    throw new Error(`leaderboard: score must be between ${SCORE_MIN} and ${SCORE_MAX}`);
  }
  return n;
}

/**
 * Upserts a row keyed by normalized handle; only increases score.
 */
export async function submitScore(
  handle: string,
  score: number,
  character: string,
  scene: string
): Promise<void> {
  const h = normalizeHandleInput(handle);
  if (!h) {
    throw new Error("leaderboard: handle is empty after normalization");
  }
  const scoreInt = assertValidScore(score);
  const char = clampMeta(character);
  const sc = clampMeta(scene);

  const db = getFirebaseFirestore();
  const ref = doc(db, LEADERBOARD_COLLECTION, h);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, {
        handle: h,
        score: scoreInt,
        character: char,
        scene: sc,
        createdAt: serverTimestamp(),
      });
      return;
    }
    const prev = snap.data() as { score?: unknown };
    const prevScore = typeof prev.score === "number" ? prev.score : Number(prev.score);
    if (!Number.isFinite(prevScore) || scoreInt <= prevScore) {
      return;
    }
    tx.update(ref, {
      score: scoreInt,
      character: char,
      scene: sc,
    });
  });
}

function timestampToDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return null;
}

export async function getTopScores(): Promise<LeaderboardEntry[]> {
  const db = getFirebaseFirestore();
  const q = query(collection(db, LEADERBOARD_COLLECTION), orderBy("score", "desc"), limit(25));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as {
      handle?: string;
      score?: unknown;
      character?: string;
      scene?: string;
      createdAt?: unknown;
    };
    const score = typeof data.score === "number" ? data.score : Number(data.score);
    return {
      id: d.id,
      handle: typeof data.handle === "string" ? data.handle : d.id,
      score: Number.isFinite(score) ? score : 0,
      character: typeof data.character === "string" ? data.character : "",
      scene: typeof data.scene === "string" ? data.scene : "",
      createdAt: timestampToDate(data.createdAt),
    };
  });
}
