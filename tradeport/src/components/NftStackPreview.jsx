import { motion } from "framer-motion";
import { mockNftTiles } from "../utils/mockNfts";
import { nftPlaceholderStyle } from "../utils/theme";

export default function NftStackPreview({ collection, className = "" }) {
  const tiles = mockNftTiles(collection, 3);

  return (
    <div className={`relative h-24 w-full sm:h-28 ${className}`}>
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.id}
          className="absolute bottom-0 h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl border-2 border-white/20 shadow-xl sm:h-20 sm:w-20"
          style={{
            ...nftPlaceholderStyle(tile.gradient),
            left: `${i * 28}%`,
            zIndex: tile.z + 1,
            rotate: `${tile.rotate}deg`,
            boxShadow: `0 12px 32px ${collection.theme.primary}44`,
          }}
          whileHover={{ y: -6, scale: 1.05, zIndex: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-white/90">
            {tile.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
