import { useState } from "react";
import { nftPlaceholderStyle } from "../utils/theme";

export default function NftPreview({ gradient, label, imageUrl, className = "aspect-square w-full" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = imageUrl && !imgFailed;

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={showImg ? undefined : nftPlaceholderStyle(gradient)}
    >
      {showImg ? (
        <img
          src={imageUrl}
          alt={label || ""}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
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
