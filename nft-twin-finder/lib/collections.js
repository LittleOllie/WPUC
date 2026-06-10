const COLLECTIONS_ROOT = new URL("../collections/", import.meta.url);

/**
 * @typedef {{ slug: string, name: string, logo?: string }} CollectionIndexEntry
 */

/** @returns {Promise<CollectionIndexEntry[]>} */
export async function loadCollectionIndex() {
  const res = await fetch(new URL("index.json", COLLECTIONS_ROOT));
  if (!res.ok) throw new Error("COLLECTIONS_INDEX_MISSING");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("COLLECTIONS_INDEX_INVALID");
  return data;
}

/**
 * @param {string} slug
 */
export async function loadCollectionMeta(slug) {
  const res = await fetch(new URL(`${slug}/collection.json`, COLLECTIONS_ROOT));
  if (!res.ok) throw new Error("COLLECTION_NOT_FOUND");
  return res.json();
}

/**
 * Fetch a slice of keyed JSON (metadata, images, or similarity).
 * @param {string} slug
 * @param {"metadata"|"images"|"similarity"} file
 * @param {string[]} tokenIds
 */
export async function loadTokenSlice(slug, file, tokenIds) {
  const res = await fetch(new URL(`${slug}/${file}.json`, COLLECTIONS_ROOT));
  if (!res.ok) throw new Error(`${file.toUpperCase()}_MISSING`);

  const full = await res.json();
  const slice = {};
  for (const id of tokenIds) {
    const key = String(id);
    if (full[key] != null) slice[key] = full[key];
  }
  return slice;
}
