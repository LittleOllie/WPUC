/**
 * Quirks Builder — pairing rules (isolated module).
 * - Quirkies + QuirkKids stay together per tokenId (same Quirkie entry / kid art).
 * - Quirklings are never paired with Quirkies — they render as their own tiles (cleaner grid).
 * - Quirklings with tokenId > PAIR_MAX_TOKEN_ID are listed after low-id Quirklings.
 * - INX: all wallet INX are emitted after Quirkie/Quirkling blocks (no “pair row” attachment).
 * - QuirkKid: companion art on Quirkies (metadata / optional matching collection).
 */

export const PAIR_MAX_TOKEN_ID = 5000;

/** Same pattern as official Quirkies embed (not in metadata); works if API omits kidImage. */
const QUIRK_KID_IMAGE_BASE =
  "https://quirkids-images.s3.ap-southeast-2.amazonaws.com/";

function quirkKidImageUrlForTokenId(tokenId) {
  const s = String(tokenId != null ? tokenId : "").trim();
  if (!/^\d+$/.test(s)) return null;
  try {
    if (BigInt(s) < 0n) return null;
  } catch {
    return null;
  }
  return `${QUIRK_KID_IMAGE_BASE}${s}.png`;
}

function effectiveQuirkKidImage(entry) {
  if (!entry) return null;
  if (entry.kidImage) return String(entry.kidImage);
  return quirkKidImageUrlForTokenId(entry.tokenId);
}

function normEntry(x) {
  if (x && typeof x === "object" && "tokenId" in x) {
    return {
      tokenId: x.tokenId,
      image: x.image || null,
      kidImage: x.kidImage || null,
      traits: Array.isArray(x.traits) ? x.traits : [],
    };
  }
  return { tokenId: x, image: null, kidImage: null, traits: [] };
}

function normList(arr) {
  const out = [];
  for (let i = 0; i < (arr || []).length; i++) {
    out.push(normEntry(arr[i]));
  }
  return out;
}

function idStr(t) {
  return String(t.tokenId != null ? t.tokenId : t);
}

function parseIdBigint(id) {
  try {
    return BigInt(String(id));
  } catch {
    return null;
  }
}

/**
 * @param {{ quirkies?: unknown[], quirklings?: unknown[], inx?: unknown[] }} walletPayload
 * @returns {{
 *   pairs: Array<{ tokenId: string, quirkie: object, quirking: object, inx: object | null }>,
 *   unmatchedQuirklingsHigh: object[],
 *   unmatchedQuirklingsMissingQuirkie: object[],
 *   loneQuirkies: object[],
 *   unmatchedInx: object[],
 * }}
 */
export function pairQuirksWalletData(walletPayload) {
  const quirkies = normList(walletPayload?.quirkies);
  const quirklings = normList(walletPayload?.quirklings);
  const inxList = normList(walletPayload?.inx);

  const maxPair = BigInt(PAIR_MAX_TOKEN_ID);

  const pairs = [];
  const unmatchedQuirklingsHigh = [];
  const unmatchedQuirklingsMissingQuirkie = [];

  for (const ql of quirklings) {
    const sid = idStr(ql);
    const bi = parseIdBigint(sid);
    if (bi == null) continue;
    if (bi > maxPair) {
      unmatchedQuirklingsHigh.push(ql);
    } else {
      unmatchedQuirklingsMissingQuirkie.push(ql);
    }
  }

  const loneQuirkies = quirkies.slice();

  loneQuirkies.sort((a, b) => {
    const ba = parseIdBigint(a.tokenId);
    const bb = parseIdBigint(b.tokenId);
    if (ba != null && bb != null) {
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    }
    return idStr(a).localeCompare(idStr(b));
  });

  unmatchedQuirklingsMissingQuirkie.sort((a, b) => {
    const ba = parseIdBigint(a.tokenId);
    const bb = parseIdBigint(b.tokenId);
    if (ba != null && bb != null) {
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    }
    return idStr(a).localeCompare(idStr(b));
  });

  unmatchedQuirklingsHigh.sort((a, b) => {
    const ba = parseIdBigint(a.tokenId);
    const bb = parseIdBigint(b.tokenId);
    if (ba != null && bb != null) {
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    }
    return idStr(a).localeCompare(idStr(b));
  });

  const unmatchedInx = inxList.slice();
  unmatchedInx.sort((a, b) => {
    const ba = parseIdBigint(a.tokenId);
    const bb = parseIdBigint(b.tokenId);
    if (ba != null && bb != null) {
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    }
    return idStr(a).localeCompare(idStr(b));
  });

  return {
    pairs,
    unmatchedQuirklingsHigh,
    unmatchedQuirklingsMissingQuirkie,
    loneQuirkies,
    unmatchedInx,
  };
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/**
 * Random order while keeping Quirkie + QuirkKid back-to-back for the same token id.
 */
export function shuffleQuirksPairing(pairing) {
  return {
    pairs: shuffleInPlace(pairing.pairs.slice()),
    loneQuirkies: shuffleInPlace(pairing.loneQuirkies.slice()),
    unmatchedQuirklingsHigh: shuffleInPlace(
      pairing.unmatchedQuirklingsHigh.slice()
    ),
    unmatchedQuirklingsMissingQuirkie: shuffleInPlace(
      pairing.unmatchedQuirklingsMissingQuirkie.slice()
    ),
    unmatchedInx: shuffleInPlace((pairing.unmatchedInx || []).slice()),
  };
}

/**
 * Normalize trait type names across collections (e.g. "Background" vs "Backgrounds").
 */
export function quirksTraitCanonicalKey(raw) {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s.length > 1 && s.endsWith("s") && !s.endsWith("ss")) {
    const withoutS = s.slice(0, -1);
    if (withoutS.length >= 3) s = withoutS;
  }
  return s;
}

