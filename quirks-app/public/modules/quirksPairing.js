/**
 * Quirks Builder — pairing rules (isolated module).
 * - Quirkies + Quirklings pair when tokenId ≤ PAIR_MAX_TOKEN_ID and both exist.
 * - Quirklings with tokenId > PAIR_MAX_TOKEN_ID are never paired (high-id unmatched).
 * - INX attaches to a pair row when the wallet holds INX with the same tokenId (optional).
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
 * }}
 */
export function pairQuirksWalletData(walletPayload) {
  const quirkies = normList(walletPayload?.quirkies);
  const quirklings = normList(walletPayload?.quirklings);
  const inxList = normList(walletPayload?.inx);

  const maxPair = BigInt(PAIR_MAX_TOKEN_ID);
  const inxById = new Map();
  for (const x of inxList) {
    inxById.set(idStr(x), x);
  }

  const qById = new Map();
  for (const q of quirkies) {
    qById.set(idStr(q), q);
  }

  const pairs = [];
  const unmatchedQuirklingsHigh = [];
  const unmatchedQuirklingsMissingQuirkie = [];

  for (const ql of quirklings) {
    const sid = idStr(ql);
    const bi = parseIdBigint(sid);
    if (bi == null) continue;
    if (bi > maxPair) {
      unmatchedQuirklingsHigh.push(ql);
      continue;
    }
    const q = qById.get(sid);
    if (q) {
      pairs.push({
        tokenId: sid,
        quirkie: q,
        quirking: ql,
        inx: inxById.get(sid) || null,
      });
    } else {
      unmatchedQuirklingsMissingQuirkie.push(ql);
    }
  }

  const pairedQuirkieIds = new Set(pairs.map((p) => p.tokenId));
  const loneQuirkies = [];
  for (const q of quirkies) {
    const sid = idStr(q);
    if (!pairedQuirkieIds.has(sid)) {
      loneQuirkies.push(q);
    }
  }

  pairs.sort((a, b) => {
    const ba = parseIdBigint(a.tokenId);
    const bb = parseIdBigint(b.tokenId);
    if (ba != null && bb != null) {
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return 0;
    }
    return String(a.tokenId).localeCompare(String(b.tokenId));
  });

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

  return {
    pairs,
    unmatchedQuirklingsHigh,
    unmatchedQuirklingsMissingQuirkie,
    loneQuirkies,
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
 * Random order while keeping pair triples / pair rows contiguous when flattened.
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
  };
}

function traitVal(traits, traitType) {
  if (!traits || !traitType) return "";
  for (let j = 0; j < traits.length; j++) {
    const tt = traits[j].trait_type || traits[j].traitType;
    if (tt === traitType) {
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

/** Sort matched pairs by a trait on the Quirkies side, then token id. */
export function sortPairingByQuirkieTrait(pairing, traitKey) {
  const pairs = pairing.pairs.slice().sort((a, b) => {
    const va = traitVal(a.quirkie?.traits, traitKey);
    const vb = traitVal(b.quirkie?.traits, traitKey);
    const c = va.localeCompare(vb, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (c !== 0) return c;
    return compareTokenIdStr(a.tokenId, b.tokenId);
  });
  return {
    ...pairing,
    pairs,
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
  if (wantQuirkies) {
    for (const e of normList(data?.quirkies)) {
      pushIfImage(out, e, "quirkie");
    }
  }
  if (wantQuirkKid) {
    for (const e of normList(data?.quirkies)) {
      pushKidIfPresent(out, e, "quirkkid");
    }
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
 * One block per collection: all Quirkies, then all QuirkKids, then Quirklings, then INX.
 */
function buildQuirksGridSequenceSections(pairing, opts, cap) {
  const { wantQuirkies, wantQuirkKid, wantQuirklings, wantInx } = opts;
  const out = [];

  if (wantQuirkies) {
    for (const p of pairing.pairs) {
      pushIfImage(out, p.quirkie, "quirkie-section");
    }
    for (const q of pairing.loneQuirkies) {
      pushIfImage(out, q, "quirkie-section");
    }
  }
  if (wantQuirkKid) {
    for (const p of pairing.pairs) {
      pushKidIfPresent(out, p.quirkie, "quirkkid-section");
    }
    for (const q of pairing.loneQuirkies) {
      pushKidIfPresent(out, q, "quirkkid-section");
    }
  }
  if (wantQuirklings) {
    for (const p of pairing.pairs) {
      pushIfImage(out, p.quirking, "quirking-section");
    }
    for (const ql of pairing.unmatchedQuirklingsMissingQuirkie) {
      pushIfImage(out, ql, "quirking-section");
    }
    for (const ql of pairing.unmatchedQuirklingsHigh) {
      pushIfImage(out, ql, "quirking-section");
    }
  }
  if (wantInx) {
    for (const p of pairing.pairs) {
      if (p.inx && p.inx.image) pushIfImage(out, p.inx, "inx-section");
    }
  }

  return out.slice(0, cap);
}

/**
 * Build ordered grid items: paired blocks (quirkie → optional quirkkid → quirking → optional INX),
 * then lone quirkies (+ optional kids), then low-ID unmatched quirklings, then high-ID quirklings.
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

  for (const p of pairing.pairs) {
    if (wantQuirkies) pushIfImage(out, p.quirkie, "quirkie-pair");
    if (wantQuirkKid) pushKidIfPresent(out, p.quirkie, "quirkkid-pair");
    if (wantQuirklings) pushIfImage(out, p.quirking, "quirking-pair");
    if (wantInx && p.inx && p.inx.image) {
      pushIfImage(out, p.inx, "inx");
    }
  }
  if (wantQuirkies) {
    for (const q of pairing.loneQuirkies) {
      pushIfImage(out, q, "quirkie-lone");
    }
  }
  if (wantQuirkKid) {
    for (const q of pairing.loneQuirkies) {
      pushKidIfPresent(out, q, "quirkkid-lone");
    }
  }
  if (wantQuirklings) {
    for (const ql of pairing.unmatchedQuirklingsMissingQuirkie) {
      pushIfImage(out, ql, "quirking-unmatched");
    }
    for (const ql of pairing.unmatchedQuirklingsHigh) {
      pushIfImage(out, ql, "quirking-high");
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
  gridLayout
) {
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
