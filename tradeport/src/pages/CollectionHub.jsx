import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getCollectionById } from "../data/collections";
import {
  getListingsByCollection,
  getJoinListingsForCollection,
  getSameCollectionListings,
} from "../data/listings";
import CommunityHero from "../components/CommunityHero";
import CommunitySpotlight from "../components/CommunitySpotlight";
import NftCarousel from "../components/NftCarousel";
import FounderMessage from "../components/FounderMessage";
import ListingCard from "../components/ListingCard";
import { collectionThemeStyle } from "../utils/theme";
import { useCollectionWalletNfts } from "../hooks/useCollectionWalletNfts";
import WalletNftsBanner from "../components/WalletNftsBanner";

export default function CollectionHub() {
  const { id } = useParams();
  const collection = getCollectionById(id);
  const { nfts: walletNfts, loading, error } = useCollectionWalletNfts(collection);

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
  const joinListings = getJoinListingsForCollection(collection.id);
  const sameCollectionListings = getSameCollectionListings(collection.id);
  const theme = collection.theme;

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:space-y-16 sm:px-6 sm:py-12"
      style={collectionThemeStyle(theme)}
    >
      <CommunityHero collection={collection} />
      <CommunitySpotlight collection={collection} />

      <NftCarousel
        collection={collection}
        nfts={walletNfts}
        loading={loading}
        subtitle={`A glimpse of ${collection.name} — real art from the collection`}
        showLabels={false}
      />

      <FounderMessage collection={collection} />

      <section
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-10"
        style={{
          borderColor: `${theme.primary}44`,
          background: `linear-gradient(135deg, ${theme.primary}18, ${theme.background}ee)`,
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.secondary }}>
              Join the community
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              Trades to enter {collection.shortName}
            </h2>
            <p className="mt-2 max-w-2xl text-tp-muted">
              Collectors from other communities offering NFTs who want to trade into {collection.name}. Connect
              your wallet and make an offer.
            </p>
          </div>
          <Link
            to="/join"
            className="shrink-0 rounded-xl px-6 py-3 text-center text-sm font-bold text-white"
            style={{ background: theme.primary }}
          >
            Start join flow
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {joinListings.length > 0 ? (
            joinListings.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <ListingCard listing={l} accentColor={theme.primary} />
              </motion.div>
            ))
          ) : (
            <p className="col-span-full text-tp-muted">
              No entry listings right now — check back soon or{" "}
              <Link to="/create" className="font-semibold underline" style={{ color: theme.primary }}>
                post what you want
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      <WalletNftsBanner
        collection={collection}
        loading={loading}
        error={error}
        nftCount={walletNfts.length}
      />

      {sameCollectionListings.length > 0 && (
        <section
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-10"
          style={{
            borderColor: `${theme.secondary}44`,
            background: `linear-gradient(135deg, ${theme.secondary}14, ${theme.background}ee)`,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accent }}>
                Same collection
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                Swap {collection.shortName} for {collection.shortName}
              </h2>
              <p className="mt-2 max-w-2xl text-tp-muted">
                Collectors trading within the community — trait upgrades, PFP refreshes, or set building without
                leaving {collection.name}.
              </p>
            </div>
            <Link
              to={`/trades?offering=${collection.id}&want=${collection.id}`}
              className="shrink-0 rounded-xl border px-6 py-3 text-center text-sm font-bold transition hover:bg-white/5"
              style={{ borderColor: `${theme.secondary}66`, color: theme.secondary }}
            >
              Browse {collection.shortName} swaps
            </Link>
          </motion.div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sameCollectionListings.slice(0, 3).map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <ListingCard listing={l} accentColor={theme.secondary} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-white/10 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-tp-muted">For collectors</p>
            <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">Trading activity</h2>
            <p className="mt-1 text-sm text-tp-muted">
              Listings involving {collection.shortName} — not the main focus, but useful if you already hold.
            </p>
          </div>
          <Link
            to={`/trades?involves=${collection.id}`}
            className="text-sm font-semibold transition hover:opacity-80"
            style={{ color: theme.primary }}
          >
            Browse all →
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
    </motion.div>
  );
}
