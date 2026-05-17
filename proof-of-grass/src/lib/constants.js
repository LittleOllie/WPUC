export const STORAGE_KEY = "proof-of-grass-v1";

export const PROGRESSION_THRESHOLDS_MS = [
  { level: 0, label: "Fresh patch", flowers: 0, mushrooms: 0 },
  { level: 1, label: "Sprouting", flowers: 2, mushrooms: 0, minMs: 2 * 60 * 1000 },
  { level: 2, label: "Blooming", flowers: 5, mushrooms: 1, minMs: 8 * 60 * 1000 },
  { level: 3, label: "Thriving", flowers: 8, mushrooms: 2, minMs: 20 * 60 * 1000 },
  { level: 4, label: "Sanctuary", flowers: 12, mushrooms: 3, minMs: 45 * 60 * 1000 },
  { level: 5, label: "Legendary lawn", flowers: 16, mushrooms: 4, minMs: 90 * 60 * 1000 },
];

export const WEATHER_CYCLE_MS = 90_000;

export const EVENT_MIN_GAP_MS = 35_000;
export const EVENT_MAX_GAP_MS = 95_000;
