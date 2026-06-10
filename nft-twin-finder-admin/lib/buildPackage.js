import { parseMetadataRecords } from "./metadataParser.js";
import { buildSimilarityIndex } from "./similarityEngine.js";

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * @param {object} options
 * @param {unknown[]} options.items
 * @param {string} options.name
 * @param {string} options.slug
 * @param {Record<string, number>} options.weights
 * @param {object} [options.optional]
 */
export function buildCollectionPackage({
  items,
  name,
  slug,
  weights,
  optional = {},
}) {
  const { metadata, images, tokenIds } = parseMetadataRecords(items, {
    metadataBaseUrl: optional.metadataBaseUrl || "",
    imageUrlTemplate: optional.imageUrlTemplate || "",
  });

  if (!tokenIds.length) {
    throw new Error("No valid tokens found in uploaded metadata.");
  }

  const missingImages = tokenIds.filter((id) => !images[id]).length;
  const similarity = buildSimilarityIndex(metadata, weights, 5);

  const resolvedSlug = slug.trim() || slugify(name) || "collection";
  const collection = {
    name: name.trim() || resolvedSlug,
    slug: resolvedSlug,
    supply: optional.supply || tokenIds.length,
    traitWeights: weights,
  };

  if (optional.contract) collection.contract = optional.contract;
  if (optional.network) collection.network = optional.network;

  return {
    collection,
    metadata,
    images,
    similarity,
    tokenIds,
    missingImages,
  };
}
