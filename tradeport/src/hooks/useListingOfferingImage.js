import { useEffect, useState } from "react";
import { getCollectionById } from "../data/collections";
import { fetchNftMetadata, displayImageUrl } from "../lib/api";

const imageCache = new Map();
const inflight = new Map();

function cacheKey(contract, tokenId) {
  return `${contract.toLowerCase()}-${tokenId}`;
}

async function loadOfferingImage(listing) {
  if (listing?.offeringImageUrl) {
    return displayImageUrl(listing.offeringImageUrl) || listing.offeringImageUrl;
  }
  const collection = getCollectionById(listing?.offeringCollectionId);
  const tokenId = listing?.offeringTokenId;
  if (!collection?.contract || tokenId == null || tokenId === "") return null;

  const key = cacheKey(collection.contract, tokenId);
  if (imageCache.has(key)) return imageCache.get(key);

  if (inflight.has(key)) return inflight.get(key);

  const promise = fetchNftMetadata(collection.contract, tokenId)
    .then((data) => {
      const url = displayImageUrl(data?.nft?.imageUrl) || null;
      if (url) imageCache.set(key, url);
      return url;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function useListingOfferingImage(listing) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (!listing) {
      setImageUrl(null);
      return;
    }

    let cancelled = false;
    setImageUrl(null);

    loadOfferingImage(listing).then((url) => {
      if (!cancelled) setImageUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [listing?.id, listing?.offeringCollectionId, listing?.offeringTokenId, listing?.offeringImageUrl]);

  return imageUrl;
}
