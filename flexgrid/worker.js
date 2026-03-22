const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const ALCHEMY_HOSTS = {
  eth: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
};

const CONFIG = {
  alchemyApiKey: "2LxYSccU9cpZLJ3HEjV6Q",
  network: "eth-mainnet",
  ipfsGateway: "https://ipfs.io/ipfs/",
  workerUrl: "https://loflexgrid.littleollienft.workers.dev/img?url=",
};

function corsResponse(body, status = 200, contentType = "application/json") {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType, ...CORS },
  });
}

async function handleApiNfts(request) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const chain = url.searchParams.get("chain") || "eth";

  if (!owner || String(owner).trim() === "") {
    return corsResponse(JSON.stringify({ error: "Missing owner" }), 400);
  }

  const ownerVal = owner.trim();
  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  const apiKey = CONFIG.alchemyApiKey;
  const baseUrl = `https://${host}/v2/${apiKey}/getNFTsForOwner`;
  const allNFTs = [];
  let pageKey = null;

  try {
    do {
      const params = new URLSearchParams({
        owner: ownerVal,
        withMetadata: "true",
        pageSize: "100",
      });
      if (pageKey) params.set("pageKey", pageKey);

      const fetchUrl = `${baseUrl}?${params.toString()}`;
      const res = await fetch(fetchUrl);

      if (!res.ok) {
        const text = await res.text();
        return corsResponse(JSON.stringify({ error: text || `Alchemy ${res.status}` }), 502);
      }

      const data = await res.json();
      const nfts = data.ownedNfts || [];
      for (const n of nfts) allNFTs.push(n);

      pageKey = data.pageKey || null;
    } while (pageKey);

    console.log(`total NFTs fetched: ${allNFTs.length}`);

    return corsResponse(JSON.stringify({ nfts: allNFTs }));
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e?.message || "NFT fetch failed" }), 502);
  }
}

async function handleApiNftMetadata(request) {
  const url = new URL(request.url);
  const contract = url.searchParams.get("contract");
  const tokenId = url.searchParams.get("tokenId");
  const chain = url.searchParams.get("chain") || "eth";

  if (!contract || !tokenId) {
    return corsResponse(JSON.stringify({ error: "Missing contract or tokenId" }), 400);
  }

  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  const apiKey = CONFIG.alchemyApiKey;
  const metaUrl = `https://${host}/nft/v3/${apiKey}/getNFTMetadata?contractAddress=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(tokenId)}&refreshCache=false`;

  try {
    const res = await fetch(metaUrl);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "Metadata error");
    return corsResponse(JSON.stringify(json));
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e?.message || "Metadata fetch failed" }), 502);
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const isConfigPath =
      url.pathname === "/api/config/flex-grid" || url.pathname === "/api/config/flexgrid";

    if (isConfigPath && request.method === "GET") {
      return corsResponse(JSON.stringify(CONFIG));
    }

    if (url.pathname === "/api/nfts" && request.method === "GET") {
      return handleApiNfts(request);
    }

    if (url.pathname === "/api/nft-metadata" && request.method === "GET") {
      return handleApiNftMetadata(request);
    }

    if (url.pathname === "/img" && request.method === "GET") {
      const imageUrl = url.searchParams.get("url");
      if (!imageUrl) {
        return new Response("Missing URL", { status: 400, headers: CORS });
      }
      try {
        const res = await fetch(imageUrl, {
          headers: { "User-Agent": "FlexGrid-ImageProxy/1.0" },
        });
        if (!res.ok) throw new Error("Upstream error");
        const headers = new Headers(res.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Cache-Control", "public, max-age=86400");
        return new Response(res.body, { status: res.status, headers });
      } catch (e) {
        return new Response("Proxy error", { status: 502, headers: CORS });
      }
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
