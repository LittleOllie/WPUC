import { useCallback, useEffect, useState } from "react";
import { fetchCollectionSamples } from "../lib/api";
import { mockNftTiles } from "../utils/mockNfts";
import { buildNftImageCandidates } from "../utils/nftImages";

const REFRESH_MS = 5 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { tiles: object[], at: number }>} */
const sampleCache = new Map();

function mapSamples(data, collection, count) {
  const stamp = Date.now();
  return (data.nfts || []).slice(0, count).map((n, i) => {
    const imageCandidates = buildNftImageCandidates({
      collectionId: collection.id,
      tokenId: n.tokenId,
      imageUrl: n.imageUrl,
    });
    return {
      id: `${n.contract}-${n.tokenId}-${stamp}`,
      tokenId: n.tokenId,
      imageUrl: imageCandidates[0] || null,
      imageCandidates,
      gradient: [collection.theme.primary, collection.theme.background],
      rotate: (i - 1) * 6,
      z: i,
    };
  });
}

export function useCollectionSamples(collection, count = 3) {
  const contract = collection?.contract?.toLowerCase();

  const [tiles, setTiles] = useState(() => {
    if (!contract) return null;
    const hit = sampleCache.get(contract);
    return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.tiles : null;
  });
  const [loading, setLoading] = useState(() => {
    if (!contract) return false;
    const hit = sampleCache.get(contract);
    return !(hit && Date.now() - hit.at < CACHE_TTL_MS);
  });

  const load = useCallback(
    async (background = false) => {
      if (!contract) {
        setTiles(null);
        setLoading(false);
        return;
      }

      const hit = sampleCache.get(contract);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        setTiles(hit.tiles);
        setLoading(false);
        return;
      }

      if (!background) setLoading(true);

      try {
        const data = await fetchCollectionSamples(contract, count);
        const list = mapSamples(data, collection, count);
        if (list.length > 0) {
          sampleCache.set(contract, { tiles: list, at: Date.now() });
          setTiles(list);
        }
      } catch {
        /* keep previous tiles if any */
      } finally {
        setLoading(false);
      }
    },
    [contract, collection, count]
  );

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const fallback = mockNftTiles(collection, count);

  return {
    tiles: tiles?.length ? tiles : fallback,
    loading: loading && !tiles?.length,
    isLive: !!tiles?.length,
    refresh: () => load(false),
  };
}
