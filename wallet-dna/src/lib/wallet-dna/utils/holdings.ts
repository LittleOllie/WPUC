import type { NormalizedNFT, NormalizedNFTTransfer } from "@/lib/wallet-dna/types";
import { createTokenKey, normaliseAddress } from "@/lib/wallet-dna/utils/helpers";

export type EnrichedNFT = NormalizedNFT & {
  currentHoldStartedAt: string | null;
  currentHoldDays: number | null;
};

export type TransferIndex = Map<string, NormalizedNFTTransfer[]>;

export function buildTransferIndex(transfers: NormalizedNFTTransfer[]): TransferIndex {
  const index: TransferIndex = new Map();
  for (const t of transfers) {
    if (t.tokenId == null) continue;
    const key = createTokenKey(t.chain, t.contractAddress, t.tokenId);
    const bucket = index.get(key);
    if (bucket) bucket.push(t);
    else index.set(key, [t]);
  }
  return index;
}

function transfersForToken(
  chain: NormalizedNFT["chain"],
  contractAddress: string,
  tokenId: string,
  index: TransferIndex,
): NormalizedNFTTransfer[] {
  return index.get(createTokenKey(chain, contractAddress, tokenId)) ?? [];
}

function sortTransfers(transfers: NormalizedNFTTransfer[]): NormalizedNFTTransfer[] {
  return [...transfers].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return (a.blockNumber ?? "").localeCompare(b.blockNumber ?? "");
  });
}

/** Latest inbound transfer to this wallet for a token (within fetched history). */
export function latestInboundToWallet(
  wallet: string,
  chain: NormalizedNFT["chain"],
  contractAddress: string,
  tokenId: string,
  transfers: NormalizedNFTTransfer[],
  index?: TransferIndex,
): string | null {
  const idx = index ?? buildTransferIndex(transfers);
  const walletNorm = normaliseAddress(wallet);
  let latest: string | null = null;

  for (const t of transfersForToken(chain, contractAddress, tokenId, idx)) {
    if (t.direction !== "inbound") continue;
    if (normaliseAddress(t.to) !== walletNorm) continue;
    const ts = parseValidTimestamp(t.timestamp);
    if (!ts) continue;
    if (!latest || new Date(ts).getTime() > new Date(latest).getTime()) latest = ts;
  }

  return latest;
}

/** Earliest inbound transfer to this wallet for a token (within fetched history). */
export function earliestInboundToWallet(
  wallet: string,
  chain: NormalizedNFT["chain"],
  contractAddress: string,
  tokenId: string,
  transfers: NormalizedNFTTransfer[],
  index?: TransferIndex,
): string | null {
  const idx = index ?? buildTransferIndex(transfers);
  const walletNorm = normaliseAddress(wallet);
  let earliest: string | null = null;

  for (const t of transfersForToken(chain, contractAddress, tokenId, idx)) {
    if (t.direction !== "inbound") continue;
    if (normaliseAddress(t.to) !== walletNorm) continue;
    const ts = parseValidTimestamp(t.timestamp);
    if (!ts) continue;
    if (!earliest || new Date(ts).getTime() < new Date(earliest).getTime()) earliest = ts;
  }

  return earliest;
}

export function hasEverOutboundFromWallet(
  wallet: string,
  chain: NormalizedNFT["chain"],
  contractAddress: string,
  tokenId: string,
  transfers: NormalizedNFTTransfer[],
  index?: TransferIndex,
): boolean {
  const idx = index ?? buildTransferIndex(transfers);
  const walletNorm = normaliseAddress(wallet);
  return transfersForToken(chain, contractAddress, tokenId, idx).some(
    (t) => t.direction === "outbound" && normaliseAddress(t.from) === walletNorm,
  );
}

function hasOutboundFromWalletAfter(
  wallet: string,
  chain: NormalizedNFT["chain"],
  contractAddress: string,
  tokenId: string,
  index: TransferIndex,
  afterIso: string,
): boolean {
  const walletNorm = normaliseAddress(wallet);
  const afterMs = new Date(afterIso).getTime();

  for (const t of transfersForToken(chain, contractAddress, tokenId, index)) {
    if (t.direction !== "outbound") continue;
    if (normaliseAddress(t.from) !== walletNorm) continue;
    const ts = parseValidTimestamp(t.timestamp);
    if (ts && new Date(ts).getTime() > afterMs) return true;
  }

  return false;
}

