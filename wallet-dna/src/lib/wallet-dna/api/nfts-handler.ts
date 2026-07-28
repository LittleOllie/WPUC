import { getCachedIncludedNfts } from "@/lib/wallet-dna/cache";
import { cacheKeyForWallet } from "@/lib/wallet-dna/env";
import { queryWalletNfts, isCollectionInWallet } from "@/lib/wallet-dna/nft-picker";
import { resolveWalletInput } from "@/lib/wallet-dna/utils/ens";
import { isValidEthAddress, normaliseAddress } from "@/lib/wallet-dna/utils/helpers";
import type { SupportedChain } from "@/lib/wallet-dna/types";
import { MAX_NFTS_PAGE_LIMIT } from "@/lib/wallet-dna/constants";

function parseChain(v: string | null): SupportedChain | undefined {
  if (v === "ethereum" || v === "base") return v;
  return undefined;
}

export async function handleWalletNftsRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;
  const walletInput = params.get("wallet")?.trim();
  if (!walletInput) {
    return Response.json(
      { success: false, error: { code: "INVALID_WALLET", message: "Wallet address is required." } },
      { status: 400 },
    );
  }

  try {
    const { address } = await resolveWalletInput(walletInput);
    if (!isValidEthAddress(address)) {
      return Response.json(
        { success: false, error: { code: "INVALID_WALLET", message: "Invalid wallet address." } },
        { status: 400 },
      );
    }

    const cacheKey = cacheKeyForWallet(address);
    const included = getCachedIncludedNfts(cacheKey);
    if (!included) {
      return Response.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Run Wallet DNA analysis first to browse NFTs.",
          },
        },
        { status: 404 },
      );
    }

    const chain = parseChain(params.get("chain"));
    const contractRaw = params.get("contract");
    const contract = contractRaw ? normaliseAddress(contractRaw) : undefined;

    if (contract && !/^0x[a-f0-9]{40}$/.test(contract)) {
      return Response.json(
        { success: false, error: { code: "INVALID_WALLET", message: "Invalid contract address." } },
        { status: 400 },
      );
    }

    if (chain && contract && !isCollectionInWallet(included, chain, contract)) {
      return Response.json(
        { success: false, error: { code: "INVALID_WALLET", message: "Collection not found in this wallet." } },
        { status: 403 },
      );
    }

    const limitRaw = parseInt(params.get("limit") ?? "24", 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_NFTS_PAGE_LIMIT)
      : 24;

    const keysParam = params.get("keys");
    const keys = keysParam
      ? keysParam.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined;

    const data = queryWalletNfts(included, {
      chain,
      contract,
      cursor: params.get("cursor") ?? undefined,
      limit,
      search: params.get("search") ?? undefined,
      chainFilter: parseChain(params.get("chainFilter")),
      keys,
    });

    return Response.json({ success: true, data });
  } catch {
    return Response.json(
      { success: false, error: { code: "INVALID_WALLET", message: "Could not resolve wallet." } },
      { status: 400 },
    );
  }
}
