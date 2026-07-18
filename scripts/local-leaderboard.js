/**
 * Device-local score storage for Games Lab titles (localStorage).
 */

export function readLocalScores(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function writeLocalScores(storageKey, scores) {
  localStorage.setItem(storageKey, JSON.stringify(scores));
}

/**
 * @param {string} storageKey
 * @param {object} entry
 * @param {{ max?: number, compare?: (a: b) => number, dedupeRunId?: boolean }} [opts]
 */
export function addLocalScore(storageKey, entry, opts) {
  const max = opts && opts.max ? opts.max : 10;
  const compare =
    opts && typeof opts.compare === "function"
      ? opts.compare
      : (a, b) => (b.score || 0) - (a.score || 0);

  const list = readLocalScores(storageKey);
  if (opts && opts.dedupeRunId && entry.runId) {
    if (list.some((row) => row.runId === entry.runId)) {
      return { ok: false, reason: "duplicate_run", rows: list };
    }
  }

  list.push({
    ...entry,
    createdAt: entry.createdAt || Date.now(),
  });
  list.sort(compare);
  const trimmed = list.slice(0, max);
  writeLocalScores(storageKey, trimmed);
  return { ok: true, rows: trimmed };
}

export function rankLocalScores(scores, compare) {
  const sorted = scores.slice().sort(compare);
  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