/** Read trait value when sort key may be any spelling that maps to the same canonical key. */
export function traitValCanonical(traits, canonicalOrRawKey) {
  if (!traits || canonicalOrRawKey == null) return "";
  const target = quirksTraitCanonicalKey(String(canonicalOrRawKey));
  if (!target) return "";
  for (let j = 0; j < traits.length; j++) {
    const tt = traits[j].trait_type || traits[j].traitType;
    if (quirksTraitCanonicalKey(tt) === target) {
      const v = traits[j].value;
      return v != null ? String(v) : "";
    }
  }
  return "";
}

function compareTokenIdStr(a, b) {
  const ba = parseIdBigint(a);
  const bb = parseIdBigint(b);
  if (ba != null && bb != null) {
    if (ba < bb) return -1;
    if (ba > bb) return 1;
    return 0;
  }
  return String(a).localeCompare(String(b));
}

/**
 * Sort pairing buckets by trait (canonical key on each entry’s traits), then token id.
 * Applies to lone Quirkies, Quirklings (their own traits), and INX
 * (quirking metadata), so trait layout works for Group sets, sections, and grouped units.
 */
export function sortPairingByQuirkieTrait(pairing, traitKey) {
  function cmpByTraitThenId(traitsA, traitsB, idA, idB) {
    const va = traitValCanonical(traitsA, traitKey);
    const vb = traitValCanonical(traitsB, traitKey);
    const c = va.localeCompare(vb, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (c !== 0) return c;
    return compareTokenIdStr(idA, idB);
  }

  const pairs = pairing.pairs.slice().sort((a, b) =>
    cmpByTraitThenId(a.quirkie?.traits, b.quirkie?.traits, a.tokenId, b.tokenId)
  );

  const loneQuirkies = pairing.loneQuirkies.slice().sort((a, b) =>
    cmpByTraitThenId(a.traits, b.traits, a.tokenId, b.tokenId)
  );

  const unmatchedQuirklingsMissingQuirkie =
    pairing.unmatchedQuirklingsMissingQuirkie.slice().sort((a, b) =>
      cmpByTraitThenId(a.traits, b.traits, a.tokenId, b.tokenId)
    );

  const unmatchedQuirklingsHigh = pairing.unmatchedQuirklingsHigh
    .slice()
    .sort((a, b) =>
      cmpByTraitThenId(a.traits, b.traits, a.tokenId, b.tokenId)
    );

  const unmatchedInx = (pairing.unmatchedInx || []).slice().sort((a, b) =>
    cmpByTraitThenId(a.traits, b.traits, a.tokenId, b.tokenId)
  );

  return {
    ...pairing,
    pairs,
    loneQuirkies,
    unmatchedQuirklingsMissingQuirkie,
    unmatchedQuirklingsHigh,
    unmatchedInx,
  };
}

function pushIfImage(out, entry, kind) {
  if (!entry || !entry.image) return;
  out.push({
    tokenId: entry.tokenId,
    image: String(entry.image),
    traits: entry.traits || [],
    kind,
  });
}

function pushKidIfPresent(out, entry, kind) {
  const kidUrl = effectiveQuirkKidImage(entry);
  if (!entry || !kidUrl) return;
  out.push({
    tokenId: entry.tokenId,
    image: String(kidUrl),
    traits: entry.traits || [],
    kind,
  });
}

/**
 * Flatten wallet lists (no pairing) — for verifying fetch/API before pairing is applied.
 */
export function collectQuirksItemsFlat(
  data,
  wantQuirkies,
  wantQuirkKid,
  wantQuirklings,
  wantInx,
  maxTiles
) {
  const cap = typeof maxTiles === "number" ? maxTiles : 100000;
  const out = [];
  for (const e of normList(data?.quirkies)) {
    if (wantQuirkies) pushIfImage(out, e, "quirkie");
    if (wantQuirkKid) pushKidIfPresent(out, e, "quirkkid");
  }
  if (wantQuirklings) {
    for (const e of normList(data?.quirklings)) {
      pushIfImage(out, e, "quirking");
    }
  }
  if (wantInx) {
    for (const e of normList(data?.inx)) {
      pushIfImage(out, e, "inx");
    }
  }
  return out.slice(0, cap);
}

/**
 * One block per collection: all Quirkies, then all QuirKid, then Quirklings, then INX.
 */
function buildQuirksGridSequenceSections(pairing, opts, cap) {
  const { wantQuirkies, wantQuirkKid, wantQuirklings, wantInx } = opts;
  const out = [];

  if (wantQuirkies) {
    for (const q of pairing.loneQuirkies) {
      pushIfImage(out, q, "quirkie-section");
    }
  }
  if (wantQuirkKid) {
    for (const q of pairing.loneQuirkies) {
      pushKidIfPresent(out, q, "quirkkid-section");
    }
  }
  if (wantQuirklings) {
    for (const ql of pairing.unmatchedQuirklingsMissingQuirkie) {
      pushIfImage(out, ql, "quirking-section");
    }
    for (const ql of pairing.unmatchedQuirklingsHigh) {
      pushIfImage(out, ql, "quirking-section");
    }
  }
  if (wantInx) {
    for (const x of pairing.unmatchedInx || []) {
      pushIfImage(out, x, "inx-section");
    }
  }

  return out.slice(0, cap);
}

/**
 * Build ordered grid items: per Quirkie (quirkie → optional quirkkid when both selected),
 * then low-ID Quirklings, then high-ID Quirklings, then all INX.
 */
export function buildQuirksGridSequence(pairing, opts, maxTiles) {
  const cap = typeof maxTiles === "number" ? maxTiles : 100000;
  const {
    wantQuirkies,
    wantQuirkKid,
    wantQuirklings,
    wantInx,
    gridLayout = "grouped",
  } = opts;

  if (gridLayout === "sections") {
    return buildQuirksGridSequenceSections(pairing, opts, cap);
  }

  const out = [];

  for (const q of pairing.loneQuirkies) {
    if (wantQuirkies) pushIfImage(out, q, "quirkie-lone");
    if (wantQuirkKid) pushKidIfPresent(out, q, "quirkkid-lone");
  }
  if (wantQuirklings) {
    for (const ql of pairing.unmatchedQuirklingsMissingQuirkie) {
      pushIfImage(out, ql, "quirking-unmatched");
    }
    for (const ql of pairing.unmatchedQuirklingsHigh) {
      pushIfImage(out, ql, "quirking-high");
    }
  }
  if (wantInx) {
    for (const x of pairing.unmatchedInx || []) {
      pushIfImage(out, x, "inx");
    }
  }

  return out.slice(0, cap);
}

/**
 * @param {boolean} usePairing — false = flat lists (API smoke test); true = pairing + sequence rules.
 * @param {"grouped"|"sections"} gridLayout — paired layout vs separate collection blocks.
 */
export function collectQuirksItemsForGrid(
  walletPayload,
  wantQuirkies,
  wantQuirkKid,
  wantQuirklings,
  wantInx,
  usePairing,
  maxTiles,
  gridLayout,
  preset
) {
  const presetKey = String(preset || "").trim().toLowerCase();
  if (presetKey && presetKey !== "own") {
    return collectQuirksPresetItemsForGrid(walletPayload, presetKey, maxTiles);
  }
  if (!usePairing) {
    return collectQuirksItemsFlat(
      walletPayload,
      wantQuirkies,
      wantQuirkKid,
      wantQuirklings,
      wantInx,
      maxTiles
    );
  }
  const pairing = pairQuirksWalletData(walletPayload);
  return buildQuirksGridSequence(
    pairing,
    {
      wantQuirkies,
      wantQuirkKid,
      wantQuirklings,
      wantInx,
      gridLayout: gridLayout || "grouped",
    },
    maxTiles
  );
}

function indexByTokenId(list) {
  const m = new Map();
  const arr = normList(list);
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    const k = idStr(e);
    if (!k) continue;
    if (!m.has(k)) m.set(k, e);
  }
  return m;
}

