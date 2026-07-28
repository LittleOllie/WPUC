const STORAGE_KEY = "blackwater-containment-v1";

export interface ContainmentPersistedData {
  version: 1;
  tutorialComplete: boolean;
  muted: boolean;
  reducedMotion: boolean;
  screenShake: boolean;
  alarmIntensity: number;
  autoPauseOnHide: boolean;
  bestScore: number;
  bestTimeMs: number;
  bestScoreDate: string | null;
  bestSeed: number | null;
  lastSeed: number | null;
}

const DEFAULTS: ContainmentPersistedData = {
  version: 1,
  tutorialComplete: false,
  muted: true,
  reducedMotion: false,
  screenShake: true,
  alarmIntensity: 0.7,
  autoPauseOnHide: true,
  bestScore: 0,
  bestTimeMs: 0,
  bestScoreDate: null,
  bestSeed: null,
  lastSeed: null,
};

export function loadPersistence(): ContainmentPersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ContainmentPersistedData>;
    return { ...DEFAULTS, ...parsed, version: 1 };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePersistence(data: Partial<ContainmentPersistedData>): void {
  try {
    const current = loadPersistence();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...current, ...data, version: 1 }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function recordBestRun(
  score: number,
  timeMs: number,
  seed: number,
): ContainmentPersistedData {
  const current = loadPersistence();
  const updated = { ...current, lastSeed: seed };

  if (score > current.bestScore || timeMs > current.bestTimeMs) {
    updated.bestScore = Math.max(score, current.bestScore);
    updated.bestTimeMs = Math.max(timeMs, current.bestTimeMs);
    updated.bestScoreDate = new Date().toISOString().slice(0, 10);
    updated.bestSeed = seed;
  }

  savePersistence(updated);
  return updated;
}
