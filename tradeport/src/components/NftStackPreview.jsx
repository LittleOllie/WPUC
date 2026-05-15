import { motion, AnimatePresence } from "framer-motion";
import { useCollectionSamples } from "../hooks/useCollectionSamples";
import { nftPlaceholderStyle } from "../utils/theme";

export default function NftStackPreview({ collection, className = "" }) {
  const { tiles, loading, isLive } = useCollectionSamples(collection, 3);

  return (
    <div className={`relative h-24 w-full sm:h-28 ${className}`}>
      {loading && !isLive && (
        <p className="absolute -top-1 right-0 z-20 text-[10px] text-white/40">Loading art…</p>
      )}
      <AnimatePresence mode="popLayout">
        {tiles.map((tile, i) => (
          <motion.div
            key={`${tile.id}-${i}`}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="absolute bottom-0 h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl border-2 border-white/20 shadow-xl sm:h-20 sm:w-20"
            style={{
              ...(!tile.imageUrl ? nftPlaceholderStyle(tile.gradient) : {}),
              left: `${i * 28}%`,
              zIndex: tile.z + 1,
              rotate: `${tile.rotate}deg`,
              boxShadow: `0 12px 32px ${collection.theme.primary}44`,
            }}
            whileHover={{ y: -6, scale: 1.05, zIndex: 10 }}
          >
            {tile.imageUrl ? (
              <img
                src={tile.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
                fetchPriority={i === 1 ? "high" : "auto"}
              />
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
