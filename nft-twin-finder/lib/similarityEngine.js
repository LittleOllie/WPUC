import { TRAIT_CATEGORIES } from "./traitCategories.js";
import { compareTraits, matchSummary, traitBreakdown } from "./traitNormalizer.js";

/** Hidden ranking boost for pairs with many matching visible traits (not shown in UI). */
export const TRAIT_DENSITY_BONUS_MAX = 5;
export const DEFAULT_TOP_N = 5;

/**
 * Optional post-scoring adjusters (visual similarity, palette matching, rarity, AI, etc.).
 * Plug in new adjusters here without changing core comparison logic.
 * @type {RankAdjuster[]}
 */
export const RANK_ADJUSTERS = [];

/**
 * @typedef {object} SimilarityContext
 * @property {Record<string, string>} sourceTraits
 * @property {Record<string, string>} targetTraits
 * @property {Record<string, number>} weights
 * @property {number} weightedScore
 * @property {number} matchCount
 * @property {number} earned
 * @property {number} possible
 */

/**
 * @typedef {object} RankAdjuster
 * @property {string} id
 * @property {(score: number, context: SimilarityContext) => number} adjust
 */

/**
 * @param {Record<string, string>} sourceTraits
 * @param {Record<string, string>} targetTraits
 * @param {Record<string, number>} weights
 */
export function countTraitMatches(sourceTraits, targetTraits, weights) {
  let matchCount = 0;

  for (const category of TRAIT_CATEGORIES) {
    if (!(weights[category] ?? 0)) continue;
    const a = sourceTraits[category];
    const b = targetTraits[category];
    if (!a && !b) continue;
    if (a && b && a === b) matchCount += 1;
  }

  return matchCount;
}

/**
 * @param {number} matchCount
 */
export function computeTraitDensityBonus(matchCount) {
  if (matchCount < 2) return 0;
  const perMatch = TRAIT_DENSITY_BONUS_MAX / TRAIT_CATEGORIES.length;
  return Math.min(matchCount * perMatch, TRAIT_DENSITY_BONUS_MAX);
}

/**
 * Core pair scorer — weighted traits + hidden density bonus + optional future adjusters.
 * @param {Record<string, string>} sourceTraits
 * @param {Record<string, string>} targetTraits
 * @param {Record<string, number>} weights
 * @param {RankAdjuster[]} [rankAdjusters]
 */
export function scoreSimilarity(
  sourceTraits,
  targetTraits,
  weights,
  rankAdjusters = RANK_ADJUSTERS,
) {
  const { score: weightedScore, earned, possible } = compareTraits(
    sourceTraits,
    targetTraits,
    weights,
  );
  const matchCount = countTraitMatches(sourceTraits, targetTraits, weights);
  let score = weightedScore + computeTraitDensityBonus(matchCount);

  const context = {
    sourceTraits,
    targetTraits,
    weights,
    weightedScore,
    matchCount,
    earned,
    possible,
  };

  for (const adjuster of rankAdjusters) {
    score = adjuster.adjust(score, context);
  }

  return {
    score: Math.min(100, Math.round(score * 10) / 10),
    weightedScore,
    matchCount,
    earned,
    possible,
  };
}

/**
 * Build top-N similarity index for every token.
 * @param {Record<string, { traits: Record<string, string> }>} metadata
 * @param {Record<string, number>} weights
 * @param {number} [topN]
 * @param {{ rankAdjusters?: RankAdjuster[], onProgress?: (done: number, total: number) => void }} [options]
 */
export function buildSimilarityIndex(metadata, weights, topN = DEFAULT_TOP_N, options = {}) {
  const ids = Object.keys(metadata).sort((a, b) => Number(a) - Number(b));
  const rankAdjusters = options.rankAdjusters ?? RANK_ADJUSTERS;
  /** @type {Record<string, Array<{ id: string, score: number, summary: string, breakdown: Array<{ label: string, match: boolean }> }>>} */
  const similarity = {};

  for (let i = 0; i < ids.length; i += 1) {
    const sourceId = ids[i];
    const sourceTraits = metadata[sourceId]?.traits || {};
    const ranked = [];

    for (const targetId of ids) {
      if (targetId === sourceId) continue;

      const targetTraits = metadata[targetId]?.traits || {};
      const { score } = scoreSimilarity(sourceTraits, targetTraits, weights, rankAdjusters);

      ranked.push({
        id: targetId,
        score,
        summary: matchSummary(sourceTraits, targetTraits, weights),
        breakdown: traitBreakdown(sourceTraits, targetTraits, weights).map((row) => ({
          label: row.label,
          match: row.match,
        })),
      });
    }

    ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, undefined, { numeric: true }));
    similarity[sourceId] = ranked.slice(0, topN);

    options.onProgress?.(i + 1, ids.length);
  }

  return similarity;
}

/**
 * Async variant that yields to the event loop for large collections in the browser.
 * @param {Record<string, { traits: Record<string, string> }>} metadata
 * @param {Record<string, number>} weights
 * @param {number} [topN]
 * @param {{ rankAdjusters?: RankAdjuster[], onProgress?: (done: number, total: number) => void, yieldEvery?: number }} [options]
 */
export async function buildSimilarityIndexAsync(
  metadata,
  weights,
  topN = DEFAULT_TOP_N,
  options = {},
) {
  const ids = Object.keys(metadata).sort((a, b) => Number(a) - Number(b));
  const rankAdjusters = options.rankAdjusters ?? RANK_ADJUSTERS;
  const yieldEvery = options.yieldEvery ?? 25;
  /** @type {Record<string, Array<{ id: string, score: number, summary: string, breakdown: Array<{ label: string, match: boolean }> }>>} */
  const similarity = {};

  for (let i = 0; i < ids.length; i += 1) {
    const sourceId = ids[i];
    const sourceTraits = metadata[sourceId]?.traits || {};
    const ranked = [];

    for (const targetId of ids) {
      if (targetId === sourceId) continue;

      const targetTraits = metadata[targetId]?.traits || {};
      const { score } = scoreSimilarity(sourceTraits, targetTraits, weights, rankAdjusters);

      ranked.push({
        id: targetId,
        score,
        summary: matchSummary(sourceTraits, targetTraits, weights),
        breakdown: traitBreakdown(sourceTraits, targetTraits, weights).map((row) => ({
          label: row.label,
          match: row.match,
        })),
      });
    }

    ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, undefined, { numeric: true }));
    similarity[sourceId] = ranked.slice(0, topN);

    if (i % yieldEvery === 0 || i === ids.length - 1) {
      options.onProgress?.(i + 1, ids.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return similarity;
}
