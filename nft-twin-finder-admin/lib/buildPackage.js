import { parseMetadataRecords } from "./metadataParser.js";
import { buildSimilarityIndex } from "./similarityEngine.js";
import {
  DEFAULT_WEIGHTS,
  WEIGHT_PROFILE_CUSTOM,
  WEIGHT_PROFILE_DEFAULT,
  validateWeights,
} from "../../nft-twin-finder/lib/weightProfiles.js";

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
 * @param {Record<string, number>} [options.weights]
 * @param {"default"|"custom"} [options.weightProfile]
 * @param {object} [options.optional]
 */
export function buildCollectionPackage({
  items,
  name,
  slug,
  weights = { ...DEFAULT_WEIGHTS },
  weightProfile = WEIGHT_PROFILE_DEFAULT,
  optional = {},
}) {
  const { metadata, images, tokenIds } = parseMetadataRecords(items, {
    metadataBaseUrl: optional.metadataBaseUrl || "",
    imageUrlTemplate: optional.imageUrlTemplate || "",
  });

  if (!tokenIds.length) {
    throw new Error("No valid tokens found in uploaded metadata.");
  }

  const resolvedWeights =
    weightProfile === WEIGHT_PROFILE_CUSTOM ? { ...weights } : { ...DEFAULT_WEIGHTS };
  const weightCheck = validateWeights(resolvedWeights);
  if (weightProfile === WEIGHT_PROFILE_CUSTOM && !weightCheck.valid) {
    throw new Error(weightCheck.errors[0] || "Invalid trait weights.");
  }

  const missingImages = tokenIds.filter((id) => !images[id]).length;
  const similarity = buildSimilarityIndex(metadata, resolvedWeights, 5);

  const resolvedSlug = slug.trim() || slugify(name) || "collection";
  /** @type {Record<string, unknown>} */
  const collection = {
    name: name.trim() || resolvedSlug,
    slug: resolvedSlug,
    supply: optional.supply || tokenIds.length,
    weightProfile,
    similarityCalculatedAt: new Date().toISOString(),
  };

  if (weightProfile === WEIGHT_PROFILE_CUSTOM) {
    collection.traitWeights = resolvedWeights;
  }

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
