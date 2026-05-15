import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";
import { fetchWalletNfts } from "../lib/api";
import { buildNftImageCandidates } from "../utils/nftImages";

/**
 * Loads NFTs the connected wallet holds for a given collection (Alchemy via Worker).
 */
export function useCollectionWalletNfts(collection) {
  const { address, isConnected, isMainnet } = useWallet();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!collection?.contract || !address || !isMainnet) {
      setNfts([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWalletNfts(address, collection.contract)
      .then((data) => {
        if (cancelled) return;
        const list = (data.nfts || []).map((n) => {
          const imageCandidates = buildNftImageCandidates({
            collectionId: collection.id,
            tokenId: n.tokenId,
            imageUrl: n.imageUrl,
          });
          return {
            id: `${n.contract}-${n.tokenId}`,
            label: n.name || `#${n.tokenId}`,
            tokenId: n.tokenId,
            imageUrl: imageCandidates[0] || null,
            imageCandidates,
            gradient: [collection.theme.primary, collection.theme.background],
          };
        });
        setNfts(list);
        if (!list.length) {
          setError(`No ${collection.shortName} NFTs in this wallet on Ethereum Mainnet.`);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setNfts([]);
          setError(e.message || "Could not load NFTs. Is the API running?");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [collection, address, isMainnet]);

  return {
    nfts,
    loading,
    error,
    isConnected,
    isMainnet,
    canLoad: isConnected && isMainnet,
  };
}
