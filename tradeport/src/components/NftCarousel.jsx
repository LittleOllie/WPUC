import { motion } from "framer-motion";
import { useCollectionSamples } from "../hooks/useCollectionSamples";
import NftImage from "./NftImage";
import { nftPlaceholderStyle } from "../utils/theme";

function NftTile({ card, theme, showLabel = true }) {
  const hasImage = card.imageUrl || card.imageCandidates?.length;

  return (
    <motion.div
      whileHover={{ scale: 1.06, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="mx-2 w-40 shrink-0 sm:w-48"
    >
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border border-white/15 shadow-2xl"
        style={{
          ...(hasImage ? {} : nftPlaceholderStyle(card.gradient)),
          boxShadow: `0 16px 40px ${theme.primary}33`,
        }}
      >
        {hasImage ? (
          <NftImage
            imageUrl={card.imageUrl}
            imageCandidates={card.imageCandidates}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        {showLabel && card.label && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
            <span className="truncate text-xs font-bold text-white drop-shadow">{card.label}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function NftCarousel({
  collection,
  nfts = null,
  loading = false,
  subtitle,
  showLabels = true,
}) {
  const theme = collection.theme;
  const { tiles: sampleTiles, loading: samplesLoading, isLive: samplesLive } = useCollectionSamples(
    collection,
    8
  );
  const useWallet = Array.isArray(nfts) && nfts.length > 0;
  const cards = useWallet ? nfts : sampleTiles;
  const useReal = useWallet || samplesLive;
  const doubled = useWallet ? cards : [...cards, ...cards];

  const desc =
    subtitle ||
    (useWallet
      ? `Your ${collection.shortName} NFTs from wallet`
      : samplesLoading
        ? "Loading community art from chain…"
        : samplesLive
          ? `Random ${collection.shortName} pieces — refreshes every few minutes`
          : "Connect wallet for your NFTs, or start the API for live previews");

  return (
    <section className="relative -mx-4 overflow-hidden sm:-mx-6">
      <div className="px-4 sm:px-6">
        <h2 className="font-display text-xl font-bold sm:text-2xl">The art</h2>
        <p className="mt-1 text-sm text-tp-muted">{desc}</p>
      </div>

      {(loading || samplesLoading) && !useReal && (
        <p className="mt-4 px-4 text-sm text-tp-muted sm:px-6">Fetching from Alchemy…</p>
      )}

      <div
        className="relative mt-6 py-2"
        style={{
          maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        }}
      >
        {useReal ? (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide sm:px-6">
            {cards.map((card) => (
              <NftTile key={card.id} card={card} theme={theme} showLabel={showLabels} />
            ))}
          </div>
        ) : (
          <div className="tp-carousel-track">
            {doubled.map((card, i) => (
              <NftTile key={`${card.id}-${i}`} card={card} theme={theme} showLabel={showLabels} />
            ))}
          </div>
        )}
      </div>

      {!useReal && (
        <div className="mt-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:hidden">
          {cards.slice(0, 6).map((card) => (
            <NftTile key={card.id} card={card} theme={theme} showLabel={showLabels} />
          ))}
        </div>
      )}
    </section>
  );
}
