export { TRAIT_CATEGORIES } from "./traitCategories.js";
import { TRAIT_CATEGORIES } from "./traitCategories.js";
import { DEFAULT_WEIGHTS } from "./weightProfiles.js";

export { DEFAULT_WEIGHTS } from "./weightProfiles.js";

/** Map common metadata keys → canonical category names. */
const TRAIT_ALIASES = {
  skin: "Skin",
  fur: "Skin",
  body: "Clothing",
  bones: "Skin",
  "body type": "Skin",
  type: "Skin",
  base: "Skin",
  eyes: "Eyes",
  eye: "Eyes",
  "eye color": "Eyes",
  "glasses and eyes": "Eyes",
  "eyes-glasses": "Eyes",
  mouth: "Mouth",
  lips: "Mouth",
  face: "Mouth",
  nose: "Accessories",
  clothing: "Clothing",
  clothes: "Clothing",
  outfit: "Clothing",
  shirt: "Clothing",
  top: "Clothing",
  drip: "Accessories",
  hair: "Hat",
  hat: "Hat",
  "hat and hair": "Hat",
  head: "Hat",
  helmet: "Hat",
  cap: "Hat",
  horn: "Hat",
  mask: "Hat",
  accessories: "Accessories",
  accessory: "Accessories",
  "back accessories": "Accessories",
  "right-hand": "Accessories",
  "left-hand": "Accessories",
  weapon: "Accessories",
  "space shine": "Accessories",
  glasses: "Accessories",
  eyewear: "Accessories",
  earring: "Accessories",
  earrings: "Accessories",
  background: "Background",
  backgrounds: "Background",
  bg: "Background",
  skeleton: "Skin",
  zombie: "Skin",
  "skeleton special": "Accessories",
  tats: "Accessories",
  headwear: "Hat",
  hats: "Hat",
  "hair-hats": "Hat",
  heads: "Skin",
  faces: "Eyes",
  antenna: "Accessories",
};

function normalizeKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Convert raw NFT metadata into canonical trait map.
 * @param {unknown} raw
 * @returns {Record<string, string>}
 */
export function normalizeTraits(raw) {
  const traits = {};

  if (!raw || typeof raw !== "object") return traits;

  if (raw.traits && typeof raw.traits === "object" && !Array.isArray(raw.traits)) {
    for (const [key, value] of Object.entries(raw.traits)) {
      const canon = TRAIT_ALIASES[normalizeKey(key)] || key;
      traits[canon] = String(value ?? "").trim();
    }
    return traits;
  }

  const attrs = raw.attributes || raw.properties?.attributes;
  if (Array.isArray(attrs)) {
    for (const attr of attrs) {
      if (!attr || typeof attr !== "object") continue;
      const type = attr.trait_type ?? attr.traitType ?? attr.name;
      const value = attr.value;
      if (type == null || value == null) continue;
      const canon = TRAIT_ALIASES[normalizeKey(type)] || String(type).trim();
      traits[canon] = String(value).trim();
    }
  }

  return traits;
}

/**
 * @param {Record<string, string>} traitsA
 * @param {Record<string, string>} traitsB
 * @param {Record<string, number>} [weights]
 */
export function compareTraits(traitsA, traitsB, weights = DEFAULT_WEIGHTS) {
  let earned = 0;
  let possible = 0;

  for (const category of TRAIT_CATEGORIES) {
    const weight = weights[category] ?? 0;
    if (!weight) continue;
    const a = traitsA[category];
    const b = traitsB[category];
    if (!a && !b) continue;
    possible += weight;
    if (a && b && a === b) earned += weight;
  }

  const score = possible > 0 ? (earned / possible) * 100 : 0;
  return { score, earned, possible };
}

/**
 * Human-readable trait breakdown for "Show Why".
 * @param {Record<string, string>} source
 * @param {Record<string, string>} twin
 * @param {Record<string, number>} [weights]
 */
export function traitBreakdown(source, twin, weights = DEFAULT_WEIGHTS) {
  const rows = [];

  for (const category of TRAIT_CATEGORIES) {
    const weight = weights[category] ?? 0;
    if (!weight) continue;
    const a = source[category];
    const b = twin[category];
    if (!a && !b) continue;

    const match = Boolean(a && b && a === b);
    rows.push({
      category,
      match,
      sourceValue: a || "—",
      twinValue: b || "—",
      label: match
        ? `Same ${category}`
        : `Different ${category}`,
    });
  }

  return rows;
}

/** Short summary for twin cards. */
export function matchSummary(source, twin, weights = DEFAULT_WEIGHTS) {
  return summaryFromBreakdown(traitBreakdown(source, twin, weights));
}

/** Build summary text from a precomputed breakdown list. */
export function summaryFromBreakdown(breakdown) {
  const same = breakdown
    .filter((row) => row.match)
    .map((row) => {
      if (row.category) return row.category;
      const label = String(row.label || "");
      return label.startsWith("Same ") ? label.slice(5) : label;
    })
    .filter(Boolean);

  if (same.length > 0) {
    return `Same ${same.join(", ")}`;
  }
  return "Close trait overlap";
}
