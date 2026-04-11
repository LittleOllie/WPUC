/** Alchemy NFT API v3 base URL (key in path). */
function nftBaseUrl(apiKey) {
  return `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}`;
}

function firstOwnerFromResponse(data) {
  const list = data?.owners;
  if (!Array.isArray(list) || list.length === 0) return null;
  const item = list[0];
  if (typeof item === "string") return item;
  if (item && typeof item.ownerAddress === "string") {
    return item.ownerAddress;
  }
  return null;
}

async function readAlchemyJson(res) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Alchemy HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Alchemy returned non-JSON: ${text.slice(0, 120)}`);
  }
}

function pickTokenIdRaw(nft) {
  if (!nft || typeof nft !== "object") return null;
  const candidates = [
    nft.tokenId,
    nft?.id?.tokenId,
    nft?.token?.tokenId,
    nft?.contract?.tokenId,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) return c;
  }
  return null;
}

/** Decimal string token id from Alchemy NFT object (BigInt-safe). */
function canonicalTokenIdFromNft(nft) {
  const raw = pickTokenIdRaw(nft);
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s).toString(10);
    if (/^\d+$/.test(s)) return BigInt(s).toString(10);
    return BigInt(s).toString(10);
  } catch {
    return null;
  }
}

function tokenIdStrToJson(decimalStr) {
  try {
    const bi = BigInt(String(decimalStr));
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (bi <= max) return Number(bi);
    return bi.toString(10);
  } catch {
    return String(decimalStr);
  }
}

/** Browsers cannot load ipfs:// or ar:// — convert to HTTPS gateways. */
function normalizeImageUrl(u) {
  if (!u || typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  if (s.startsWith("ipfs://")) {
    const path = s.slice(7).replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  if (s.startsWith("ar://")) {
    return `https://arweave.net/${s.slice(5)}`;
  }
  return s;
}

/** Collect every common Alchemy / OpenSea image field, then normalize. */
function extractImageFromMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [];

  const m = data.media;
  if (Array.isArray(m) && m.length > 0) {
    const first = m[0];
    candidates.push(
      first?.gateway,
      first?.raw,
      first?.thumbnail,
      first?.cachedUrl
    );
  }

  const img = data.image;
  if (typeof img === "string") candidates.push(img);
  else if (img && typeof img === "object") {
    candidates.push(
      img.cachedUrl,
      img.pngUrl,
      img.thumbnailUrl,
      img.originalUrl,
      img.webpUrl
    );
  }

  const rawMeta = data.raw?.metadata;
  if (rawMeta && typeof rawMeta === "object") {
    candidates.push(rawMeta.image, rawMeta.image_url, rawMeta.imageUrl);
  }

  candidates.push(
    data.openSeaMetadata?.imageUrl,
    data.contract?.openSeaMetadata?.imageUrl
  );

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const n = normalizeImageUrl(c.trim());
      if (n) return n;
    }
  }
  return null;
}

/** OpenSea-style attributes from Alchemy owned NFT object (withMetadata). */
function extractTraitsFromNft(nft) {
  if (!nft || typeof nft !== "object") return [];
  const out = [];
  const seen = new Set();
  const pushPair = (tt, v) => {
    if (tt == null || !String(tt).trim()) return;
    const key = String(tt).trim() + "\0" + String(v ?? "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ trait_type: String(tt).trim(), value: v != null ? v : "" });
  };

  const ingestAttributes = (attrs) => {
    if (!Array.isArray(attrs)) return;
    for (const a of attrs) {
      if (a && typeof a === "object") {
        const tt = a.trait_type ?? a.traitType ?? a.name;
        pushPair(tt, a.value ?? a.string_value);
      }
    }
  };

  /** Some collections use ERC-1155-style `properties: { "Background": "Blue" }`. */
  const ingestProperties = (props) => {
    if (!props || typeof props !== "object" || Array.isArray(props)) return;
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v != null && typeof v !== "object") pushPair(k, v);
    }
  };

  /** Alchemy often returns `metadata` / `raw.metadata` as a JSON string. */
  const ingestMetaBlob = (blob) => {
    if (blob == null) return;
    if (typeof blob === "string") {
      try {
        ingestMetaBlob(JSON.parse(blob));
      } catch {
        /* not JSON */
      }
      return;
    }
    if (typeof blob === "object") {
      ingestAttributes(blob.attributes);
      ingestAttributes(blob.traits);
      ingestProperties(blob.properties);
    }
  };

  ingestMetaBlob(nft.raw?.metadata);
  ingestMetaBlob(nft.metadata);
  ingestMetaBlob(nft.rawMetadata);
  if (Array.isArray(nft.attributes)) ingestAttributes(nft.attributes);

  return out;
}

