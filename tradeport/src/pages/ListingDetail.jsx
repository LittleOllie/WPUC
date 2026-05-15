import { Link, useParams } from "react-router-dom";
import { getListingById, getTimeRemaining, listingIsSameCollectionSwap } from "../data/listings";
import { getCollectionById } from "../data/collections";
import ListingNftPreview from "../components/ListingNftPreview";
import TradeTypeBadge from "../components/TradeTypeBadge";
import StatusBadge from "../components/StatusBadge";
import SafetyNotice from "../components/SafetyNotice";
import CollectionLogo from "../components/CollectionLogo";

export default function ListingDetail() {
  const { id } = useParams();
  const listing = getListingById(id);

  if (!listing) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Listing not found</h1>
        <Link to="/trades" className="mt-4 inline-block text-violet-400">
          Back to trades
        </Link>
      </div>
    );
  }

  const offering = getCollectionById(listing.offeringCollectionId);
  const looking = listing.lookingForCollectionId
    ? getCollectionById(listing.lookingForCollectionId)
    : null;
  const time = getTimeRemaining(listing.expiresAt);
  const sameCollection = listingIsSameCollectionSwap(listing);
  const t = listing.trader;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/trades" className="text-sm text-violet-400 hover:underline">
        ← All trades
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ListingNftPreview listing={listing} className="aspect-square" />
        <div>
          <div className="flex flex-wrap gap-2">
            <TradeTypeBadge type={listing.tradeType} />
            {sameCollection && (
              <span className="rounded-full border border-teal-400/35 bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-200">
                Same collection swap
              </span>
            )}
            <StatusBadge status={listing.status} />
            {listing.trader.verified && (
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                Verified ownership (mock)
              </span>
            )}
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">{listing.offeringLabel}</h1>
          <p className={`mt-2 text-sm ${time.expired ? "text-red-400" : "text-tp-muted"}`}>{time.label}</p>

          <div className="mt-8 space-y-6">
            <div>
              <p className="text-xs font-bold uppercase text-tp-muted">I HAVE</p>
              <div className="mt-2 flex items-center gap-2">
                {offering && <CollectionLogo collection={offering} className="h-8 w-8" />}
                <span className="text-lg font-medium">{listing.offeringLabel}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-tp-muted">I WANT</p>
              <p className="mt-2 text-lg">{listing.lookingForLabel}</p>
              {sameCollection && offering ? (
                <p className="text-sm text-teal-300/90">Swap within {offering.name} only</p>
              ) : (
                looking && <p className="text-sm text-tp-muted">Community: {looking.name}</p>
              )}
            </div>
            {listing.notes && (
              <div>
                <p className="text-xs font-bold uppercase text-tp-muted">Notes</p>
                <p className="mt-2 text-tp-muted">{listing.notes}</p>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-xl border border-tp-border bg-tp-surface p-5">
            <h2 className="font-semibold">Trader</h2>
            <p className="mt-1">@{t.name}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {t.twitter && (
                <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => alert(`Open ${t.twitter} (mock)`)}>
                  X / Twitter
                </button>
              )}
              {t.discord && (
                <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => alert(`Discord: ${t.discord} (mock)`)}>
                  Discord
                </button>
              )}
              {t.email && (
                <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => alert(`Email: ${t.email} (mock)`)}>
                  Email
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl bg-violet-500 px-6 py-3 font-semibold"
              onClick={() => alert("Interest sent (mock)")}
            >
              I&apos;m Interested
            </button>
            <button type="button" className="rounded-xl border border-white/15 px-6 py-3 font-semibold" onClick={() => alert("Saved (mock)")}>
              Save
            </button>
            <button type="button" className="rounded-xl border border-red-500/30 px-6 py-3 text-sm text-red-300" onClick={() => alert("Report (mock)")}>
              Report
            </button>
          </div>
        </div>
      </div>

      <SafetyNotice compact className="mt-10" />
      <SafetyNotice className="mt-6" />
    </div>
  );
}
