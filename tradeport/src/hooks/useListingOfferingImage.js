import { useEffect, useState } from "react";
import { getCollectionById } from "../data/collections";
import { fetchNftMetadata } from "../lib/api";
import { buildNftImageCandidates } from "../utils/nftImages";

const candidatesCache = new Map();
const inflight = new Map();

function cacheKey(contract, tokenId) {
  return `${contract.toLowerCase()}-${tokenId}`;
}

async function loadOfferingCandidates(listing) {
  const collection = getCollectionById(listing?.offeringCollectionId);
  const tokenId = listing?.offeringTokenId;
  const rawUrl = listing?.offeringImageUrl;

  if (rawUrl) {
    return buildNftImageCandidates({
      collectionId: collection?.id,
      tokenId,
      imageUrl: rawUrl,
    });
  }

  if (!collection?.contract || tokenId == null || tokenId === "") return [];

  const key = cacheKey(collection.contract, tokenId);
  if (candidatesCache.has(key)) return candidatesCache.get(key);

  if (inflight.has(key)) return inflight.get(key);

  const promise = fetchNftMetadata(collection.contract, tokenId)
    .then((data) => {
      const candidates = buildNftImageCandidates({
        collectionId: collection.id,
        tokenId,
        imageUrl: data?.nft?.imageUrl,
      });
      if (candidates.length) candidatesCache.set(key, candidates);
      return candidates;
    })
    .catch(() => [])
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function useListingOfferingImage(listing) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageCandidates, setImageCandidates] = useState([]);

  useEffect(() => {
    if (!listing) {
      setImageUrl(null);
      setImageCandidates([]);
      return;
    }

    let cancelled = false;
    setImageUrl(null);
    setImageCandidates([]);

    loadOfferingCandidates(listing).then((candidates) => {
      if (cancelled) return;
      setImageCandidates(candidates);
      setImageUrl(candidates[0] || null);
    });

    return () => {
      cancelled = true;
    };
  }, [listing?.id, listing?.offeringCollectionId, listing?.offeringTokenId, listing?.offeringImageUrl]);

  return { imageUrl, imageCandidates };
}
