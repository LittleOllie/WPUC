/**
 * NFT Twin Finder — Contract Import API (chunked for Cloudflare subrequest limits)
 * GET /api/import-collection?network=ethereum&contract=0x...&pageKey=...&importLimit=...&imported=...
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const NETWORKS = {
  ethereum: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  apechain: "apechain-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
};

const DEFAULT_MAX_TOKENS = 10000;
const ABSOLUTE_MAX_TOKENS = 15000;
/** Alchemy pages per worker call (100 NFTs/page). Keep under Cloudflare's ~50 subrequest limit. */
const DEFAULT_PAGES_PER_REQUEST = 40;

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function getAlchemyKey(env) {
  const dedicated = String(env.ALCHEMY_API_KEY_NFT_IMPORT || "").trim();
  if (dedicated) return dedicated;
  return String(env.ALCHEMY_API_KEY || "").trim();
}

function getEnvMaxTokens(env) {
  const raw = env.IMPORT_MAX_TOKENS;
  if (raw == null || raw === "") return DEFAULT_MAX_TOKENS;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_TOKENS;
}

function getPagesPerRequest(env) {
  const raw = env.IMPORT_PAGES_PER_REQUEST;
  if (raw == null || raw === "") return DEFAULT_PAGES_PER_REQUEST;
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGES_PER_REQUEST;
  return Math.min(n, 45);
}

function resolveImportLimit(env, contractMeta, queryLimit) {
  const envMax = getEnvMaxTokens(env);
  const supply = Number(
    contractMeta?.totalSupply || contractMeta?.contractMetadata?.totalSupply || 0,
  );
  let limit = envMax;
  if (queryLimit) {
    const q = parseInt(String(queryLimit).trim(), 10);
    if (Number.isFinite(q) && q > 0) limit = q;
  } else if (supply > 0) {
    limit = Math.min(supply, envMax);
  }
  return Math.min(limit, ABSOLUTE_MAX_TOKENS);
}

function validateContract(addr) {
  const t = String(addr || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(t)) return null;
  return t;
}

function parseNetwork(value) {
  const key = String(value || "ethereum").trim().toLowerCase();
  if (!NETWORKS[key]) return null;
  return key;
}

function parseMetadata(raw) {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  let s = url.trim();
  if (!s) return "";
  if (s.startsWith("ipfs://")) {
    return `https://cloudflare-ipfs.com/ipfs/${s.slice(7)}`;
  }
  if (s.startsWith("ar://")) {
    return `https://arweave.net/${s.slice(5)}`;
  }
  if (s.startsWith("//")) return `https:${s}`;
  return s;
}

function pickImageUrl(nft) {
  const img = nft?.image;
  const candidates = [
    img?.cachedUrl,
    img?.pngUrl,
    img?.thumbnailUrl,
    img?.originalUrl,
    nft?.media?.[0]?.gateway,
    nft?.media?.[0]?.raw,
  ];
  for (const c of candidates) {
    const n = normalizeImageUrl(c);
    if (n && (n.startsWith("http://") || n.startsWith("https://"))) return n;
  }
  const meta = parseMetadata(nft?.rawMetadata ?? nft?.metadata);
  if (meta?.image) {
    const n = normalizeImageUrl(String(meta.image));
    if (n) return n;
  }
  const tokenUri = nft?.tokenUri?.gateway || nft?.tokenUri?.raw || nft?.tokenUri;
  if (typeof tokenUri === "string" && tokenUri.startsWith("http")) {
    return normalizeImageUrl(tokenUri);
  }
  return "";
}

function parseTokenId(nft) {
  const raw = nft?.tokenId ?? nft?.id?.tokenId;
  if (raw == null) return "";
  const s = String(raw);
  if (s.startsWith("0x")) {
    try {
      return String(parseInt(s, 16));
    } catch {
      return s;
    }
  }
  return s.replace(/^#/, "");
}

function normalizeTraits(raw) {
  const traits = {};
  if (!raw || typeof raw !== "object") return traits;

  const attrs = raw.attributes || raw.properties?.attributes;
  if (Array.isArray(attrs)) {
    for (const attr of attrs) {
      if (!attr || typeof attr !== "object") continue;
      const type = attr.trait_type ?? attr.traitType ?? attr.name;
      const value = attr.value;
      if (type == null || value == null) continue;
      traits[String(type).trim()] = String(value).trim();
    }
  }
  return traits;
}

function normalizeNftRecord(nft) {
  const tokenId = parseTokenId(nft);
  if (!tokenId) return null;

  const meta = parseMetadata(nft?.rawMetadata ?? nft?.metadata) || {};
  let traits = normalizeTraits(meta);
  if (!Object.keys(traits).length) {
    traits = normalizeTraits(nft);
  }

  const name =
    (typeof nft?.name === "string" && nft.name) ||
    (typeof meta?.name === "string" && meta.name) ||
    `Token #${tokenId}`;

  const image = pickImageUrl(nft);

  const tokenUriRaw =
    nft?.tokenUri?.raw ||
    nft?.tokenUri?.gateway ||
    (typeof nft?.tokenUri === "string" ? nft.tokenUri : "") ||
    "";

  return {
    tokenId,
    name,
    description: typeof meta?.description === "string" ? meta.description : "",
    image,
    traits,
    tokenUri: tokenUriRaw,
  };
}

function collectionInfoFromMeta(contractMeta) {
  return {
    collectionName:
      contractMeta?.name ||
      contractMeta?.openSeaMetadata?.collectionName ||
      contractMeta?.contractMetadata?.name ||
      "Unknown Collection",
    symbol: contractMeta?.symbol || contractMeta?.contractMetadata?.symbol || "",
    totalSupply: Number(
      contractMeta?.totalSupply || contractMeta?.contractMetadata?.totalSupply || 0,
    ),
    tokenStandard:
      contractMeta?.tokenType || contractMeta?.contractMetadata?.tokenType || "ERC721",
  };
}

async function alchemyFetch(host, apiKey, path, params) {
  const url = new URL(`https://${host}/nft/v3/${apiKey}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Alchemy ${res.status}`);
  }
  return res.json();
}

