/**
 * Global infection counter — Firestore helpers.
 *
 * Document path: ratzilla/infectionStats
 * Increment uses atomic FieldValue.increment(1) to avoid race conditions.
 * Image generation never depends on these calls succeeding.
 */
import {
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "ratzilla";
const DOC_ID = "infectionStats";

export interface InfectionStats {
  count: number;
  target: number;
  lastUpdated: Date | null;
}

export const DEFAULT_INFECTION_STATS: InfectionStats = {
  count: 0,
  target: 1000,
  lastUpdated: null,
};

function infectionStatsRef() {
  return doc(db, COLLECTION, DOC_ID);
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInfectionStats(
  data: Record<string, unknown> | undefined,
): InfectionStats {
  const lastUpdatedRaw = data?.lastUpdated as { toDate?: () => Date } | undefined;
  return {
    count: toNumber(data?.count, 0),
    target: toNumber(data?.target, 1000),
    lastUpdated: lastUpdatedRaw?.toDate?.() ?? null,
  };
}

export function infectionProgressPercent(stats: InfectionStats): number {
  if (stats.target <= 0) return 0;
  return Math.min(100, (stats.count / stats.target) * 100);
}

export function isOutbreakComplete(stats: InfectionStats): boolean {
  return stats.target > 0 && stats.count >= stats.target;
}

/**
 * Realtime subscription — all open pages stay in sync.
 */
export function subscribeInfectionStats(
  onData: (stats: InfectionStats) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    infectionStatsRef(),
    (snapshot) => {
      if (snapshot.exists()) {
        onData(parseInfectionStats(snapshot.data()));
        return;
      }
      onData(DEFAULT_INFECTION_STATS);
    },
    (error) => {
      onError(error instanceof Error ? error : new Error(String(error)));
    },
  );
}

/**
 * Called only after a user successfully generates an infected image.
 * Uses atomic increment — never overwrites the full document.
 */
export async function incrementInfectionCount(): Promise<void> {
  const ref = infectionStatsRef();
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, {
      count: 1,
      target: DEFAULT_INFECTION_STATS.target,
      lastUpdated: serverTimestamp(),
    });
    return;
  }

  await updateDoc(ref, {
    count: increment(1),
    lastUpdated: serverTimestamp(),
  });
}

/**
 * Admin utility — not exposed in public UI.
 * Resets count and/or target for outbreak management.
 */
export async function resetInfectionCounter(options?: {
  count?: number;
  target?: number;
}): Promise<void> {
  await setDoc(
    infectionStatsRef(),
    {
      count: options?.count ?? 0,
      target: options?.target ?? DEFAULT_INFECTION_STATS.target,
      lastUpdated: serverTimestamp(),
    },
    { merge: true },
  );
}
