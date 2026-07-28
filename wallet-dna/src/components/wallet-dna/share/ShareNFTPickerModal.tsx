"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { NormalizedNFT, SelectedShareNFT, WalletNFTCollectionOption } from "@/lib/wallet-dna/types";
import { fetchWalletNfts } from "@/lib/wallet-dna/client";
import { MAX_SHARE_CARD_NFTS, NFT_PICKER_PAGE_SIZE } from "@/lib/wallet-dna/constants";
import {
  addShareSelection,
  isHiddenCollectionKey,
  keysToSelected,
  moveShareSelection,
  removeShareSelection,
  selectedToKeys,
} from "@/lib/wallet-dna/share-selection";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";
import { createTokenKey } from "@/lib/wallet-dna/utils/helpers";
import { NFTImage } from "@/components/wallet-dna/NFTImage";

type Props = {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  initialSelected: SelectedShareNFT[];
  hiddenCollectionKeys: string[];
  suggestedKeys: string[];
  onConfirm: (keys: string[]) => void;
};

const ALL_COLLECTIONS = "__all__";

export function ShareNFTPickerModal({
  open,
  onClose,
  walletAddress,
  initialSelected,
  hiddenCollectionKeys,
  suggestedKeys,
  onConfirm,
}: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<SelectedShareNFT[]>(initialSelected);
  const [collections, setCollections] = useState<WalletNFTCollectionOption[]>([]);
  const [collectionKey_, setCollectionKey_] = useState(ALL_COLLECTIONS);
  const [search, setSearch] = useState("");
  const [chainFilter, setChainFilter] = useState<"" | "ethereum" | "base">("");
  const [showHidden, setShowHidden] = useState(false);
  const [nfts, setNfts] = useState<NormalizedNFT[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [pendingHiddenKey, setPendingHiddenKey] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Map<string, NormalizedNFT>>(new Map());

  const resetList = useCallback(async () => {
    setLoading(true);
    setLimitMsg(null);
    try {
      const col = collectionKey_ !== ALL_COLLECTIONS ? collectionKey_.split(":") : null;
      const chain = col?.[0] as "ethereum" | "base" | undefined;
      const contract = col?.[1];
      const data = await fetchWalletNfts({
        wallet: walletAddress,
        chain,
        contract,
        search: search || undefined,
        chainFilter: chainFilter || undefined,
        limit: NFT_PICKER_PAGE_SIZE,
      });
      setNfts(data.nfts);
      setCursor(data.nextCursor);
      setTotal(data.total);
      if (data.collections.length) setCollections(data.collections);
      setLookup((prev) => {
        const next = new Map(prev);
        for (const n of data.nfts) {
          next.set(createTokenKey(n.chain, n.contractAddress, n.tokenId), n);
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [walletAddress, collectionKey_, search, chainFilter]);

  useEffect(() => {
    if (!open) return;
    setSelected(initialSelected);
    setSearch("");
    setChainFilter("");
    setCollectionKey_(ALL_COLLECTIONS);
    setShowHidden(false);
    setNfts([]);
    setCursor(null);
    resetList();
    closeBtnRef.current?.focus();
  }, [open, initialSelected, resetList]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(resetList, 300);
    return () => window.clearTimeout(t);
  }, [search, collectionKey_, chainFilter, open, resetList]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const col = collectionKey_ !== ALL_COLLECTIONS ? collectionKey_.split(":") : null;
      const data = await fetchWalletNfts({
        wallet: walletAddress,
        chain: col?.[0] as "ethereum" | "base" | undefined,
        contract: col?.[1],
        search: search || undefined,
        chainFilter: chainFilter || undefined,
        cursor,
        limit: NFT_PICKER_PAGE_SIZE,
      });
      setNfts((prev) => [...prev, ...data.nfts]);
      setCursor(data.nextCursor);
      setLookup((prev) => {
        const next = new Map(prev);
        for (const n of data.nfts) {
          next.set(createTokenKey(n.chain, n.contractAddress, n.tokenId), n);
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  function trySelect(nftKey: string) {
    setLimitMsg(null);
    if (selected.some((s) => s.nftKey === nftKey)) {
      setSelected((s) => removeShareSelection(s, nftKey));
      return;
    }
    if (
      !showHidden &&
      isHiddenCollectionKey(nftKey, lookup, hiddenCollectionKeys) &&
      pendingHiddenKey !== nftKey
    ) {
      setPendingHiddenKey(nftKey);
      return;
    }
    const { next, error } = addShareSelection(selected, nftKey);
    if (error === "max") {
      setLimitMsg(`You can feature up to ${MAX_SHARE_CARD_NFTS} NFTs. Remove one before choosing another.`);
      return;
    }
    setSelected(next);
    setPendingHiddenKey(null);
  }

  function confirmHiddenFeature() {
    if (!pendingHiddenKey) return;
    const { next, error } = addShareSelection(selected, pendingHiddenKey);
    if (error !== "max") setSelected(next);
    setPendingHiddenKey(null);
  }

  const visibleCollections = collections.filter(
    (c) => showHidden || !hiddenCollectionKeys.includes(c.key),
  );

  const totalHeld = collections.reduce((s, c) => s + c.quantity, 0);

  if (!open) return null;

  return (
    <div className="wdna-picker-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="wdna-picker-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="wdna-picker-modal__panel">
        <header className="wdna-picker-modal__header">
          <button type="button" className="wdna-picker-modal__back" onClick={onClose}>
            Back
          </button>
          <h2 id={titleId}>Choose Your NFTs</h2>
          <span className="wdna-picker-modal__count">
            {selected.length} of {MAX_SHARE_CARD_NFTS} selected
          </span>
        </header>

        <div className="wdna-picker-modal__controls">
          <label className="wdna-picker-field">
            <span>Collection</span>
            <select
              value={collectionKey_}
              onChange={(e) => setCollectionKey_(e.target.value)}
              aria-label="Collection"
            >
              <option value={ALL_COLLECTIONS}>
                All Collections · {totalHeld} NFTs
              </option>
              {visibleCollections.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name} · {c.quantity} · {c.chain}
                  {hiddenCollectionKeys.includes(c.key) ? " · Hidden from showcase" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="wdna-picker-field">
            <span className="sr-only">Search</span>
            <input
              type="search"
              placeholder="Search by NFT name or token ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {collectionKey_ === ALL_COLLECTIONS && (
            <label className="wdna-picker-field wdna-picker-field--inline">
              <span>Chain</span>
              <select
                value={chainFilter}
                onChange={(e) => setChainFilter(e.target.value as "" | "ethereum" | "base")}
              >
                <option value="">All chains</option>
                <option value="ethereum">Ethereum</option>
                <option value="base">Base</option>
              </select>
            </label>
          )}
          <label className="wdna-picker-toggle">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            Show hidden collections
          </label>
        </div>

        {limitMsg && (
          <p className="wdna-picker-notice" role="status" aria-live="polite">
            {limitMsg}
          </p>
        )}

        {pendingHiddenKey && (
          <div className="wdna-picker-confirm" role="alertdialog" aria-labelledby={`${titleId}-hidden`}>
            <p id={`${titleId}-hidden`}>
              This collection is hidden from your showcase. Feature this NFT on the share card anyway?
            </p>
            <div className="wdna-picker-confirm__actions">
              <button type="button" className="wdna-btn wdna-btn--ghost" onClick={() => setPendingHiddenKey(null)}>
                Keep hidden
              </button>
              <button type="button" className="wdna-btn" onClick={confirmHiddenFeature}>
                Feature this NFT
              </button>
            </div>
          </div>
        )}

        <SelectedTray
          selected={selected}
          lookup={lookup}
          onRemove={(key) => setSelected((s) => removeShareSelection(s, key))}
          onMove={(key, dir) => setSelected((s) => moveShareSelection(s, key, dir))}
          onClear={() => setSelected([])}
          onSuggested={() => setSelected(keysToSelected(suggestedKeys))}
        />

        <div className="wdna-picker-grid-wrap">
          {loading && nfts.length === 0 ? (
            <p className="wdna-picker-empty">Loading NFTs…</p>
          ) : nfts.length === 0 ? (
            <p className="wdna-picker-empty">No eligible NFTs were found in this collection.</p>
          ) : (
            <div className="wdna-picker-grid" role="listbox" aria-label="Wallet NFTs" aria-multiselectable="true">
              {nfts
                .filter((n) => showHidden || !hiddenCollectionKeys.includes(collectionKey(n.chain, n.contractAddress)))
                .map((nft) => {
                  const key = createTokenKey(nft.chain, nft.contractAddress, nft.tokenId);
                  const slot = selected.find((s) => s.nftKey === key)?.position;
                  const isHidden = hiddenCollectionKeys.includes(collectionKey(nft.chain, nft.contractAddress));
                  return (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={Boolean(slot)}
                      className={`wdna-picker-tile ${slot ? "wdna-picker-tile--selected" : ""}`}
                      onClick={() => trySelect(key)}
                    >
                      <NFTImage nft={nft} className="wdna-picker-tile__img" />
                      <span className="wdna-picker-tile__label">{nft.title ?? `#${nft.tokenId}`}</span>
                      {collectionKey_ === ALL_COLLECTIONS && (
                        <span className="wdna-picker-tile__meta">{nft.collectionName ?? nft.chain}</span>
                      )}
                      {isHidden && <span className="wdna-picker-tile__hidden">Hidden from showcase</span>}
                      {slot ? <span className="wdna-picker-tile__slot">{slot}</span> : null}
                    </button>
                  );
                })}
            </div>
          )}
          {cursor && (
            <button type="button" className="wdna-btn wdna-btn--ghost wdna-picker-load-more" onClick={loadMore} disabled={loading}>
              Load more
            </button>
          )}
          {!loading && nfts.length > 0 && (
            <p className="wdna-picker-meta">
              Showing {nfts.length} of {total}
            </p>
          )}
        </div>

        <footer className="wdna-picker-modal__footer">
          <button ref={closeBtnRef} type="button" className="wdna-btn" onClick={() => onConfirm(selectedToKeys(selected))}>
            Use these NFTs
          </button>
        </footer>
      </div>
    </div>
  );
}

function SelectedTray({
  selected,
  lookup,
  onRemove,
  onMove,
  onClear,
  onSuggested,
}: {
  selected: SelectedShareNFT[];
  lookup: Map<string, NormalizedNFT>;
  onRemove: (key: string) => void;
  onMove: (key: string, dir: "left" | "right" | "first" | "last") => void;
  onClear: () => void;
  onSuggested: () => void;
}) {
  const sorted = [...selected].sort((a, b) => a.position - b.position);
  return (
    <div className="wdna-picker-tray">
      <div className="wdna-picker-tray__slots">
        {sorted.map((s) => {
          const nft = lookup.get(s.nftKey);
          return (
            <div key={s.nftKey} className="wdna-picker-tray__slot">
              <span className="wdna-picker-tray__num">{s.position}</span>
              {nft ? (
                <NFTImage nft={nft} className="wdna-picker-tray__thumb" />
              ) : (
                <div className="wdna-picker-tray__empty">…</div>
              )}
              <div className="wdna-picker-tray__actions">
                <button type="button" aria-label={`Move NFT ${s.position} left`} onClick={() => onMove(s.nftKey, "left")}>
                  ←
                </button>
                <button type="button" aria-label={`Move NFT ${s.position} right`} onClick={() => onMove(s.nftKey, "right")}>
                  →
                </button>
                <button type="button" aria-label={`Remove NFT ${s.position}`} onClick={() => onRemove(s.nftKey)}>
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="wdna-picker-tray__bar">
        <span>{sorted.length} of {MAX_SHARE_CARD_NFTS} selected</span>
        <button type="button" className="wdna-link-btn" onClick={onSuggested}>
          Use suggested NFTs
        </button>
        <button type="button" className="wdna-link-btn" onClick={onClear}>
          Clear all
        </button>
      </div>
    </div>
  );
}
