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

const WORKER_URL = "https://loflexgrid.littleollienft.workers.dev";

function corsResponse(body, status = 200, contentType = "application/json") {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType, ...CORS },
  });
}

async function handleApiNfts(request, apiKey) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const chain = url.searchParams.get("chain") || "eth";
  const contractAddressesParam = url.searchParams.get("contractAddresses");

  if (!owner || String(owner).trim() === "") {
    return corsResponse(JSON.stringify({ error: "Missing owner" }), 400);
  }

  const ownerVal = owner.trim().toLowerCase();
  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  const baseUrl = `https://${host}/v2/${apiKey}/getNFTsForOwner`;
  const allNFTs = [];
  let pageKey = null;

  const contractAddresses = contractAddressesParam
    ? contractAddressesParam.split(",").map(a => a.trim().toLowerCase()).filter(a => /^0x[a-f0-9]{40}$/.test(a))
    : null;

  try {
    do {
      const params = new URLSearchParams({
        owner: ownerVal,
        withMetadata: "true",
        pageSize: "100",
      });
      if (pageKey) params.set("pageKey", pageKey);
      if (contractAddresses?.length) {
        contractAddresses.forEach(addr => params.append("contractAddresses[]", addr));
      }

      const fetchUrl = `${baseUrl}?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        const errMsg = text || `Alchemy ${res.status}`;
        return corsResponse(JSON.stringify({ error: errMsg }), 502);
      }

      const data = await res.json().catch(() => ({}));
      if (data?.error?.message) {
        return corsResponse(JSON.stringify({ error: data.error.message }), 502);
      }
      const nfts = data.ownedNfts || [];
      for (const n of nfts) allNFTs.push(n);

      pageKey = data.pageKey || null;
    } while (pageKey);

    console.log(`total NFTs fetched: ${allNFTs.length}`);

    const cleaned = allNFTs.map(nft => {
      const image =
        nft?.metadata?.image ||
        nft?.media?.[0]?.gateway ||
        nft?.media?.[0]?.raw ||
        nft?.contractMetadata?.openSea?.imageUrl ||
        null;

      return {
        ...nft,
        contract: nft.contract || { address: nft.contract?.address },
        contractAddress: nft.contract?.address,
        name: nft.title || nft.metadata?.name || nft.name || "Unknown",
        image: image || nft?.image,
        metadata: { ...(nft?.metadata || {}), image: image || nft?.metadata?.image },
        media: nft?.media?.length ? nft.media : (image ? [{ gateway: image, raw: image }] : []),
        collection: nft.collection || { name: nft.contractMetadata?.name || "Unknown Collection" },
        contractMetadata: nft.contractMetadata || { name: nft.contractMetadata?.name || "Unknown Collection" },
        tokenId: nft.id?.tokenId ?? nft.tokenId,
        id: nft.id || { tokenId: nft.id?.tokenId ?? nft.tokenId },
        balance: nft.balance ?? "1",
        tokenType: nft.tokenType || nft.id?.tokenMetadata?.tokenType || "ERC721",
      };
    });

    return corsResponse(JSON.stringify({
      nfts: cleaned
    }));
  } catch (e) {
    const msg = e?.name === "AbortError"
      ? "Request timed out. Try again with fewer wallets."
      : (e?.message || "NFT fetch failed");
    return corsResponse(JSON.stringify({ error: msg }), 502);
  }
}

async function handleApiNftMetadata(request, apiKey) {
  const url = new URL(request.url);
  const contract = url.searchParams.get("contract");
  const tokenId = url.searchParams.get("tokenId");
  const chain = url.searchParams.get("chain") || "eth";

  if (!contract || !tokenId) {
    return corsResponse(JSON.stringify({ error: "Missing contract or tokenId" }), 400);
  }

  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
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
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const apiKey = env.ALCHEMY_API_KEY;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const isConfigPath =
      url.pathname === "/api/config/flex-grid" || url.pathname === "/api/config/flexgrid";

    if (isConfigPath && request.method === "GET") {
      return corsResponse(JSON.stringify({
        workerUrl: `${WORKER_URL}/img?url=`,
        network: "eth-mainnet",
      }));
    }

    if (url.pathname === "/img" && request.method === "GET") {
      let imageUrl = url.searchParams.get("url");
      if (!imageUrl || !imageUrl.trim()) {
        return new Response("Missing URL", { status: 400, headers: CORS });
      }
      imageUrl = imageUrl.trim();

      const fetchOpts = {
        redirect: "follow",
        headers: { "User-Agent": "FlexGrid-ImageProxy/1.0" },
      };

      const IPFS_GATEWAYS = [
        "https://nftstorage.link/ipfs/",
        "https://cloudflare-ipfs.com/ipfs/",
        "https://dweb.link/ipfs/",
        "https://w3s.link/ipfs/",
        "https://ipfs.io/ipfs/",
      ];

      function getIpfsPath(u) {
        if (!u) return null;
        const s = String(u).trim();
        if (s.startsWith("ipfs://")) {
          return s.replace(/^ipfs:\/\//, "").replace(/^ipfs\//, "").replace(/^\/+/, "");
        }
        try {
          const parsed = new URL(s);
          const m = parsed.pathname.match(/\/ipfs\/(.+)/);
          return m ? decodeURIComponent(m[1]) : null;
        } catch (_) {
          return null;
        }
      }

      function tryGateways(ipfsPath) {
        return IPFS_GATEWAYS.map((g) => g + ipfsPath);
      }

      async function fetchImage(targetUrl) {
        const res = await fetch(targetUrl, fetchOpts);
        if (!res.ok) return null;
        const contentType = res.headers.get("Content-Type") || "image/png";
        return new Response(res.body, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }

      const cid = getIpfsPath(imageUrl);
      const urlsToTry = cid
        ? [imageUrl, ...tryGateways(cid)]
        : [imageUrl];

      for (const targetUrl of urlsToTry) {
        try {
          const response = await fetchImage(targetUrl);
          if (response) return response;
        } catch (_) {}
      }

      // Return 404 so frontend can fall through to direct gateway candidates.
      // Previously returned 200 with placeholder, causing "success" and never trying direct URLs.
      return new Response("Image unavailable", { status: 404, headers: CORS });
    }

    if (!apiKey || typeof apiKey !== "string") {
      return corsResponse(JSON.stringify({ error: "Server configuration error. Contact site owner." }), 503);
    }

    if (url.pathname === "/api/nfts" && request.method === "GET") {
      return handleApiNfts(request, apiKey);
    }

    if (url.pathname === "/api/nft-metadata" && request.method === "GET") {
      return handleApiNftMetadata(request, apiKey);
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