function sortedIdKeysFromSet(s) {
  const out = Array.from(s || []);
  out.sort((a, b) => {
    const ba = parseIdBigint(a);
    const bb = parseIdBigint(b);
    if (ba != null && bb != null) {
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    }
    return String(a).localeCompare(String(b));
  });
  return out;
}

function push(out, tokenId, image, kind) {
  if (!image) return;
  out.push({
    tokenId,
    image: String(image),
    traits: [],
    kind,
  });
}

/**
 * Preset-only sequences (require holding the relevant items for the same tokenId).
 * Returns a flat item list in the desired on-grid order.
 */
export function collectQuirksPresetItemsForGrid(walletPayload, presetKey, maxTiles) {
  const cap = typeof maxTiles === "number" ? maxTiles : 100000;
  const q = indexByTokenId(walletPayload?.quirkies);
  const ql = indexByTokenId(walletPayload?.quirklings);
  const ix = indexByTokenId(walletPayload?.inx);

  // Determine IDs that satisfy the preset.
  const ids = new Set();
  const qKeys = new Set(q.keys());
  for (const k of qKeys) ids.add(k);
  const wantIds = new Set();

  function hasQuirkie(id) {
    const e = q.get(id);
    return !!(e && e.image);
  }
  function hasKid(id) {
    const e = q.get(id);
    return !!effectiveQuirkKidImage(e);
  }
  function hasQuirkling(id) {
    const e = ql.get(id);
    return !!(e && e.image);
  }
  function hasInx(id) {
    const e = ix.get(id);
    return !!(e && e.image);
  }

  for (const id of ids) {
    if (presetKey === "quirkies+quirkid") {
      if (hasQuirkie(id) && hasKid(id)) wantIds.add(id);
    } else if (presetKey === "alpha-sets") {
      if (hasQuirkie(id) && hasQuirkling(id)) wantIds.add(id);
    } else if (presetKey === "alpha+kid") {
      if (hasQuirkie(id) && hasKid(id) && hasQuirkling(id)) wantIds.add(id);
    } else if (presetKey === "triple-threat") {
      if (hasQuirkie(id) && hasQuirkling(id) && hasInx(id)) wantIds.add(id);
    } else if (presetKey === "quadruple-threat") {
      if (hasQuirkie(id) && hasKid(id) && hasQuirkling(id) && hasInx(id)) wantIds.add(id);
    } else {
      // Unknown preset → nothing.
    }
  }

  const out = [];
  const ordered = sortedIdKeysFromSet(wantIds);
  for (let i = 0; i < ordered.length && out.length < cap; i++) {
    const id = ordered[i];
    const qe = q.get(id);
    const qle = ql.get(id);
    const ixe = ix.get(id);
    if (presetKey === "quirkies+quirkid") {
      push(out, id, qe?.image, "quirkie-lone");
      push(out, id, effectiveQuirkKidImage(qe), "quirkkid-lone");
    } else if (presetKey === "alpha-sets") {
      push(out, id, qe?.image, "quirkie-lone");
      push(out, id, qle?.image, "quirking-unmatched");
    } else if (presetKey === "alpha+kid") {
      push(out, id, qe?.image, "quirkie-lone");
      push(out, id, effectiveQuirkKidImage(qe), "quirkkid-lone");
      push(out, id, qle?.image, "quirking-unmatched");
    } else if (presetKey === "triple-threat") {
      push(out, id, qe?.image, "quirkie-lone");
      push(out, id, qle?.image, "quirking-unmatched");
      push(out, id, ixe?.image, "inx");
    } else if (presetKey === "quadruple-threat") {
      push(out, id, qe?.image, "quirkie-lone");
      push(out, id, effectiveQuirkKidImage(qe), "quirkkid-lone");
      push(out, id, qle?.image, "quirking-unmatched");
      push(out, id, ixe?.image, "inx");
    }
  }

  return out.slice(0, cap);
}
