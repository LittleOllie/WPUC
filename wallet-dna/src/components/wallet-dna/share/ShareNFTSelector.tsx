"use client";

import { useEffect, useState } from "react";
import type { NormalizedNFT } from "@/lib/wallet-dna/types";
import { MAX_SHARE_CARD_NFTS } from "@/lib/wallet-dna/constants";
import { keysToSelected } from "@/lib/wallet-dna/share-selection";
import { useShareNFTSelection } from "@/hooks/useShareNFTSelection";
import { NFTImage } from "@/components/wallet-dna/NFTImage";
import { ShareNFTPickerModal } from "@/components/wallet-dna/share/ShareNFTPickerModal";

type Props = {
  walletAddress: string;
  galleryPool: NormalizedNFT[];
  hiddenCollectionKeys: string[];
  savedKeys: string[];
  onKeysChange: (keys: string[]) => void;
  generatedAt: string;
  prefsReady: boolean;
  onSelectedNftsChange: (nfts: NormalizedNFT[]) => void;
};

export function ShareNFTSelector({
  walletAddress,
  galleryPool,
  hiddenCollectionKeys,
  savedKeys,
  onKeysChange,
  generatedAt,
  prefsReady,
  onSelectedNftsChange,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selection = useShareNFTSelection({
    walletAddress,
    galleryPool,
    hiddenCollectionKeys,
    savedKeys,
    onKeysChange,
    generatedAt,
    ready: prefsReady,
  });

  const { selected, selectedNfts, suggestedKeys, staleNotice, loading } = selection;

  useEffect(() => {
    if (!loading) onSelectedNftsChange(selectedNfts);
  }, [selectedNfts, loading, onSelectedNftsChange]);

  return (
    <section className="wdna-share-nft-selector" aria-labelledby="share-nft-selector-title">
      <h4 id="share-nft-selector-title">Choose Your NFTs</h4>
      <p className="wdna-section__lead">
        Select up to four NFTs from your wallet to feature on your share card.
      </p>

      {staleNotice && (
        <p className="wdna-picker-notice" role="status">
          {staleNotice}
        </p>
      )}

      <div className="wdna-share-nft-selector__preview">
        {selectedNfts.length === 0 && !loading ? (
          <p className="wdna-share-nft-selector__empty">No NFTs selected — branded placeholders will be used.</p>
        ) : (
          <div className="wdna-share-nft-selector__thumbs">
            {selectedNfts.map((nft, i) => (
              <div key={`${nft.chain}:${nft.tokenId}`} className="wdna-share-nft-selector__thumb-wrap">
                <span className="wdna-share-nft-selector__num">{i + 1}</span>
                <NFTImage nft={nft} className="wdna-share-nft-selector__thumb" />
              </div>
            ))}
            {Array.from({ length: Math.max(0, MAX_SHARE_CARD_NFTS - selectedNfts.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="wdna-share-nft-selector__thumb-wrap wdna-share-nft-selector__thumb-wrap--empty">
                <span className="wdna-share-nft-selector__num">{selectedNfts.length + i + 1}</span>
                <div className="wdna-share-nft-selector__placeholder" aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
        <p className="wdna-share-nft-selector__count">
          {selectedNfts.length} of {MAX_SHARE_CARD_NFTS} selected
        </p>
      </div>

      <div className="wdna-share-nft-selector__actions">
        <button type="button" className="wdna-btn wdna-btn--ghost" onClick={() => setPickerOpen(true)}>
          Choose different NFTs
        </button>
        <button type="button" className="wdna-link-btn" onClick={selection.useSuggested}>
          Use suggested NFTs
        </button>
      </div>

      <ShareNFTPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        walletAddress={walletAddress}
        initialSelected={selected}
        hiddenCollectionKeys={hiddenCollectionKeys}
        suggestedKeys={suggestedKeys}
        onConfirm={(keys) => {
          selection.applyKeys(keys);
          setPickerOpen(false);
        }}
      />
    </section>
  );
}

export { keysToSelected };
