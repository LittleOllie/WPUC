import { motion } from "framer-motion";
import { mockCarouselNfts } from "../utils/mockNfts";
import { nftPlaceholderStyle } from "../utils/theme";

function NftTile({ card, theme }) {
  return (
    <motion.div
      whileHover={{ scale: 1.06, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="mx-2 w-40 shrink-0 sm:w-48"
    >
      <motion.div
        className="aspect-square overflow-hidden rounded-2xl border border-white/15 shadow-2xl"
        style={{
          ...nftPlaceholderStyle(card.gradient),
          boxShadow: `0 16px 40px ${theme.primary}33`,
        }}
      >
        <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-3">
          <span className="truncate text-xs font-bold text-white">{card.label}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function NftCarousel({ collection }) {
  const theme = collection.theme;
  const cards = mockCarouselNfts(collection, 10);
  const doubled = [...cards, ...cards];

  return (
    <section className="relative -mx-4 overflow-hidden sm:-mx-6">
      <div className="px-4 sm:px-6">
        <h2 className="font-display text-xl font-bold sm:text-2xl">Community showcase</h2>
        <p className="mt-1 text-sm text-tp-muted">Collectors in the wild — mock previews</p>
      </div>

      <div
        className="relative mt-6 py-2"
        style={{
          maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div className="tp-carousel-track">
          {doubled.map((card, i) => (
            <NftTile key={`${card.id}-${i}`} card={card} theme={theme} />
          ))}
        </div>
      </div>

      <motion.div
        className="mt-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:hidden"
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
      >
        {cards.slice(0, 6).map((card) => (
          <NftTile key={card.id} card={card} theme={theme} />
        ))}
      </motion.div>
    </section>
  );
}
