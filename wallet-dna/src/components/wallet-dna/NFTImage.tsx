"use client";

import { useMemo, useState } from "react";
import type { NormalizedNFT } from "@/lib/wallet-dna/types";
import { collectNftImageCandidates } from "@/lib/wallet-dna/utils/nft-image-candidates";

type Props = {
  nft: Pick<
    NormalizedNFT,
    "title" | "collectionName" | "tokenId" | "imageUrl" | "thumbnailUrl"
  >;
  fallbackNfts?: Array<Pick<NormalizedNFT, "imageUrl" | "thumbnailUrl">>;
  alt?: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
  crossOrigin?: "anonymous" | "use-credentials";
};

export function NFTImage({
  nft,
  fallbackNfts = [],
  alt,
  className = "",
  sizes,
  eager,
  crossOrigin,
}: Props) {
  const candidates = useMemo(
    () => collectNftImageCandidates(nft, fallbackNfts),
    [nft, fallbackNfts],
  );
  const [index, setIndex] = useState(0);

  const label = alt ?? nft.title ?? nft.collectionName ?? `Token #${nft.tokenId}`;
  const src = candidates[index] ?? null;
  const failed = !src || index >= candidates.length;

  if (failed) {
    return (
      <div className={`wdna-nft-fallback ${className}`} role="img" aria-label={label}>
        <span className="wdna-nft-fallback__glyph" aria-hidden="true">
          🧬
        </span>
        <span className="wdna-nft-fallback__name">{nft.collectionName ?? "NFT"}</span>
        <span className="wdna-nft-fallback__id">#{nft.tokenId}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={label}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      sizes={sizes}
      crossOrigin={crossOrigin}
      onError={() => {
        setIndex((current) => {
          const next = current + 1;
          return next < candidates.length ? next : candidates.length;
        });
      }}
    />
  );
}
