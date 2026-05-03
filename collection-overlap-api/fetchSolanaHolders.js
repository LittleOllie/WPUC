/**
 * Standalone Helius helper — not wired into `worker.js` yet.
 * Fetches unique wallet owners for a Solana collection via DAS `getAssetsByGroup`.
 */

const HELIUS_RPC = "https://mainnet.helius-rpc.com";
const PAGE_LIMIT = 1000;
const MAX_PAGES = 5000;
const RPC_TIMEOUT_MS = 25000;

function heliusApiKey(env) {
  const k = env?.HELIUS_API_KEY;
  return typeof k === "string" ? k.trim() : "";
}

/** @param {string} s */
function validateCollectionId(s) {
  const id = String(s || "").trim();
  if (!id) return null;
  const lower = id.toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(lower) || /^0x/.test(lower)) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id)) return null;
  return id;
}

/**
 * @param {string} url
 * @param {unknown} body
 * @param {AbortSignal} signal
 */
async function heliusPostJson(url, body, signal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text().catch(() => "");
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("Helius authentication failed. Check HELIUS_API_KEY.");
  }
  if (res.status === 429) {
    throw new Error("Helius rate limited (429). Please try again later.");
  }
  if (json?.error?.message) {
    throw new Error(String(json.error.message));
  }
  if (!res.ok) {
    throw new Error(`Helius request failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return json;
}

/**
 * Unique `ownership.owner` wallets for a verified Metaplex collection mint.
 * Uses env `HELIUS_API_KEY` only. No caches or shared mutable state.
 *
 * @param {string} collectionId - Collection / verified collection mint (base58)
 * @param {{ HELIUS_API_KEY?: string }} env
 * @returns {Promise<{ holders: string[], holderCount: number }>}
 */
export async function fetchSolanaHolders(collectionId, env) {
  const mint = validateCollectionId(collectionId);
  if (!mint) {
    throw new Error("Invalid collectionId: expected a Solana base58 mint (32–44 chars), not an EVM address.");
  }

  const apiKey = heliusApiKey(env);
  if (!apiKey) {
    throw new Error("Missing HELIUS_API_KEY.");
  }

  const url = `${HELIUS_RPC}/?api-key=${encodeURIComponent(apiKey)}`;
  const owners = new Set();
  let page = 1;

  while (page <= MAX_PAGES) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    let json;
    try {
      json = await heliusPostJson(
        url,
        {
          jsonrpc: "2.0",
          id: `fetch-sol-holders-${page}`,
          method: "getAssetsByGroup",
          params: {
            groupKey: "collection",
            groupValue: mint,
            page,
            limit: PAGE_LIMIT,
            sortBy: { sortBy: "none", sortDirection: "asc" },
          },
        },
        controller.signal
      );
    } finally {
      clearTimeout(tid);
    }

    const items = Array.isArray(json?.result?.items) ? json.result.items : [];

    for (const asset of items) {
      const o = asset?.ownership;
      const w = o && typeof o === "object" ? String(o.owner ?? "").trim() : "";
      if (w) owners.add(w);
    }

    if (items.length === 0) break;
    if (items.length < PAGE_LIMIT) break;
    page += 1;
  }

  const holders = Array.from(owners);
  return {
    holders,
    holderCount: holders.length,
  };
}
