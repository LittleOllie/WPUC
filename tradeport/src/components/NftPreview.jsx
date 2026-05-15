import { useEffect, useState } from "react";
import NftImage from "./NftImage";
import { nftPlaceholderStyle } from "../utils/theme";

export default function NftPreview({
  gradient,
  label,
  imageUrl,
  imageCandidates = null,
  className = "aspect-square w-full",
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasCandidates = imageCandidates?.length || imageUrl;
  const showImg = hasCandidates && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [imageUrl, imageCandidates?.join("|")]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={showImg ? undefined : nftPlaceholderStyle(gradient)}
    >
      {showImg ? (
        <NftImage
          imageUrl={imageUrl}
          imageCandidates={imageCandidates}
          alt={label || ""}
          className="h-full w-full object-cover"
          loading="lazy"
          onFailed={() => setImgFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-black/20" />
      )}
      {label && (
        <span className="absolute bottom-2 left-2 right-2 truncate text-center text-xs font-semibold text-white/90 drop-shadow">
          {label}
        </span>
      )}
    </div>
  );
}