async function safeGetNftMetadataImage(nftBase, contract, tokenIdStr) {
  try {
    const params = new URLSearchParams({
      contractAddress: normalizeAddr(contract),
      tokenId: tokenIdStr,
    });
    const res = await fetch(`${nftBase}/getNFTMetadata?${params.toString()}`);
    const data = await readAlchemyJson(res);
    return extractImageFromMetadata(data);
  } catch {
    return null;
  }
}

function normalizeAddr(a) {
  if (!a || typeof a !== "string") return a;
  return a.toLowerCase();
}

/** OpenSea token page (matches opensea.io/item/ethereum/… in the live UI). */
function openseaEthereumItemUrl(contract, decimalTokenId) {
  const c = normalizeAddr(contract);
  const tid = String(decimalTokenId);
  return `https://opensea.io/item/ethereum/${c}/${tid}`;
}

function isOpenSeaTokenUrl(u) {
  if (typeof u !== "string" || !u.includes("opensea.io")) return false;
  return /opensea\.io\/(assets|item)\/ethereum\/0x[a-fA-F0-9]{40}\//i.test(u);
}

/** Pull a token permalink from Alchemy getNFTMetadata when OpenSea exposes it. */
function extractOpenSeaPermalinkFromMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [
    data.permalink,
    data.openSea?.permalink,
    data.openSea?.url,
    data.openSeaMetadata?.tokenUrl,
    data.openSeaMetadata?.permalink,
    data.contract?.openSeaMetadata?.externalUrl,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && isOpenSeaTokenUrl(c)) {
      return c.trim().split("?")[0];
    }
  }
  return null;
}

async function safeGetNftMetadataObject(nftBase, contract, tokenIdStr) {
  try {
    const params = new URLSearchParams({
      contractAddress: normalizeAddr(contract),
      tokenId: String(tokenIdStr),
    });
    const res = await fetch(`${nftBase}/getNFTMetadata?${params.toString()}`);
    const text = await res.text();
    if (!res.ok) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Prefer OpenSea URL from metadata; fall back to constructed /assets/ethereum/… URL. */
async function resolveOpenSeaNftUrl(nftBase, contract, tokenIdStr) {
  const fallback = openseaEthereumItemUrl(contract, tokenIdStr);
  const data = await safeGetNftMetadataObject(nftBase, contract, tokenIdStr);
  if (!data) return fallback;
  const perm = extractOpenSeaPermalinkFromMetadata(data);
  return perm || fallback;
}

/** getOwnersForNFT: try decimal then hex tokenId. Never throws — Alchemy errors must not fail the whole wallet response. */
async function getOwnerForToken(nftBase, contract, tokenIdStr) {
  let dec;
  try {
    dec = String(tokenIdStr);
    BigInt(dec);
  } catch {
    return null;
  }
  const hex = "0x" + BigInt(dec).toString(16);

  for (const tid of [dec, hex]) {
    try {
      const params = new URLSearchParams({
        contractAddress: normalizeAddr(contract),
        tokenId: tid,
      });
      const res = await fetch(
        `${nftBase}/getOwnersForNFT?${params.toString()}`
      );
      const data = await readAlchemyJson(res);
      const owner = firstOwnerFromResponse(data);
      if (owner) return owner;
    } catch {
      /* rate limits, 4xx/5xx, or bad JSON — try next format or give up */
    }
  }
  return null;
}

/** Concurrency for counterpart owner lookups (was fully sequential → timeouts on large wallets). */
const COUNTERPART_OWNER_CONCURRENCY = 10;

async function mapWithConcurrency(items, limit, asyncFn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await asyncFn(items[idx], idx);
    }
  }
  const n = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/**
 * Paginated getNFTsForOwner with withMetadata=true — one fetch per page (~100 NFTs).
 * Avoids hundreds of per-token getNFTMetadata calls (slow, hits Worker time limits on large wallets).
 */
async function fetchOwnedCollection(nftBase, owner, contract) {
  const idToImage = new Map();
  const idToTraits = new Map();
  const idSet = new Set();
  let pageKey = null;
  const ownerNorm = normalizeAddr(owner);
  const contractNorm = normalizeAddr(contract);

  do {
    const params = new URLSearchParams({
      owner: ownerNorm,
      pageSize: "100",
      withMetadata: "true",
      /** Slower IPFS / tokenUri hosts; default can leave `raw.metadata` empty. */
      tokenUriTimeoutInMs: "15000",
    });
    params.append("contractAddresses[]", contractNorm);
    if (pageKey) params.set("pageKey", pageKey);

    const endpoint = `${nftBase}/getNFTsForOwner?${params.toString()}`;
    const res = await fetch(endpoint);
    const data = await readAlchemyJson(res);

    for (const nft of data.ownedNfts || []) {
      const key = canonicalTokenIdFromNft(nft);
      if (!key) continue;
      idSet.add(key);
      const img = extractImageFromMetadata(nft);
      if (img) idToImage.set(key, img);
      const traits = extractTraitsFromNft(nft);
      idToTraits.set(key, traits);
    }

    pageKey = data.pageKey || null;
  } while (pageKey);

  const idKeys = [...idSet].sort((x, y) => {
    const cmp = BigInt(x) - BigInt(y);
    if (cmp < 0n) return -1;
    if (cmp > 0n) return 1;
    return 0;
  });

  return { idKeys, idToImage, idToTraits };
}

function normalizePath(pathname) {
  return pathname.replace(/\/$/, "") || "/";
}

function parseTokenIdParam(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { ok: false, error: "Missing id query parameter" };
  }
  const s = String(raw).trim();
  let bi;
  try {
    if (s.startsWith("0x") || s.startsWith("0X")) bi = BigInt(s);
    else if (/^\d+$/.test(s)) bi = BigInt(s);
    else {
      return {
        ok: false,
        error: "Invalid id: use a decimal number or 0x-prefixed hex",
      };
    }
  } catch {
    return { ok: false, error: "Invalid id" };
  }
  if (bi < 0n) {
    return { ok: false, error: "Invalid id: must be non-negative" };
  }
  const str = bi.toString(10);
  const tokenIdJson =
    bi <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bi) : str;
  return { ok: true, tokenIdJson, tokenIdStr: str };
}

