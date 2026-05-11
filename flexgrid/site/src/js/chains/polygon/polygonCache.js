/**
 * Polygon-only saved collections (wallet + contract bookmarks).
 * Isolated localStorage — does not touch flexgrid_saved_wallets_v1 or other keys.
 */

const STORAGE_KEY = "flexgrid_polygon_savedCollections_v1";
const MAX_RECORDS = 40;

/** @typedef {{ id: string, wallet: string, contract: string, chain: "polygon", collectionName: string, logo: string | null, savedAt: number, nickname?: string | null }} PolygonSavedCollection */

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** @returns {PolygonSavedCollection[]} */
export function readPolygonSavedCollections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = safeParse(raw);
    return arr
      .filter(
        (r) =>
          r &&
          typeof r === "object" &&
          r.chain === "polygon" &&
          typeof r.wallet === "string" &&
          typeof r.contract === "string" &&
          typeof r.id === "string"
      )
      .map((r) => ({
        id: String(r.id),
        wallet: String(r.wallet).trim().toLowerCase(),
        contract: String(r.contract).trim().toLowerCase(),
        chain: "polygon",
        collectionName: String(r.collectionName || "Collection").trim() || "Collection",
        logo: typeof r.logo === "string" && r.logo.trim() ? r.logo.trim() : null,
        savedAt: Number(r.savedAt) || 0,
        nickname: r.nickname != null ? String(r.nickname).trim() : "",
      }));
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECORDS)));
  } catch {
    /* quota / private mode */
  }
}

export function makePolygonSavedId(wallet, contract) {
  const w = String(wallet || "").trim().toLowerCase();
  const c = String(contract || "").trim().toLowerCase();
  return `${w}::${c}`;
}

/** @param {Omit<PolygonSavedCollection, "id" | "chain" | "savedAt"> & { id?: string }} rec */
export function upsertPolygonSavedCollection(rec) {
  const wallet = String(rec.wallet || "").trim().toLowerCase();
  const contract = String(rec.contract || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(wallet) || !/^0x[a-f0-9]{40}$/.test(contract)) return null;

  const id = rec.id && String(rec.id).trim() ? String(rec.id).trim() : makePolygonSavedId(wallet, contract);
  const next = {
    id,
    wallet,
    contract,
    chain: "polygon",
    collectionName: String(rec.collectionName || "Collection").trim() || "Collection",
    logo: typeof rec.logo === "string" && rec.logo.trim() ? rec.logo.trim() : null,
    savedAt: Date.now(),
    nickname: rec.nickname != null && String(rec.nickname).trim() ? String(rec.nickname).trim() : null,
  };

  let list = readPolygonSavedCollections().filter((r) => r.id !== id);
  list.unshift(next);
  list = list.slice(0, MAX_RECORDS);
  writeAll(list);
  return next;
}

export function removePolygonSavedCollection(id) {
  const sid = String(id || "").trim();
  if (!sid) return;
  const list = readPolygonSavedCollections().filter((r) => r.id !== sid);
  writeAll(list);
}