/** Reconcile provider acquiredAt with transfer-derived streak start. */
function mergeProviderWithStreakStart(
  wallet: string,
  nft: NormalizedNFT,
  index: TransferIndex,
  streakStart: string,
  fromProvider: string,
): string {
  const providerMs = new Date(fromProvider).getTime();
  const streakMs = new Date(streakStart).getTime();

  if (providerMs < streakMs) {
    const gapDays = (streakMs - providerMs) / 86400000;
    if (gapDays >= 7) return fromProvider;
    return streakStart;
  }

  if (providerMs > streakMs) {
    const gapDays = (providerMs - streakMs) / 86400000;
    if (
      hasOutboundFromWalletAfter(
        wallet,
        nft.chain,
        nft.contractAddress,
        nft.tokenId,
        index,
        streakStart,
      ) ||
      gapDays >= 45
    ) {
      return fromProvider;
    }
    return streakStart;
  }

  return streakStart;
}

/** Pick the best credible acquisition time for the wallet's current hold on this NFT. */
export function resolveCurrentHoldStartedAt(
  wallet: string,
  nft: NormalizedNFT,
  transfers: NormalizedNFTTransfer[],
  index?: TransferIndex,
): string | null {
  const idx = index ?? buildTransferIndex(transfers);
  const fromWalk = currentHoldStartedAt(wallet, nft.chain, nft.contractAddress, nft.tokenId, idx);
  const fromLatestInbound = latestInboundToWallet(
    wallet,
    nft.chain,
    nft.contractAddress,
    nft.tokenId,
    transfers,
    idx,
  );
  const fromProvider = parseValidTimestamp(nft.acquiredAt);
  const everOutbound = hasEverOutboundFromWallet(
    wallet,
    nft.chain,
    nft.contractAddress,
    nft.tokenId,
    transfers,
    idx,
  );

  const streakStart = fromWalk ?? fromLatestInbound;

  if (!everOutbound) {
    if (streakStart && fromProvider) {
      return mergeProviderWithStreakStart(wallet, nft, idx, streakStart, fromProvider);
    }
    return streakStart ?? fromProvider ?? null;
  }

  if (streakStart && fromProvider) {
    return mergeProviderWithStreakStart(wallet, nft, idx, streakStart, fromProvider);
  }

  return streakStart ?? fromProvider ?? null;
}

/** Latest credible acquisition timestamp for highlight selection (e.g. Newest Pickup). */
export function bestAcquisitionTimestamp(
  wallet: string,
  nft: NormalizedNFT,
  transfers: NormalizedNFTTransfer[],
): string | null {
  return (
    resolveCurrentHoldStartedAt(wallet, nft, transfers) ??
    latestInboundToWallet(wallet, nft.chain, nft.contractAddress, nft.tokenId, transfers) ??
    parseValidTimestamp(nft.acquiredAt)
  );
}

function inboundTimestampsToWallet(
  wallet: string,
  chain: NormalizedNFT["chain"],
  contractAddress: string,
  tokenId: string,
  index: TransferIndex,
): string[] {
  const walletNorm = normaliseAddress(wallet);
  const out: string[] = [];

  for (const t of transfersForToken(chain, contractAddress, tokenId, index)) {
    if (t.direction !== "inbound") continue;
    if (normaliseAddress(t.to) !== walletNorm) continue;
    const ts = parseValidTimestamp(t.timestamp);
    if (ts) out.push(ts);
  }

  return out;
}

function pickEarliestTimestamp(candidates: string[]): string | null {
  if (!candidates.length) return null;
  return candidates.reduce((earliest, ts) =>
    new Date(ts).getTime() < new Date(earliest).getTime() ? ts : earliest,
  );
}

function pickLatestTimestamp(candidates: string[]): string | null {
  if (!candidates.length) return null;
  return candidates.reduce((latest, ts) =>
    new Date(ts).getTime() > new Date(latest).getTime() ? ts : latest,
  );
}

