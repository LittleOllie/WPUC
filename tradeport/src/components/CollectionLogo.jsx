import { useState } from "react";
import { logoEdgeFill } from "../utils/logoEdgeFill";

export default function CollectionLogo({ collection, className = "h-12 w-12", textClass = "text-lg" }) {
  const [failed, setFailed] = useState(false);
  const theme = collection?.theme;

  if (!collection || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl font-display font-bold ${className}`}
        style={{
          background: theme
            ? `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
            : "linear-gradient(135deg, #7c5cff, #5a3fd4)",
          color: "#fff",
        }}
      >
        <span className={textClass}>{collection?.shortName?.slice(0, 2) ?? "?"}</span>
      </div>
    );
  }

  const edge = logoEdgeFill(collection);

  return (
    <img
      src={collection.logo}
      alt={`${collection.name} logo`}
      className={`shrink-0 rounded-xl ${edge ? "object-cover scale-[1.12]" : "object-contain"} ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
