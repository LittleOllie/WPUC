/**
 * NFT Twin Finder — Contract Import API
 * GET /api/import-collection?network=ethereum&contract=0x...
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

const DEFAULT_MAX_TOKENS = 2000;

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

function getMaxTokens(env) {
  const raw = env.IMPORT_MAX_TOKENS;
  if (raw == null || raw === "") return DEFAULT_MAX_TOKENS;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_TOKENS;
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
  const name =
    (typeof nft?.name === "string" && nft.name) ||
    (typeof meta?.name === "string" && meta.name) ||
    `Token #${tokenId}`;

  const traits = normalizeTraits(meta);
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

function classifyUri(uri) {
  if (!uri || typeof uri !== "string") return "unknown";
  if (uri.startsWith("data:")) return "on-chain";
  if (uri.startsWith("ipfs://") || uri.includes("/ipfs/")) return "ipfs";
  if (uri.startsWith("ar://") || uri.includes("arweave.net")) return "arweave";
  if (uri.startsWith("http://") || uri.startsWith("https://")) return "https";
  return "unknown";
}

function detectMetadataSource(records) {
  const uris = records
    .map((r) => r.tokenUri)
    .filter(Boolean)
    .slice(0, 12);

  if (!uris.length) {
    return {
      type: "alchemy-resolved",
      description: "Metadata resolved by Alchemy (no tokenURI exposed in samples)",
      sampleTokenUri: null,
      pattern: null,
      hosts: [],
    };
  }

  const types = [...new Set(uris.map(classifyUri))];
  let pattern = null;

  if (uris.length >= 2) {
    const a = uris[0];
    const b = uris[1];
    let prefix = "";
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) prefix += a[i];
      else break;
    }
    const lastSlash = prefix.lastIndexOf("/");
    if (lastSlash > 8) {
      pattern = `${prefix.slice(0, lastSlash + 1)}{id}`;
      if (a.endsWith(".json") || b.endsWith(".json")) pattern += ".json";
    }
  }

  const hosts = [
    ...new Set(
      uris
        .filter((u) => u.startsWith("http"))
        .map((u) => {
          try {
            return new URL(u).host;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    ),
  ];

  return {
    type: types.length === 1 ? types[0] : "mixed",
    description: `Detected from ${uris.length} sample tokenURI(s) via Alchemy`,
    sampleTokenUri: uris[0],
    pattern,
    hosts,
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

async function fetchAllContractNfts(host, apiKey, contract, maxTokens) {
  const all = [];
  let pageKey = null;
  let pages = 0;
  const maxPages = Math.ceil(maxTokens / 100) + 2;

  do {
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

    if (all.length >= maxTokens) break;
  } while (pageKey && pages < maxPages);

  return all.slice(0, maxTokens);
}

function buildOutput(network, contract, contractMeta, records, maxTokens) {
  const metadata = {};
  const images = {};

  for (const rec of records) {
    metadata[rec.tokenId] = {
      name: rec.name,
      traits: rec.traits,
    };
    if (rec.description) metadata[rec.tokenId].description = rec.description;
    if (rec.image) images[rec.tokenId] = rec.image;
  }

  const collectionName =
    contractMeta?.name ||
    contractMeta?.openSeaMetadata?.collectionName ||
    contractMeta?.contractMetadata?.name ||
    "Unknown Collection";

  const symbol =
    contractMeta?.symbol || contractMeta?.contractMetadata?.symbol || "";

  const totalSupply =
    contractMeta?.totalSupply ||
    contractMeta?.contractMetadata?.totalSupply ||
    records.length;

  const tokenStandard =
    contractMeta?.tokenType ||
    contractMeta?.contractMetadata?.tokenType ||
    "ERC721";

  const metadataSource = detectMetadataSource(records);

  const sampleIds = ["1", "0", records[0]?.tokenId].filter(Boolean);
  const samples = [];
  for (const id of sampleIds) {
    const hit = records.find((r) => r.tokenId === id);
    if (hit && !samples.some((s) => s.tokenId === hit.tokenId)) samples.push(hit);
  }
  for (const rec of records) {
    if (samples.length >= 3) break;
    if (!samples.some((s) => s.tokenId === rec.tokenId)) samples.push(rec);
  }

  return {
    ok: true,
    network,
    contract,
    collectionName,
    symbol,
    totalSupply: Number(totalSupply) || records.length,
    tokenStandard,
    metadataSource,
    importedCount: records.length,
    cappedAt: records.length >= maxTokens ? maxTokens : null,
    samples: samples.map((s) => ({
      tokenId: s.tokenId,
      name: s.name,
      image: s.image,
      traits: s.traits,
      tokenUri: s.tokenUri || null,
    })),
    metadata,
    images,
  };
}

async function handleImport(request, env) {
  const url = new URL(request.url);
  const network = parseNetwork(url.searchParams.get("network"));
  const contract = validateContract(url.searchParams.get("contract"));

  if (!network) {
    return corsJson({ ok: false, error: "Invalid network. Use ethereum, base, apechain, or polygon." }, 400);
  }
  if (!contract) {
    return corsJson({ ok: false, error: "Invalid contract address." }, 400);
  }

  const apiKey = getAlchemyKey(env);
  if (!apiKey) {
    return corsJson({ ok: false, error: "Missing ALCHEMY_API_KEY_NFT_IMPORT on worker." }, 503);
  }

  const maxTokens = getMaxTokens(env);
  const host = NETWORKS[network];

  const [contractMeta, rawNfts] = await Promise.all([
    fetchContractMeta(host, apiKey, contract),
    fetchAllContractNfts(host, apiKey, contract, maxTokens),
  ]);

  const records = rawNfts
    .map(normalizeNftRecord)
    .filter(Boolean)
    .sort((a, b) => Number(a.tokenId) - Number(b.tokenId));

  if (!records.length) {
    return corsJson({
      ok: false,
      error: "No NFTs with metadata found for this contract on the selected network.",
      network,
      contract,
    }, 404);
  }

  return corsJson(buildOutput(network, contract, contractMeta, records, maxTokens));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return corsJson({ ok: true, service: "nft-twin-finder-import" });
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
