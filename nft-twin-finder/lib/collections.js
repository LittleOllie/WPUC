const COLLECTIONS_ROOT = new URL("../collections/", import.meta.url);
const SHARD_SIZE = 500;

/** @type {Map<string, Record<string, unknown>>} */
const fileCache = new Map();

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

function shardIndex(tokenId) {
  const n = Number(tokenId);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor((n - 1) / SHARD_SIZE) + 1;
}

function shardFilename(shard) {
  return `shard-${String(shard).padStart(4, "0")}.json`;
}

/**
 * @param {string} cacheKey
 * @param {URL} url
 */
async function fetchJsonCached(cacheKey, url) {
  if (fileCache.has(cacheKey)) return fileCache.get(cacheKey);

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  fileCache.set(cacheKey, data);
  return data;
}

/**
 * @param {string} slug
 * @param {"metadata"|"images"|"similarity"} file
 * @param {number} shard
 */
async function loadShard(slug, file, shard) {
  const cacheKey = `${slug}/${file}/${shard}`;
  return fetchJsonCached(
    cacheKey,
    new URL(`${slug}/${file}/${shardFilename(shard)}`, COLLECTIONS_ROOT),
  );
}

/**
 * @param {string} slug
 * @param {"metadata"|"images"|"similarity"} file
 */
async function loadMonolith(slug, file) {
  const cacheKey = `${slug}/${file}@mono`;
  return fetchJsonCached(cacheKey, new URL(`${slug}/${file}.json`, COLLECTIONS_ROOT));
}

/**
 * Fetch a slice of keyed JSON (metadata, images, or similarity).
 * Loads shard files when available, otherwise falls back to the monolithic file.
 * @param {string} slug
 * @param {"metadata"|"images"|"similarity"} file
 * @param {string[]} tokenIds
 */
export async function loadTokenSlice(slug, file, tokenIds) {
  const slice = {};
  const shards = [...new Set(tokenIds.map(shardIndex))];
  const shardData = await Promise.all(shards.map((shard) => loadShard(slug, file, shard)));

  if (shardData.every(Boolean)) {
    const shardMap = new Map(shards.map((shard, index) => [shard, shardData[index]]));
    for (const id of tokenIds) {
      const key = String(id);
      const entry = shardMap.get(shardIndex(key))?.[key];
      if (entry != null) slice[key] = entry;
    }
    return slice;
  }

  const full = await loadMonolith(slug, file);
  if (!full) throw new Error(`${file.toUpperCase()}_MISSING`);

  for (const id of tokenIds) {
    const key = String(id);
    if (full[key] != null) slice[key] = full[key];
  }
  return slice;
}

/**
 * Load an entire keyed JSON file (metadata, images, or similarity).
 * Merges shard files when the monolith is absent.
 * @param {string} slug
 * @param {"metadata"|"images"|"similarity"} file
 */
export async function loadFullCollectionFile(slug, file) {
  const mono = await loadMonolith(slug, file);
  if (mono) return mono;

  /** @type {Record<string, unknown>} */
  const merged = {};
  for (let shard = 1; shard <= 999; shard += 1) {
    const data = await loadShard(slug, file, shard);
    if (!data) {
      if (shard === 1) break;
      continue;
    }
    Object.assign(merged, data);
  }

  if (Object.keys(merged).length) return merged;
  throw new Error(`${file.toUpperCase()}_MISSING`);
}