function addressesMatch(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function isValidEthAddress(addr) {
  return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

/** Highest CERT token ID minted on-chain; OGENIE IDs above this have no matching CERT. */
function getCertMaxTokenIdFromEnv(env) {
  const raw = env.CERT_MAX_TOKEN_ID;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return 1000n;
  }
  try {
    return BigInt(String(raw).trim());
  } catch {
    return 1000n;
  }
}

function requireAlchemyEnv(env) {
  const key = env.ALCHEMY_API_KEY;
  if (!key) {
    return {
      ok: false,
      response: json(
        { error: "Server misconfiguration: ALCHEMY_API_KEY is not set" },
        500
      ),
    };
  }
  const ogenie = env.OGENIE_CONTRACT;
  const cert = env.CERT_CONTRACT;
  if (!ogenie || !cert) {
    return {
      ok: false,
      response: json(
        { error: "Server misconfiguration: contract addresses missing" },
        500
      ),
    };
  }
  return { ok: true, nftBase: nftBaseUrl(key), OGENIE: ogenie, CERT: cert };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const path = normalizePath(url.pathname);

    if (path === "/api/token") {
      try {
        const parsed = parseTokenIdParam(url.searchParams.get("id"));
        if (!parsed.ok) {
          return json({ error: parsed.error }, 400);
        }

        const envCheck = requireAlchemyEnv(env);
        if (!envCheck.ok) return envCheck.response;

        const { nftBase, OGENIE, CERT } = envCheck;
        const tid = parsed.tokenIdStr;
        const certMaxId = getCertMaxTokenIdFromEnv(env);
        const certMaxTokenIdJson =
          certMaxId <= BigInt(Number.MAX_SAFE_INTEGER)
            ? Number(certMaxId)
            : certMaxId.toString(10);

        if (BigInt(tid) > certMaxId) {
          const [ogenieOwner, imageOgenie] = await Promise.all([
            getOwnerForToken(nftBase, OGENIE, tid),
            safeGetNftMetadataImage(nftBase, OGENIE, tid),
          ]);
          const ogenie = {
            owner: ogenieOwner,
            image: imageOgenie,
            opensea: ogenieOwner ? `https://opensea.io/${ogenieOwner}` : null,
          };
          return json({
            tokenId: parsed.tokenIdJson,
            certMaxTokenId: certMaxTokenIdJson,
            noCertForId: true,
            ogenie,
            cert: null,
            matched: false,
          });
        }

        const [ogenieOwner, certOwner, imageOgenie, imageCert] =
          await Promise.all([
            getOwnerForToken(nftBase, OGENIE, tid),
            getOwnerForToken(nftBase, CERT, tid),
            safeGetNftMetadataImage(nftBase, OGENIE, tid),
            safeGetNftMetadataImage(nftBase, CERT, tid),
          ]);

        const ogenie = {
          owner: ogenieOwner,
          image: imageOgenie,
          opensea: ogenieOwner ? `https://opensea.io/${ogenieOwner}` : null,
        };
        const cert = {
          owner: certOwner,
          image: imageCert,
          opensea: certOwner ? `https://opensea.io/${certOwner}` : null,
        };

        return json({
          tokenId: parsed.tokenIdJson,
          certMaxTokenId: certMaxTokenIdJson,
          noCertForId: false,
          ogenie,
          cert,
          matched: addressesMatch(ogenieOwner, certOwner),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: "Server error", detail: msg }, 500);
      }
    }

    if (path === "/api/wallet") {
      try {
        const addressRaw = url.searchParams.get("address");

        if (!addressRaw || !String(addressRaw).trim()) {
          return json({ error: "Missing wallet address" }, 400);
        }

        const address = normalizeAddr(addressRaw.trim());
        if (!isValidEthAddress(address)) {
          return json({ error: "Invalid wallet address" }, 400);
        }

        const envCheck = requireAlchemyEnv(env);
        if (!envCheck.ok) return envCheck.response;

        const { nftBase, OGENIE, CERT } = envCheck;
        const certMaxId = getCertMaxTokenIdFromEnv(env);
        const certMaxTokenIdJson =
          certMaxId <= BigInt(Number.MAX_SAFE_INTEGER)
            ? Number(certMaxId)
            : certMaxId.toString(10);

        const [ogenieCol, certCol] = await Promise.all([
          fetchOwnedCollection(nftBase, address, OGENIE),
          fetchOwnedCollection(nftBase, address, CERT),
        ]);

        const oSet = new Set(ogenieCol.idKeys);
        const cSet = new Set(certCol.idKeys);

        const ogenies = ogenieCol.idKeys.map((id) => ({
          tokenId: tokenIdStrToJson(id),
          image: ogenieCol.idToImage.get(id) ?? null,
          traits: ogenieCol.idToTraits.get(id) ?? [],
        }));
        const certs = certCol.idKeys.map((id) => ({
          tokenId: tokenIdStrToJson(id),
          image: certCol.idToImage.get(id) ?? null,
          traits: certCol.idToTraits.get(id) ?? [],
        }));

        const matched = [];
        for (const id of ogenieCol.idKeys) {
          if (cSet.has(id)) {
            matched.push({
              tokenId: tokenIdStrToJson(id),
              imageOgenie: ogenieCol.idToImage.get(id) ?? null,
              imageCert: certCol.idToImage.get(id) ?? null,
            });
          }
        }

        const rawMissingCertIds = ogenieCol.idKeys.filter((id) => !cSet.has(id));
        const noCertIds = [];
        const missingCertIds = [];
        for (const id of rawMissingCertIds) {
          try {
            if (BigInt(id) > certMaxId) noCertIds.push(id);
            else missingCertIds.push(id);
          } catch {
            missingCertIds.push(id);
          }
        }

        const noCert = noCertIds.map((id) => ({
          tokenId: tokenIdStrToJson(id),
          image: ogenieCol.idToImage.get(id) ?? null,
        }));

        const missingCertRows = await mapWithConcurrency(
          missingCertIds,
          COUNTERPART_OWNER_CONCURRENCY,
          async (id) => {
            const [counterpart, openseaNft] = await Promise.all([
              getOwnerForToken(nftBase, CERT, id),
              resolveOpenSeaNftUrl(nftBase, CERT, id),
            ]);
            return { counterpart, openseaNft };
          }
        );
        const missingCerts = missingCertIds.map((id, i) => {
          const { counterpart, openseaNft } = missingCertRows[i];
          return {
            tokenId: tokenIdStrToJson(id),
            image: ogenieCol.idToImage.get(id) ?? null,
            counterpartOwner: counterpart,
            opensea: counterpart ? `https://opensea.io/${counterpart}` : null,
            openseaNft,
          };
        });

        const missingOgenieIds = certCol.idKeys.filter((id) => !oSet.has(id));
        const missingOgenieRows = await mapWithConcurrency(
          missingOgenieIds,
          COUNTERPART_OWNER_CONCURRENCY,
          async (id) => {
            const [counterpart, data] = await Promise.all([
              getOwnerForToken(nftBase, OGENIE, id),
              safeGetNftMetadataObject(nftBase, OGENIE, id),
            ]);
            let counterpartImage = null;
            let openseaNft = openseaEthereumItemUrl(OGENIE, id);
            if (data) {
              counterpartImage = extractImageFromMetadata(data);
              const perm = extractOpenSeaPermalinkFromMetadata(data);
              if (perm) openseaNft = perm;
            }
            return { counterpart, counterpartImage, openseaNft };
          }
        );
        const missingOgenies = missingOgenieIds.map((id, i) => {
          const { counterpart, counterpartImage, openseaNft } =
            missingOgenieRows[i];
          return {
            tokenId: tokenIdStrToJson(id),
            image: certCol.idToImage.get(id) ?? null,
            counterpartOwner: counterpart,
            counterpartImage: counterpartImage ?? null,
            opensea: counterpart
              ? `https://opensea.io/${counterpart}`
              : null,
            openseaNft,
          };
        });

        return json({
          wallet: address,
          certMaxTokenId: certMaxTokenIdJson,
          ogenies,
          certs,
          matched,
          missingCerts,
          noCert,
          missingOgenies,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: "Server error", detail: msg }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}
