import type { NormalizedNFT } from "@/lib/wallet-dna/types";
import { NFTImage } from "@/components/wallet-dna/NFTImage";

type Props = {
  nfts: NormalizedNFT[];
  format: "landscape" | "square" | "portrait";
  className?: string;
};

/** Purpose-designed NFT layouts for 0–4 selections per card format. */
export function ShareNFTArtworkLayout({ nfts, format, className = "" }: Props) {
  const count = nfts.length;

  if (count === 0) {
    return (
      <div className={`wdna-share-artwork wdna-share-artwork--empty ${className}`} aria-hidden="true">
        <div className="wdna-share-artwork__placeholder">
          <span className="wdna-share-artwork__glyph">🧬</span>
          <span>Wallet DNA</span>
        </div>
      </div>
    );
  }

  const layoutClass =
    count === 1
      ? "wdna-share-artwork--one"
      : count === 2
        ? "wdna-share-artwork--two"
        : count === 3
          ? "wdna-share-artwork--three"
          : "wdna-share-artwork--four";

  return (
    <div
      className={`wdna-share-artwork wdna-share-artwork--${format} ${layoutClass} ${className}`}
    >
      {nfts.map((nft, i) => (
        <NFTImage
          key={`${nft.chain}:${nft.contractAddress}:${nft.tokenId}`}
          nft={nft}
          className={`wdna-share-artwork__tile wdna-share-artwork__tile--${i + 1}`}
          eager
          alt={`${nft.title ?? nft.collectionName ?? "NFT"} #${nft.tokenId}`}
        />
      ))}
    </div>
  );
}
