import { useEffect, useState } from "react";

/**
 * Tries imageCandidates in order (Quirkies S3, IPFS gateways, proxy) when the primary URL fails.
 */
export default function NftImage({
  imageUrl = null,
  imageCandidates = null,
  alt = "",
  className = "",
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  onFailed,
}) {
  const urls = imageCandidates?.length
    ? imageCandidates
    : imageUrl
      ? [imageUrl]
      : [];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [urls.join("|")]);

  const src = urls[index];
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onError={() => {
        if (index < urls.length - 1) {
          setIndex((i) => i + 1);
        } else {
          onFailed?.();
        }
      }}
    />
  );
}
