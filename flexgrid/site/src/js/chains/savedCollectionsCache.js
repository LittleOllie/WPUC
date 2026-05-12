/**
 * Per-chain saved collection bookmarks (wallet + collection id) in localStorage.
 * Records are strictly scoped by `chain` so Polygon / Ethereum / Solana / etc. never leak across UI.
 */

const LEGACY_POLYGON_KEY = "flexgrid_polygon_savedCollections_v1";
const STORAGE_KEY = "flexgrid_saved_collections_v2";
const MAX_RECORDS = 40;

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function looksLikeSolanaAddress(s) {
  const a = String(s || "").trim();
  if (a.length < 32 || a.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(a);
}

export function makeSavedCollectionId(chain, wallet, contract) {
  const ch = String(chain || "").trim().toLowerCase();
  const w = String(wallet || "").trim();
  const c = String(contract || "").trim();
  return `${ch}::${w}::${c}`;
}

function validateForChain(chain, wallet, contract) {
  const ch = String(chain || "").trim().toLowerCase();
  if (!ch) return false;
  if (ch === "polygon") {
    const w = String(wallet || "").trim().toLowerCase();
    const c = String(contract || "").trim().toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(w) && /^0x[a-f0-9]{40}$/.test(c);
  }
  if (ch === "solana") {
    return looksLikeSolanaAddress(wallet) && looksLikeSolanaAddress(contract);
  }
  return false;
}

function normalizeBookmark(r) {
  if (!r || typeof r !== "object") return null;
  const chain = String(r.chain || "polygon").trim().toLowerCase();
  const wallet = chain === "polygon" ? String(r.wallet || "").trim().toLowerCase() : String(r.wallet || "").trim();
  const contract = chain === "polygon" ? String(r.contract || "").trim().toLowerCase() : String(r.contract || "").trim();
  if (!validateForChain(chain, wallet, contract)) return null;

  let id = String(r.id || "").trim();
  const expected = makeSavedCollectionId(chain, wallet, contract);
  if (!id) id = expected;
  else {
    const parts = id.split("::");
    const legacyTwoPartEvm =
      parts.length === 2 &&
      parts[0].toLowerCase().startsWith("0x") &&
      parts[1].toLowerCase().startsWith("0x") &&
      chain === "polygon";
    if (legacyTwoPartEvm) id = expected;
    else if (!id.toLowerCase().startsWith(`${chain}::`)) id = expected;
  }

  return {
    id,
    chain,
    wallet,
    contract,
    collectionName: String(r.collectionName || "Collection").trim() || "Collection",
    logo: typeof r.logo === "string" && r.logo.trim() ? r.logo.trim() : null,
    savedAt: Number(r.savedAt) || 0,
    nickname: r.nickname != null && String(r.nickname).trim() ? String(r.nickname).trim() : null,
  };
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECORDS)));
  } catch {
    /* quota / private mode */
  }
}

function migrateLegacyPolygonIfNeeded() {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const raw = localStorage.getItem(LEGACY_POLYGON_KEY);
    if (!raw) return;
    const arr = safeParse(raw);
    const out = [];
    for (const r of arr) {
      const n = normalizeBookmark({ ...r, chain: "polygon" });
      if (n) out.push(n);
    }
    if (out.length) {
      writeAll(out);
      try {
        localStorage.removeItem(LEGACY_POLYGON_KEY);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/** Full list (all chains); prefer readSavedCollections(chain) for UI. */
function readAllBookmarks() {
  migrateLegacyPolygonIfNeeded();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = safeParse(raw);
    const out = [];
    for (const r of arr) {
      const n = normalizeBookmark(r);
      if (n) out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

/** @returns {SavedCollectionBookmark[]} */
export function readSavedCollections(chain) {
  const ch = String(chain || "").trim().toLowerCase();
  if (!ch) return [];
  return readAllBookmarks().filter((r) => r.chain === ch);
}

/** @param {Omit<SavedCollectionBookmark, "id" | "savedAt"> & { id?: string, chain: string }} rec */
export function upsertSavedCollection(rec) {
  const chain = String(rec.chain || "").trim().toLowerCase();
  const wallet = String(rec.wallet || "").trim();
  const contract = String(rec.contract || "").trim();
  if (!validateForChain(chain, wallet, contract)) return null;

  const w = chain === "polygon" ? wallet.toLowerCase() : wallet;
  const c = chain === "polygon" ? contract.toLowerCase() : contract;
  const id = makeSavedCollectionId(chain, w, c);

  const next = {
    id,
    chain,
    wallet: w,
    contract: c,
    collectionName: String(rec.collectionName || "Collection").trim() || "Collection",
    logo: typeof rec.logo === "string" && rec.logo.trim() ? rec.logo.trim() : null,
    savedAt: Date.now(),
    nickname: rec.nickname != null && String(rec.nickname).trim() ? String(rec.nickname).trim() : null,
  };

  let list = readAllBookmarks().filter((r) => r.id !== id);
  list.unshift(next);
  list = list.slice(0, MAX_RECORDS);
  writeAll(list);
  return next;
}

export function removeSavedCollection(id) {
  const sid = String(id || "").trim();
  if (!sid) return;
  const list = readAllBookmarks().filter((r) => r.id !== sid);
  writeAll(list);
}
