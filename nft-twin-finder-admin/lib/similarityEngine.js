import {
  DEFAULT_WEIGHTS,
  compareTraits,
  matchSummary,
  traitBreakdown,
} from "../../nft-twin-finder/lib/traitNormalizer.js";

/**
 * Build top-N similarity index for every token.
 * @param {Record<string, { traits: Record<string, string> }>} metadata
 * @param {Record<string, number>} weights
 * @param {number} topN
 */
export function buildSimilarityIndex(metadata, weights = DEFAULT_WEIGHTS, topN = 5) {
  const ids = Object.keys(metadata).sort((a, b) => Number(a) - Number(b));
  const similarity = {};

  for (const sourceId of ids) {
    const sourceTraits = metadata[sourceId]?.traits || {};
    const ranked = [];

    for (const targetId of ids) {
      if (targetId === sourceId) continue;
      const targetTraits = metadata[targetId]?.traits || {};
      const { score } = compareTraits(sourceTraits, targetTraits, weights);
      ranked.push({
        id: targetId,
        score: Math.round(score * 10) / 10,
        summary: matchSummary(sourceTraits, targetTraits, weights),
        breakdown: traitBreakdown(sourceTraits, targetTraits, weights).map((row) => ({
          label: row.label,
          match: row.match,
        })),
      });
    }

    ranked.sort((a, b) => b.score - a.score);
    similarity[sourceId] = ranked.slice(0, topN);
  }

  return similarity;
}
