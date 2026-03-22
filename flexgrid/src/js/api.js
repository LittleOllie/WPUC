/**
 * API layer — NFT fetching from Worker and Zora.
 * No DOM dependencies.
 */

const WORKER_BASE = "https://loflexgrid.littleollienft.workers.dev";
const NFT_FETCH_TIMEOUT_MS = 35000;

export async function fetchNFTsFromWorker({ wallet, chain }) {
  const chainParam = chain || "eth";
  const url = `${WORKER_BASE}/api/nfts?owner=${encodeURIComponent(wallet)}&chain=${chainParam}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NFT_FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Try with fewer wallets or try again.");
    }
    throw new Error(e?.message || "NFT fetch failed");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `NFT fetch failed (${res.status})`);
  }

  const json = await res.json();
  return json.nfts || [];
}

export async function fetchNFTsFromZora({ wallet, contractAddress }) {
  const query = `query($owner: String!, $contract: String!, $after: String) {
    tokens(
      networks: [{network: ETHEREUM, chain: MAINNET}]
      pagination: {limit: 100, after: $after}
      where: {ownerAddresses: [$owner], collectionAddresses: [$contract]}
    ) {
      nodes {
        token {
          collectionAddress
          tokenId
          name
          image { url }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const all = [];
  let after = null;
  for (let page = 0; page < 25; page++) {
    const res = await fetch("https://api.zora.co/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { owner: wallet, contract: contractAddress, after },
      }),
    });
    if (!res.ok) break;
    const json = await res.json().catch(() => ({}));
    const nodes = json?.data?.tokens?.nodes ?? [];
    for (const n of nodes) {
      const t = n?.token;
      if (!t?.tokenId) continue;
      const img = t?.image;
      const imgUrl = typeof img === "object" && img ? img?.url : null;
      all.push({
        contract: { address: (t.collectionAddress || contractAddress).toLowerCase(), name: "" },
        contractAddress: (t.collectionAddress || contractAddress).toLowerCase(),
        tokenId: String(t.tokenId),
        name: t?.name || `#${t.tokenId}`,
        image: imgUrl ? { cachedUrl: imgUrl, originalUrl: imgUrl } : null,
      });
    }
    const hasNext = json?.data?.tokens?.pageInfo?.hasNextPage;
    if (!hasNext) break;
    after = json?.data?.tokens?.pageInfo?.endCursor;
  }
  return all;
}

export { WORKER_BASE };
