import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getCollectionById } from "../data/collections";
import { getListingsByCollection } from "../data/listings";
import CommunityHero from "../components/CommunityHero";
import NftCarousel from "../components/NftCarousel";
import FounderMessage from "../components/FounderMessage";
import CommunityLinks from "../components/CommunityLinks";
import ListingCard from "../components/ListingCard";
import { collectionThemeStyle } from "../utils/theme";

export default function CollectionHub() {
  const { id } = useParams();
  const collection = getCollectionById(id);

  if (!collection) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Community not found</h1>
        <Link to="/collections" className="mt-4 inline-block text-violet-400 hover:underline">
          Back to communities
        </Link>
      </div>
    );
  }

  const listings = getListingsByCollection(collection.id);
  const joinListings = listings.filter((l) => l.lookingForCollectionId === collection.id);
  const theme = collection.theme;

  return (
    <div
      className="mx-auto max-w-6xl space-y-14 px-4 py-8 sm:space-y-16 sm:px-6 sm:py-12"
      style={collectionThemeStyle(theme)}
    >
      <CommunityHero collection={collection} />
      <NftCarousel collection={collection} />
      <FounderMessage collection={collection} />

      <section>
        <h2 className="font-display text-2xl font-bold">About the community</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-tp-muted">{collection.description}</p>
        <p className="mt-2 text-sm italic text-white/45">Vibe: {collection.vibe}</p>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Active trade listings</h2>
          <Link
            to={`/trades?collection=${collection.id}`}
            className="text-sm font-semibold transition hover:opacity-80"
            style={{ color: theme.primary }}
          >
            View all →
          </Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.slice(0, 6).map((l, i) => (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <ListingCard listing={l} accentColor={theme.primary} />
            </motion.div>
          ))}
        </div>
        {listings.length === 0 && <p className="mt-4 text-tp-muted">No listings yet.</p>}
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold">Looking to join this community</h2>
        <p className="mt-2 text-tp-muted">Collectors offering trades to enter {collection.shortName}.</p>
        <motion.div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {joinListings.length > 0 ? (
            joinListings.map((l) => (
              <ListingCard key={l.id} listing={l} accentColor={theme.primary} />
            ))
          ) : (
            <p className="text-tp-muted">No entry listings right now — check back soon.</p>
          )}
        </motion.div>
        <Link
          to="/join"
          className="mt-6 inline-block text-sm font-semibold hover:underline"
          style={{ color: theme.primary }}
        >
          Browse join flow →
        </Link>
      </section>

      <CommunityLinks collection={collection} />
    </div>
  );
}
