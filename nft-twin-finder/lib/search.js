import {
  loadCollectionMeta,
  loadTokenSlice,
} from "./collections.js";
import { preferredImageUrl } from "./imageUrls.js";
import { matchSummary, traitBreakdown } from "./traitNormalizer.js";

/**
 * @typedef {{ id: string, score: number, summary?: string }} TwinMatch
 */

/**
 * Run a twin search using precomputed local data only.
 * @param {string} slug
 * @param {string|number} tokenId
 */
export async function findTwins(slug, tokenId) {
  const id = String(tokenId).trim().replace(/^#/, "");
  if (!/^\d+$/.test(id)) throw new Error("INVALID_TOKEN_ID");

  const [collection, similarityAll] = await Promise.all([
    loadCollectionMeta(slug),
    loadTokenSlice(slug, "similarity", [id]),
  ]);

  const matches = similarityAll[id];
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    throw new Error("NO_TWINS_FOUND");
  }

  const twinIds = matches.map((m) => String(m.id));
  const imageIds = [id, ...twinIds];
  const needsTwinMetadata = matches.some(
    (m) => !Array.isArray(m.breakdown) || !m.breakdown.length,
  );
  const metadataIds = needsTwinMetadata ? imageIds : [id];

  const [images, metadata] = await Promise.all([
    loadTokenSlice(slug, "images", imageIds),
    loadTokenSlice(slug, "metadata", metadataIds),
  ]);

  const weights = collection.traitWeights || undefined;
  const sourceTraits = metadata[id]?.traits || {};

  const twins = matches.map((match) => {
    const twinId = String(match.id);
    const twinTraits = metadata[twinId]?.traits || {};
    const breakdown =
      Array.isArray(match.breakdown) && match.breakdown.length
        ? match.breakdown
        : traitBreakdown(sourceTraits, twinTraits, weights);
    return {
      id: twinId,
      score: Number(match.score),
      summary: match.summary || matchSummary(sourceTraits, twinTraits, weights),
      image: preferredImageUrl(images[twinId] || ""),
      traits: twinTraits,
      breakdown,
    };
  });

  return {
    collection,
    token: {
      id,
      image: preferredImageUrl(images[id] || ""),
      traits: sourceTraits,
      name: metadata[id]?.name || `${collection.name} #${id}`,
    },
    twins,
  };
}
