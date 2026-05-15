import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getCollectionById } from "../data/collections";
import { getTimeRemaining } from "../data/listings";
import NftPreview from "./NftPreview";
import TradeTypeBadge from "./TradeTypeBadge";
import StatusBadge from "./StatusBadge";
import CollectionLogo from "./CollectionLogo";
import { VerifiedBadge } from "./TrustBadge";

export default function ListingCard({ listing, showInterested = true, accentColor }) {
  const offering = getCollectionById(listing.offeringCollectionId);
  const looking = listing.lookingForCollectionId
    ? getCollectionById(listing.lookingForCollectionId)
    : null;
  const time = getTimeRemaining(listing.expiresAt);
  const glow = accentColor || offering?.theme?.primary || "#7c5cff";
  const traits = listing.traitBadges || (listing.wantTrait ? [listing.wantTrait] : []);

  return (
    <motion.article
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="tp-glow-border tp-card-lift group flex flex-col overflow-hidden rounded-2xl border border-tp-border bg-tp-surface/90"
      style={{
        ["--glow-a"]: `${glow}88`,
        ["--glow-b"]: `${glow}33`,
        boxShadow: `0 4px 24px ${glow}15`,
      }}
    >
      <div className="relative aspect-[5/4] overflow-hidden sm:aspect-square">
        <NftPreview gradient={listing.nftGradient} label={listing.offeringLabel} className="h-full min-h-[180px]" />
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-tp-bg/90 via-transparent to-transparent opacity-60"
          initial={false}
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <TradeTypeBadge type={listing.tradeType} />
        </div>
        <motion.div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
          <StatusBadge status={listing.status} />
          {listing.trader.verified && <VerifiedBadge compact />}
        </motion.div>
        {traits.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
            {traits.map((t) => (
              <span
                key={t}
                className="rounded-md border border-white/20 bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/90 backdrop-blur-sm"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-tp-muted">I HAVE</p>
          <div className="mt-1.5 flex items-center gap-2">
            {offering && <CollectionLogo collection={offering} className="h-7 w-7" textClass="text-[10px]" />}
            <span className="font-semibold">{listing.offeringLabel}</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-tp-muted">I WANT</p>
          <p className="mt-1.5 text-sm leading-snug text-white/90">{listing.lookingForLabel}</p>
          {looking && <p className="mt-0.5 text-xs text-tp-muted">from {looking.shortName}</p>}
        </div>
        <p className="text-sm text-tp-muted">@{listing.trader.name}</p>
        <p className={`text-xs font-medium ${time.expired ? "text-red-400" : "text-tp-muted"}`}>{time.label}</p>
        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
          <Link
            to={`/listing/${listing.id}`}
            className="flex-1 rounded-xl bg-white/10 py-3 text-center text-sm font-semibold transition hover:bg-white/15"
          >
            View Details
          </Link>
          {showInterested && (
            <button
              type="button"
              className="rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-white/5"
              style={{ borderColor: `${glow}66`, color: glow }}
              onClick={() => alert("Interest sent (mock) — connect wallet in live version.")}
            >
              Interested
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
