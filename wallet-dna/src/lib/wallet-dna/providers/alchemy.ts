import { ALCHEMY_HOSTS } from "@/lib/wallet-dna/constants";
import type { AnalysisCoverage, ChainCoverage, SupportedChain } from "@/lib/wallet-dna/types";
import {
  dedupeTransfers,
  mapAlchemyOwnedNft,
  mapAssetTransfer,
} from "@/lib/wallet-dna/analysis/normalise";
import type { NormalizedNFT, NormalizedNFTTransfer } from "@/lib/wallet-dna/types";

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string, retries = 2): Promise<T> {
  let lastErr: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.status === 429) throw new Error("PROVIDER_RATE_LIMIT");
      if (res.status === 401 || res.status === 403) throw new Error("PROVIDER_AUTH");
      if (!res.ok) throw new Error(`PROVIDER_UNAVAILABLE:${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.message === "PROVIDER_RATE_LIMIT" || lastErr.message === "PROVIDER_AUTH") throw lastErr;
      if (i < retries) await sleep(400 * (i + 1));
    }
  }
  throw lastErr ?? new Error("PROVIDER_UNAVAILABLE");
}

async function alchemyRpc<T>(
  chain: SupportedChain,
  apiKey: string,
  method: string,
  params: unknown[],
  retries = 2,
): Promise<T> {
  const host = ALCHEMY_HOSTS[chain];
  let lastErr: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`https://${host}/v2/${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (res.status === 429) throw new Error("PROVIDER_RATE_LIMIT");
      if (res.status === 401 || res.status === 403) throw new Error("PROVIDER_AUTH");
      if (!res.ok) throw new Error(`PROVIDER_UNAVAILABLE:${res.status}`);

      const json = (await res.json()) as { result?: T; error?: { message?: string; code?: number } };
      if (json.error) {
        throw new Error(`PROVIDER_UNAVAILABLE:${json.error.code ?? json.error.message ?? "rpc"}`);
      }
      return json.result as T;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.message === "PROVIDER_RATE_LIMIT" || lastErr.message === "PROVIDER_AUTH") throw lastErr;
      if (i < retries) await sleep(400 * (i + 1));
    }
  }
  throw lastErr ?? new Error("PROVIDER_UNAVAILABLE");
}

type AssetTransferDirection = "inbound" | "outbound";

async function fetchAssetTransferDirection(
  chain: SupportedChain,
  wallet: string,
  apiKey: string,
  direction: AssetTransferDirection,
  maxRemaining: number,
): Promise<{ transfers: NormalizedNFTTransfer[]; complete: boolean; capped: boolean }> {
  const raw: NormalizedNFTTransfer[] = [];
  let pageKey: string | undefined;
  let capped = false;

  while (raw.length < maxRemaining) {
    const pageSize = Math.min(100, maxRemaining - raw.length);
    const params: Record<string, unknown> = {
      fromBlock: "0x0",
      toBlock: "latest",
      category: ["erc721", "erc1155"],
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: `0x${pageSize.toString(16)}`,
      order: "desc",
    };
    if (direction === "inbound") params.toAddress = wallet;
    else params.fromAddress = wallet;
    if (pageKey) params.pageKey = pageKey;

    const result = await alchemyRpc<{
      transfers?: Record<string, unknown>[];
      pageKey?: string;
    }>(chain, apiKey, "alchemy_getAssetTransfers", [params]);

    for (const item of result.transfers ?? []) {
      for (const mapped of mapAssetTransfer(chain, item, direction)) {
        raw.push(mapped);
        if (raw.length >= maxRemaining) {
          capped = true;
          break;
        }
      }
      if (capped) break;
    }

    pageKey = result.pageKey;
    if (!pageKey || capped) break;
  }

  return { transfers: raw, complete: !pageKey && !capped, capped };
}

export async function fetchOwnedNfts(
  chain: SupportedChain,
  wallet: string,
  apiKey: string,
): Promise<{ nfts: NormalizedNFT[]; complete: boolean }> {
  const host = ALCHEMY_HOSTS[chain];
  const nfts: NormalizedNFT[] = [];
  let pageKey: string | undefined;
  let pages = 0;
  const maxPages = 50;

  while (pages < maxPages) {
    const params = new URLSearchParams({
      owner: wallet,
      withMetadata: "true",
      pageSize: "100",
    });
    if (pageKey) params.set("pageKey", pageKey);

    const url = `https://${host}/nft/v3/${apiKey}/getNFTsForOwner?${params}`;
    const json = await fetchJson<{ ownedNfts?: Record<string, unknown>[]; pageKey?: string }>(url);

    for (const item of json.ownedNfts ?? []) {
      nfts.push(mapAlchemyOwnedNft(chain, item));
    }
    pageKey = json.pageKey;
    pages++;
    if (!pageKey) break;
  }

  return { nfts, complete: !pageKey };
}

export async function fetchTransfersForOwner(
  chain: SupportedChain,
  wallet: string,
  apiKey: string,
  maxTransfers: number,
): Promise<{ transfers: NormalizedNFTTransfer[]; coverage: ChainCoverage }> {
  const perDirection = Math.ceil(maxTransfers / 2);
  const [inbound, outbound] = await Promise.all([
    fetchAssetTransferDirection(chain, wallet, apiKey, "inbound", perDirection),
    fetchAssetTransferDirection(chain, wallet, apiKey, "outbound", perDirection),
  ]);

  const transfers = dedupeTransfers([...inbound.transfers, ...outbound.transfers]);
  const capped = inbound.capped || outbound.capped;

  return {
    transfers,
    coverage: {
      ownershipComplete: true,
      inboundTransfersComplete: inbound.complete,
      outboundTransfersComplete: outbound.complete,
      transferCountAnalysed: transfers.length,
      capped,
    },
  };
}

export async function fetchWalletChainData(
  wallet: string,
  apiKey: string,
  maxTransfersPerChain: number,
): Promise<{
  nfts: NormalizedNFT[];
  transfers: NormalizedNFTTransfer[];
  coverage: AnalysisCoverage;
}> {
  const nfts: NormalizedNFT[] = [];
  const transfers: NormalizedNFTTransfer[] = [];
  const coverage: AnalysisCoverage = {
    ethereum: {
      ownershipComplete: false,
      inboundTransfersComplete: false,
      outboundTransfersComplete: false,
      transferCountAnalysed: 0,
      capped: false,
    },
    base: {
      ownershipComplete: false,
      inboundTransfersComplete: false,
      outboundTransfersComplete: false,
      transferCountAnalysed: 0,
      capped: false,
    },
  };

  const chains: SupportedChain[] = ["ethereum", "base"];
  const chainResults = await Promise.all(
    chains.map(async (chain) => {
      const [owned, tx] = await Promise.all([
        fetchOwnedNfts(chain, wallet, apiKey),
        fetchTransfersForOwner(chain, wallet, apiKey, maxTransfersPerChain),
      ]);
      return { chain, owned, tx };
    }),
  );

  for (const { chain, owned, tx } of chainResults) {
    nfts.push(...owned.nfts);
    transfers.push(...tx.transfers);
    coverage[chain] = {
      ...tx.coverage,
      ownershipComplete: owned.complete,
    };
  }

  return { nfts, transfers, coverage };
}
