/**
 * Collection-specific trait key overrides.
 * Applied before global TRAIT_ALIASES in normalizeTraits().
 *
 * Space Riders metadata uses:
 * - Body  → outfit (e.g. GM Hoodie)
 * - Head  → head / skin type (e.g. White, S3R0 Head)
 * - Space Shine → accessory glow
 */
export const COLLECTION_TRAIT_ALIASES = {
  "space-riders": {
    body: "Clothing",
    head: "Skin",
    "space shine": "Accessories",
  },
};

/**
 * @param {string} [slug]
 */
export function traitAliasesForCollection(slug) {
  if (!slug) return null;
  return COLLECTION_TRAIT_ALIASES[slug] || null;
}
