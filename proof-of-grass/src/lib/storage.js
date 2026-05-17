import { PROGRESSION_THRESHOLDS_MS, STORAGE_KEY } from "./constants.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function defaultState() {
  const today = todayKey();
  return {
    version: 1,
    totalGrassMs: 0,
    todayKey: today,
    todayGrassMs: 0,
    streak: 0,
    lastVisit: today,
    dailyHistory: { [today]: 0 },
    progressionLevel: 0,
    settings: { muted: true, panelOpen: false },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrateState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

function migrateState(state) {
  const base = { ...defaultState(), ...state };
  const today = todayKey();

  if (base.todayKey !== today) {
    const yesterday = base.todayKey;
    const hadActivity = (base.todayGrassMs || 0) > 30_000;
    if (hadActivity && yesterday) {
      const prev = new Date(yesterday);
      const now = new Date(today);
      const diffDays = Math.round((now - prev) / 86_400_000);
      base.streak = diffDays === 1 ? (base.streak || 0) + 1 : 1;
    } else if (base.lastVisit !== today) {
      base.streak = 0;
    }
    base.todayKey = today;
    base.todayGrassMs = 0;
    base.dailyHistory = base.dailyHistory || {};
    base.dailyHistory[today] = 0;
  }

  base.lastVisit = today;
  base.settings = { muted: true, panelOpen: false, ...base.settings };
  base.dailyHistory = base.dailyHistory || {};
  if (base.dailyHistory[today] == null) base.dailyHistory[today] = base.todayGrassMs || 0;

  return base;
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function getProgressionLevel(totalMs) {
  let level = 0;
  for (const tier of PROGRESSION_THRESHOLDS_MS) {
    if (totalMs >= (tier.minMs ?? 0)) level = tier.level;
  }
  return level;
}

export { todayKey };
