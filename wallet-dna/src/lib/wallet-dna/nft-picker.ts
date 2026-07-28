import type {
  NormalizedNFT,
  ShareSelectableNFT,
  SupportedChain,
  WalletNFTCollectionOption,
  WalletNFTPickerResponse,
} from "@/lib/wallet-dna/types";
import { MAX_NFTS_PAGE_LIMIT, NFT_PICKER_PAGE_SIZE } from "@/lib/wallet-dna/constants";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";
import { createTokenKey, normaliseAddress } from "@/lib/wallet-dna/utils/helpers";
import { hasDisplayableImage } from "@/lib/wallet-dna/utils/images";

export type PickerQuery = {
  chain?: SupportedChain;
  contract?: string;
  cursor?: string;
  limit?: number;
  search?: string;
  chainFilter?: SupportedChain;
  keys?: string[];
  hiddenCollectionKeys?: string[];
  showHiddenCollections?: boolean;
};

function parseCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const n = parseInt(cursor, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function buildCollectionOptions(nfts: NormalizedNFT[]): WalletNFTCollectionOption[] {
  const map = new Map<string, WalletNFTCollectionOption>();

  for (const n of nfts) {
    if (n.isSpam) continue;
    const key = collectionKey(n.chain, n.contractAddress);
    const existing = map.get(key);
    const image = n.thumbnailUrl ?? n.imageUrl;
    if (existing) {
      existing.quantity += n.balance;
      if (!existing.representativeImageUrl && image) {
        existing.representativeImageUrl = image;
      }
    } else {
      map.set(key, {
        key,
        chain: n.chain,
        contractAddress: normaliseAddress(n.contractAddress),
        name: n.collectionName ?? "Unnamed collection",
        quantity: n.balance,
        representativeImageUrl: image,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    return a.name.localeCompare(b.name);
  });
}

function matchesSearch(nft: NormalizedNFT, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const title = (nft.title ?? "").toLowerCase();
  const tokenId = String(nft.tokenId).toLowerCase();
  const collection = (nft.collectionName ?? "").toLowerCase();
  return title.includes(q) || tokenId.includes(q) || collection.includes(q);
}

export function filterPickerNfts(all: NormalizedNFT[], query: PickerQuery): NormalizedNFT[] {
  const hidden = new Set(query.hiddenCollectionKeys ?? []);
  const showHidden = query.showHiddenCollections ?? false;

  let pool = all.filter((n) => {
    if (n.isSpam) return false;
    const ck = collectionKey(n.chain, n.contractAddress);
    if (!showHidden && hidden.has(ck)) return false;
    return true;
  });

  if (query.keys?.length) {
    const keySet = new Set(query.keys);
    return pool.filter((n) => keySet.has(createTokenKey(n.chain, n.contractAddress, n.tokenId)));
  }

  if (query.chain && query.contract) {
    const contract = normaliseAddress(query.contract);
    pool = pool.filter(
      (n) => n.chain === query.chain && normaliseAddress(n.contractAddress) === contract,
    );
  }

  if (query.chainFilter) {
    pool = pool.filter((n) => n.chain === query.chainFilter);
  }

  if (query.search) {
    pool = pool.filter((n) => matchesSearch(n, query.search!));
  }

  pool.sort((a, b) => {
    const aImg = hasDisplayableImage(a) ? 0 : 1;
    const bImg = hasDisplayableImage(b) ? 0 : 1;
    if (aImg !== bImg) return aImg - bImg;
    const ac = (a.collectionName ?? "").localeCompare(b.collectionName ?? "");
    if (ac !== 0) return ac;
    return String(a.tokenId).localeCompare(String(b.tokenId), undefined, { numeric: true });
  });

  return pool;
}

export function queryWalletNfts(
  all: NormalizedNFT[],
  query: PickerQuery,
): WalletNFTPickerResponse {
  const limit = Math.min(Math.max(query.limit ?? NFT_PICKER_PAGE_SIZE, 1), MAX_NFTS_PAGE_LIMIT);
  const offset = parseCursor(query.cursor);
  const filtered = filterPickerNfts(all, query);
  const page = filtered.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const collections =
    !query.keys?.length && offset === 0
      ? buildCollectionOptions(all.filter((n) => !n.isSpam))
      : [];

  return {
    nfts: page as ShareSelectableNFT[],
    nextCursor: nextOffset < filtered.length ? String(nextOffset) : null,
    total: filtered.length,
    collections,
  };
}

export function isCollectionInWallet(
  all: NormalizedNFT[],
  chain: SupportedChain,
  contract: string,
): boolean {
  const target = normaliseAddress(contract);
  return all.some(
    (n) =>
      !n.isSpam &&
      n.chain === chain &&
      normaliseAddress(n.contractAddress) === target,
  );
}
