import { TRAIT_CATEGORIES } from "./traitCategories.js";

/** @typedef {"default" | "custom"} WeightProfileKind */

export const WEIGHT_PROFILE_DEFAULT = "default";
export const WEIGHT_PROFILE_CUSTOM = "custom";

/** Default visual-similarity weights (total 100). */
export const DEFAULT_WEIGHTS = {
  Skin: 25,
  Type: 0,
  Eyes: 15,
  Mouth: 10,
  Clothing: 20,
  Hat: 15,
  Accessories: 10,
  Background: 5,
};

/** DropDed Gorgez — outfit-driven custom profile. */
export const DROP_DED_GORGEZ_WEIGHTS = {
  Skin: 7,
  Type: 0,
  Eyes: 8,
  Mouth: 0,
  Clothing: 40,
  Hat: 40,
  Accessories: 0,
  Background: 5,
};

const CUSTOM_PROFILE_PRESETS = {
  "dropded-gorgez": DROP_DED_GORGEZ_WEIGHTS,
};

/**
 * @param {Record<string, number>} weights
 */
export function sumWeights(weights) {
  return TRAIT_CATEGORIES.reduce((total, category) => total + (Number(weights[category]) || 0), 0);
}

/**
 * @param {Record<string, number>} weights
 * @param {{ tolerance?: number }} [options]
 */
export function validateWeights(weights, { tolerance = 0.01 } = {}) {
  const total = sumWeights(weights);
  const valid = Math.abs(total - 100) <= tolerance;
  return {
    valid,
    total: Math.round(total * 100) / 100,
    errors: valid ? [] : [`Weights must total 100% (currently ${total.toFixed(1)}%).`],
  };
}

/**
 * @param {Record<string, number>} weights
 */
export function normalizeWeightRecord(weights) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const category of TRAIT_CATEGORIES) {
    out[category] = Number(weights?.[category]) || 0;
  }
  return out;
}

/**
 * Resolve effective weights for a collection config object.
 * @param {{ slug?: string, weightProfile?: WeightProfileKind, traitWeights?: Record<string, number> }} collection
 */
export function resolveWeights(collection = {}) {
  const profile = collection.weightProfile || WEIGHT_PROFILE_DEFAULT;
  const slug = collection.slug || "";

  if (profile === WEIGHT_PROFILE_CUSTOM) {
    if (collection.traitWeights && Object.keys(collection.traitWeights).length) {
      return normalizeWeightRecord(collection.traitWeights);
    }
    if (CUSTOM_PROFILE_PRESETS[slug]) {
      return { ...CUSTOM_PROFILE_PRESETS[slug] };
    }
  }

  return { ...DEFAULT_WEIGHTS };
}

/**
 * @param {{ slug?: string, weightProfile?: WeightProfileKind, traitWeights?: Record<string, number> }} collection
 */
export function describeWeightProfile(collection = {}) {
  const profile = collection.weightProfile || WEIGHT_PROFILE_DEFAULT;
  if (profile === WEIGHT_PROFILE_CUSTOM) {
    return "Custom Profile";
  }
  return "Default Profile";
}

/**
 * @param {WeightProfileKind} profile
 * @param {string} [slug]
 */
export function weightsForProfile(profile, slug = "") {
  if (profile === WEIGHT_PROFILE_CUSTOM) {
    if (CUSTOM_PROFILE_PRESETS[slug]) {
      return { ...CUSTOM_PROFILE_PRESETS[slug] };
    }
    return { ...DEFAULT_WEIGHTS };
  }
  return { ...DEFAULT_WEIGHTS };
}
