import { ZERO_ADDRESS } from "@/lib/wallet-dna/constants";
import type { NormalizedNFT, NormalizedNFTTransfer, SupportedChain } from "@/lib/wallet-dna/types";
import { createTokenKey, normaliseAddress, normaliseTokenId } from "@/lib/wallet-dna/utils/helpers";

export { normaliseTokenId };
import { pickNftImageUrl } from "@/lib/wallet-dna/utils/images";
import { isSpamNft } from "@/lib/wallet-dna/analysis/spam";

export function mapAlchemyOwnedNft(
  chain: SupportedChain,
  item: Record<string, unknown>,
): NormalizedNFT {
  const contractObj = item.contract as Record<string, unknown> | undefined;
  const contract = normaliseAddress(
    String(item.contractAddress ?? contractObj?.address ?? ""),
  );
  const tokenId = normaliseTokenId(item.tokenId);
  const meta = (item.raw as Record<string, unknown> | undefined)?.metadata as
    | Record<string, unknown>
    | undefined;
  const meta2 = (item.metadata ?? meta ?? {}) as Record<string, unknown>;
  const title = (meta2.name as string) ?? (item.name as string) ?? null;
  const collectionName =
    (contractObj?.name as string) ??
    ((contractObj?.openSeaMetadata as Record<string, unknown> | undefined)?.collectionName as string) ??
    ((item.collection as Record<string, unknown> | undefined)?.name as string) ??
    null;
  const imageObj = item.image as Record<string, unknown> | undefined;
  const rawImage =
    (meta2.image as string) ??
    (imageObj?.cachedUrl as string) ??
    (imageObj?.thumbnailUrl as string) ??
    (imageObj?.originalUrl as string) ??
    (typeof item.image === "string" ? item.image : null);
  const rawThumb = (imageObj?.thumbnailUrl as string) ?? (imageObj?.cachedUrl as string);
  const { imageUrl, thumbnailUrl } = pickNftImageUrl(rawImage, rawThumb);

  const tokenTypeRaw = String(
    item.tokenType ?? (contractObj?.tokenType as string | undefined) ?? "ERC721",
  ).toUpperCase();
  const tokenType =
    tokenTypeRaw.includes("1155") ? "ERC1155" : tokenTypeRaw.includes("721") ? "ERC721" : "UNKNOWN";

  const balance = Number(item.balance ?? 1) || 1;

  return {
    chain,
    contractAddress: contract,
    tokenId,
    tokenType,
    balance,
    title,
    collectionName,
    imageUrl,
    thumbnailUrl,
    acquiredAt: (item.acquiredAt as string) ?? null,
    isSpam: isSpamNft({
      contractAddress: contract,
      title,
      collectionName,
      imageUrl,
      providerSpam: Boolean(contractObj?.isSpam ?? item.isSpam),
      isHidden: Boolean(item.isHidden),
    }),
  };
}

export function mapAssetTransfer(
  chain: SupportedChain,
  item: Record<string, unknown>,
  direction: "inbound" | "outbound",
): NormalizedNFTTransfer[] {
  const category = String(item.category ?? "").toLowerCase();
  if (category !== "erc721" && category !== "erc1155") return [];

  const from = normaliseAddress(String(item.from ?? ""));
  const to = normaliseAddress(String(item.to ?? ""));
  const contractAddress = normaliseAddress(
    String((item.rawContract as Record<string, unknown> | undefined)?.address ?? ""),
  );
  if (!contractAddress) return [];

  const tx = String(item.hash ?? "");
  const blockNumber = item.blockNum != null ? String(item.blockNum) : null;
  const timestamp =
    ((item.metadata as Record<string, unknown> | undefined)?.blockTimestamp as string) ?? null;
  const isMint = from === ZERO_ADDRESS;
  const tokenType = category === "erc1155" ? "ERC1155" : "ERC721";

  const makeTransfer = (tokenId: string | null, quantity: number): NormalizedNFTTransfer => {
    const dedupeKey = `${chain}:${tx}:${item.uniqueId ?? ""}:${contractAddress}:${tokenId}:${from}:${to}:${direction}`;
    return {
      chain,
      blockNumber,
      transactionHash: tx || null,
      contractAddress,
      tokenId,
      tokenType,
      from,
      to,
      timestamp,
      direction,
      isMint,
      quantity,
      dedupeKey,
    };
  };

  if (category === "erc1155") {
    const meta = item.erc1155Metadata as Array<{ tokenId?: string; value?: string }> | undefined;
    if (meta?.length) {
      return meta.map((m) => {
        const id = normaliseTokenId(m.tokenId);
        return makeTransfer(id || null, Number(m.value != null ? BigInt(String(m.value)) : 1n) || 1);
      });
    }
    const fallbackId = normaliseTokenId(item.tokenId);
    return [makeTransfer(fallbackId || null, 1)];
  }

  const tokenId =
    normaliseTokenId(item.erc721TokenId) || normaliseTokenId(item.tokenId);
  return [makeTransfer(tokenId || null, 1)];
}