/** Earliest credible acquisition timestamp for Oldest Friend. */
export function oldestHighlightTimestamp(
  wallet: string,
  nft: NormalizedNFT,
  transfers: NormalizedNFTTransfer[],
): string | null {
  const index = buildTransferIndex(transfers);
  const provider = parseValidTimestamp(nft.acquiredAt);
  const inbounds = inboundTimestampsToWallet(
    wallet,
    nft.chain,
    nft.contractAddress,
    nft.tokenId,
    index,
  );
  const everOutbound = hasEverOutboundFromWallet(
    wallet,
    nft.chain,
    nft.contractAddress,
    nft.tokenId,
    transfers,
    index,
  );

  if (everOutbound) {
    return (
      resolveCurrentHoldStartedAt(wallet, nft, transfers, index) ??
      latestInboundToWallet(wallet, nft.chain, nft.contractAddress, nft.tokenId, transfers, index) ??
      provider
    );
  }

  return pickEarliestTimestamp([...(provider ? [provider] : []), ...inbounds]);
}

/** Latest credible acquisition timestamp for Newest Pickup. */
export function newestHighlightTimestamp(
  wallet: string,
  nft: NormalizedNFT,
  transfers: NormalizedNFTTransfer[],
): string | null {
  const index = buildTransferIndex(transfers);
  const provider = parseValidTimestamp(nft.acquiredAt);
  const inbounds = inboundTimestampsToWallet(
    wallet,
    nft.chain,
    nft.contractAddress,
    nft.tokenId,
    index,
  );
  const everOutbound = hasEverOutboundFromWallet(
    wallet,
    nft.chain,
    nft.contractAddress,
    nft.tokenId,
    transfers,
    index,
  );

  if (everOutbound) {
    return (
      resolveCurrentHoldStartedAt(wallet, nft, transfers, index) ??
      latestInboundToWallet(wallet, nft.chain, nft.contractAddress, nft.tokenId, transfers, index) ??
      provider
    );
  }

  return pickLatestTimestamp([...(provider ? [provider] : []), ...inbounds]);
}

/** @deprecated Use oldestHighlightTimestamp or newestHighlightTimestamp */
export function highlightAcquisitionTimestamp(
  wallet: string,
  nft: NormalizedNFT,
  transfers: NormalizedNFTTransfer[],
): string | null {
  return newestHighlightTimestamp(wallet, nft, transfers);
}

/** Reconstruct current uninterrupted hold start from transfer history. */
export function currentHoldStartedAt(
  wallet: string,
  chain: NormalizedNFT["chain"],
  contractAddress: string,
  tokenId: string,
  transfersOrIndex: NormalizedNFTTransfer[] | TransferIndex,
): string | null {
  const index = Array.isArray(transfersOrIndex)
    ? buildTransferIndex(transfersOrIndex)
    : transfersOrIndex;
  const walletNorm = normaliseAddress(wallet);
  const relevant = transfersForToken(chain, contractAddress, tokenId, index);
  if (!relevant.length) return null;

  let owned = false;
  let startedAt: string | null = null;
  for (const t of sortTransfers(relevant)) {
    const to = normaliseAddress(t.to);
    const from = normaliseAddress(t.from);
    if (t.direction === "inbound" && to === walletNorm) {
      owned = true;
      startedAt = t.timestamp;
    } else if (t.direction === "outbound" && from === walletNorm) {
      owned = false;
      startedAt = null;
    }
  }
  return owned ? startedAt : null;
}

export function parseValidTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export function enrichNftsWithHoldPeriods(
  wallet: string,
  nfts: NormalizedNFT[],
  transfers: NormalizedNFTTransfer[],
): EnrichedNFT[] {
  const index = buildTransferIndex(transfers);
  const now = Date.now();
  return nfts.map((n) => {
    const started = resolveCurrentHoldStartedAt(wallet, n, transfers, index);
    const startedMs = started ? new Date(started).getTime() : null;
    const days =
      startedMs != null ? Math.max(0, Math.floor((now - startedMs) / 86400000)) : null;
    return {
      ...n,
      currentHoldStartedAt: started,
      currentHoldDays: days,
    };
  });
}

export function holdDaysFromTimestamp(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}