async function fetchContractMeta(host, apiKey, contract) {
  try {
    return await alchemyFetch(host, apiKey, "getContractMetadata", {
      contractAddress: contract,
    });
  } catch {
    return null;
  }
}

/**
 * Fetch up to maxPages Alchemy pages starting at pageKey.
 * @returns {{ nfts: object[], nextPageKey: string|null }}
 */
async function fetchNftPages(host, apiKey, contract, startPageKey, maxPages, remaining) {
  const all = [];
  let pageKey = startPageKey || null;
  let pages = 0;

  while (pages < maxPages && all.length < remaining) {
    const params = {
      contractAddress: contract,
      withMetadata: "true",
      pageSize: "100",
    };
    if (pageKey) params.pageKey = pageKey;

    const data = await alchemyFetch(host, apiKey, "getNFTsForContract", params);
    const batch = data?.nfts || [];
    all.push(...batch);
    pageKey = data?.pageKey || null;
    pages += 1;

    if (!pageKey) break;
    if (all.length >= remaining) break;
  }

  return {
    nfts: all.slice(0, remaining),
    nextPageKey: pageKey,
  };
}

async function handleImport(request, env) {
  const url = new URL(request.url);
  const network = parseNetwork(url.searchParams.get("network"));
  const contract = validateContract(url.searchParams.get("contract"));

  if (!network) {
    return corsJson(
      { ok: false, error: "Invalid network. Use ethereum, base, apechain, or polygon." },
      400,
    );
  }
  if (!contract) {
    return corsJson({ ok: false, error: "Invalid contract address." }, 400);
  }

  const apiKey = getAlchemyKey(env);
  if (!apiKey) {
    return corsJson({ ok: false, error: "Missing ALCHEMY_API_KEY on worker." }, 503);
  }

  const host = NETWORKS[network];
  const startPageKey = url.searchParams.get("pageKey") || null;
  const isFirstChunk = !startPageKey;
  const alreadyImported = Math.max(
    0,
    parseInt(String(url.searchParams.get("imported") || "0"), 10) || 0,
  );

  let contractMeta = null;
  let importLimit = parseInt(String(url.searchParams.get("importLimit") || "0"), 10) || 0;

  if (isFirstChunk) {
    contractMeta = await fetchContractMeta(host, apiKey, contract);
    importLimit = resolveImportLimit(
      env,
      contractMeta,
      url.searchParams.get("limit"),
    );
  }

  if (!importLimit) {
    importLimit = getEnvMaxTokens(env);
  }

  const remaining = Math.max(0, importLimit - alreadyImported);
  if (remaining <= 0) {
    return corsJson({
      ok: true,
      complete: true,
      network,
      contract,
      importLimit,
      importedTotal: alreadyImported,
      chunkRecords: [],
      nextPageKey: null,
    });
  }

  const maxPages = getPagesPerRequest(env);
  const { nfts, nextPageKey } = await fetchNftPages(
    host,
    apiKey,
    contract,
    startPageKey,
    maxPages,
    remaining,
  );

  const chunkRecords = nfts
    .map(normalizeNftRecord)
    .filter(Boolean)
    .sort((a, b) => Number(a.tokenId) - Number(b.tokenId));

  if (isFirstChunk && !chunkRecords.length) {
    return corsJson(
      {
        ok: false,
        error: "No NFTs with metadata found for this contract on the selected network.",
        network,
        contract,
      },
      404,
    );
  }

  const importedTotal = alreadyImported + chunkRecords.length;
  const complete = importedTotal >= importLimit || !nextPageKey;

  const payload = {
    ok: true,
    network,
    contract,
    complete,
    importLimit,
    importedTotal,
    nextPageKey: complete ? null : nextPageKey,
    chunkRecords,
    chunkCount: chunkRecords.length,
  };

  if (isFirstChunk && contractMeta) {
    Object.assign(payload, collectionInfoFromMeta(contractMeta));
  }

  return corsJson(payload);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return corsJson({ ok: true, service: "nft-twin-finder-import", chunked: true });
    }

    if (request.method === "GET" && url.pathname === "/api/import-collection") {
      try {
        return await handleImport(request, env);
      } catch (e) {
        return corsJson(
          { ok: false, error: e?.message || "Import failed" },
          502,
        );
      }
    }

    return corsJson({ ok: false, error: "Not found" }, 404);
  },
};