export function dedupeTransfers(transfers: NormalizedNFTTransfer[]): NormalizedNFTTransfer[] {
  const seen = new Set<string>();
  const out: NormalizedNFTTransfer[] = [];
  for (const t of transfers) {
    if (seen.has(t.dedupeKey)) continue;
    seen.add(t.dedupeKey);
    out.push(t);
  }
  return out;
}

export function groupCollections(
  nfts: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
): import("@/lib/wallet-dna/types").WalletCollectionSummary[] {
  const byKey = new Map<string, import("@/lib/wallet-dna/types").WalletCollectionSummary>();
  const now = new Date();

  for (const n of nfts) {
    if (n.isSpam) continue;
    const key = createTokenKey(n.chain, n.contractAddress, "collection");
    const ck = `${n.chain}:${n.contractAddress}`;
    let row = byKey.get(ck);
    if (!row) {
      row = {
        chain: n.chain,
        contractAddress: n.contractAddress,
        collectionName: n.collectionName ?? "Unnamed collection",
        currentQuantity: 0,
        totalInbound: 0,
        totalOutbound: 0,
        firstInteractionAt: null,
        latestInteractionAt: null,
        currentOldestHoldDays: null,
      };
      byKey.set(ck, row);
    }
    row.currentQuantity += n.balance;
  }

  for (const t of transfers) {
    const ck = `${t.chain}:${t.contractAddress}`;
    let row = byKey.get(ck);
    if (!row) {
      row = {
        chain: t.chain,
        contractAddress: t.contractAddress,
        collectionName: "Unnamed collection",
        currentQuantity: 0,
        totalInbound: 0,
        totalOutbound: 0,
        firstInteractionAt: null,
        latestInteractionAt: null,
        currentOldestHoldDays: null,
      };
      byKey.set(ck, row);
    }
    if (t.direction === "inbound") row.totalInbound += t.quantity;
    else row.totalOutbound += t.quantity;
    if (t.timestamp) {
      if (!row.firstInteractionAt || t.timestamp < row.firstInteractionAt) {
        row.firstInteractionAt = t.timestamp;
      }
      if (!row.latestInteractionAt || t.timestamp > row.latestInteractionAt) {
        row.latestInteractionAt = t.timestamp;
      }
    }
  }

  for (const n of nfts) {
    if (n.isSpam) continue;
    const ck = `${n.chain}:${n.contractAddress}`;
    const row = byKey.get(ck);
    if (!row || !n.acquiredAt) continue;
    const days = Math.floor((now.getTime() - new Date(n.acquiredAt).getTime()) / (1000 * 60 * 60 * 24));
    if (row.currentOldestHoldDays == null || days > row.currentOldestHoldDays) {
      row.currentOldestHoldDays = days;
    }
  }

  return [...byKey.values()]
    .filter((c) => c.currentQuantity > 0 || c.totalInbound > 0)
    .sort((a, b) => b.currentQuantity - a.currentQuantity);
}
