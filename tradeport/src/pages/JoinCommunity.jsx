import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { collections, getCollectionById } from "../data/collections";
import { getJoinListingsForCollection } from "../data/listings";
import CollectionCard from "../components/CollectionCard";
import ListingNftPreview from "../components/ListingNftPreview";
import TradeTypeBadge from "../components/TradeTypeBadge";
import StatusBadge from "../components/StatusBadge";
import { VerifiedBadge } from "../components/TrustBadge";
import { collectionThemeStyle } from "../utils/theme";

export default function JoinCommunity() {
  const [step, setStep] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const selected = selectedId ? getCollectionById(selectedId) : null;
  const listings = selectedId ? getJoinListingsForCollection(selectedId) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl">
          Choose your <span className="tp-gradient-text">next community</span>
        </h1>
        <p className="mt-3 max-w-2xl text-base text-tp-muted sm:text-lg">
          Discover collectors offering NFTs who want to trade into the community you&apos;re joining.
        </p>
      </motion.div>

      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        <span
          className={`rounded-full px-3 py-1 ${step >= 1 ? "bg-violet-500/20 font-semibold text-violet-300" : "text-tp-muted"}`}
        >
          1. Pick community
        </span>
        <span className="text-tp-muted">→</span>
        <span
          className={`rounded-full px-3 py-1 ${step >= 2 ? "bg-violet-500/20 font-semibold text-violet-300" : "text-tp-muted"}`}
        >
          2. Browse offers
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="mt-10"
          >
            <h2 className="text-xl font-semibold sm:text-2xl">Which community do you want to join?</h2>
            <p className="mt-1 text-sm text-tp-muted">Tap a community to explore entry offers.</p>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {collections.map((c, i) => (
                <motion.button
                  key={c.id}
                  type="button"
                  className="w-full text-left"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedId(c.id);
                    setStep(2);
                  }}
                >
                  <CollectionCard collection={c} large />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && selected && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="mt-10"
            style={collectionThemeStyle(selected.theme)}
          >
            <button
              type="button"
              className="mb-6 text-sm font-medium hover:underline"
              style={{ color: selected.theme.primary }}
              onClick={() => {
                setStep(1);
                setSelectedId(null);
              }}
            >
              ← Choose a different community
            </button>

            <div
              className="rounded-2xl border border-white/10 p-6 sm:p-8"
              style={{
                background: `linear-gradient(135deg, ${selected.theme.background}cc, ${selected.theme.primary}22)`,
                boxShadow: `0 0 48px ${selected.theme.primary}22`,
              }}
            >
              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                Enter <span style={{ color: selected.theme.accent }}>{selected.name}</span>
              </h2>
              <p className="mt-2 text-tp-muted">{listings.length} offer(s) from collectors trading in.</p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {listings.length > 0 ? (
                listings.map((l, i) => {
                  const from = getCollectionById(l.offeringCollectionId);
                  return (
                    <motion.article
                      key={l.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      whileHover={{ y: -4 }}
                      className="tp-card-lift flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-tp-surface/90 sm:flex-row"
                      style={{ boxShadow: `0 8px 32px ${selected.theme.primary}18` }}
                    >
                      <ListingNftPreview
                        listing={l}
                        className="aspect-square w-full shrink-0 sm:w-36 md:w-44"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:py-5 sm:pr-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <TradeTypeBadge type={l.tradeType} />
                          <StatusBadge status={l.status} />
                          {l.trader.verified && <VerifiedBadge compact />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-tp-muted">Offering</p>
                          <p className="font-semibold">{l.offeringLabel}</p>
                          {from && <p className="text-sm text-tp-muted">{from.shortName}</p>}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-tp-muted">Wants in return</p>
                          <p className="text-sm leading-snug">{l.lookingForLabel}</p>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-2 pt-2">
                          <button
                            type="button"
                            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                            style={{ background: selected.theme.primary }}
                            onClick={() => alert("Contact (mock) — DM on X or Discord in live version.")}
                          >
                            Contact
                          </button>
                          <Link
                            to={`/listing/${l.id}`}
                            className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold"
                          >
                            View listing
                          </Link>
                        </div>
                      </div>
                    </motion.article>
                  );
                })
              ) : (
                <p className="col-span-full text-tp-muted">No entry offers for {selected.shortName} right now.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
