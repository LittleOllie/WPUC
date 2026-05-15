import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collections, getCollectionById } from "../data/collections";
import {
  mockListings,
  listingInvolvesCollection,
  listingIsSameCollectionSwap,
  listingOffersCollection,
  listingWantsCollection,
} from "../data/listings";
import ListingCard from "../components/ListingCard";

const TRADE_TYPES = [
  "All",
  "WTT",
  "WTS",
  "WTB",
  "Community Entry",
  "Trait Hunt",
  "Open To Offers",
];
const STATUSES = ["All", "Active", "In Talks", "Pending", "Expired"];

function readFiltersFromParams(searchParams) {
  const involves = searchParams.get("involves");
  const sameOnly = searchParams.get("same") === "1";
  if (involves && collections.some((c) => c.id === involves)) {
    return { offeringFrom: "All", lookingFor: "All", involvesCommunity: involves, sameCollectionOnly: sameOnly };
  }
  const offering =
    searchParams.get("offering") || searchParams.get("collection") || "All";
  const lookingFor = searchParams.get("want") || "All";
  return {
    offeringFrom: collections.some((c) => c.id === offering) ? offering : "All",
    lookingFor: collections.some((c) => c.id === lookingFor) ? lookingFor : "All",
    involvesCommunity: "All",
    sameCollectionOnly: sameOnly,
  };
}

function buildSearchParams({
  offeringFrom,
  lookingFor,
  involvesCommunity,
  sameCollectionOnly,
  tradeType,
  status,
  search,
}) {
  const params = new URLSearchParams();
  if (involvesCommunity !== "All") {
    params.set("involves", involvesCommunity);
  } else {
    if (offeringFrom !== "All") params.set("offering", offeringFrom);
    if (lookingFor !== "All") params.set("want", lookingFor);
  }
  if (sameCollectionOnly) params.set("same", "1");
  if (tradeType !== "All") params.set("type", tradeType);
  if (status !== "All") params.set("status", status);
  if (search.trim()) params.set("q", search.trim());
  return params;
}

export default function Trades() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = readFiltersFromParams(searchParams);

  const [offeringFrom, setOfferingFrom] = useState(initial.offeringFrom);
  const [lookingFor, setLookingFor] = useState(initial.lookingFor);
  const [involvesCommunity, setInvolvesCommunity] = useState(initial.involvesCommunity);
  const [sameCollectionOnly, setSameCollectionOnly] = useState(initial.sameCollectionOnly);
  const [tradeType, setTradeType] = useState(searchParams.get("type") || "All");
  const [status, setStatus] = useState(searchParams.get("status") || "All");
  const [search, setSearch] = useState(searchParams.get("q") || "");

  useEffect(() => {
    const next = readFiltersFromParams(searchParams);
    setOfferingFrom(next.offeringFrom);
    setLookingFor(next.lookingFor);
    setInvolvesCommunity(next.involvesCommunity);
    setSameCollectionOnly(next.sameCollectionOnly);
    setTradeType(searchParams.get("type") || "All");
    setStatus(searchParams.get("status") || "All");
    setSearch(searchParams.get("q") || "");
  }, [searchParams]);

  const syncUrl = (overrides = {}) => {
    const state = {
      offeringFrom,
      lookingFor,
      involvesCommunity,
      sameCollectionOnly,
      tradeType,
      status,
      search,
      ...overrides,
    };
    if (state.offeringFrom !== "All" || state.lookingFor !== "All") {
      state.involvesCommunity = "All";
    }
    setSearchParams(buildSearchParams(state), { replace: true });
  };

  const clearFilters = () => {
    setOfferingFrom("All");
    setLookingFor("All");
    setInvolvesCommunity("All");
    setSameCollectionOnly(false);
    setTradeType("All");
    setStatus("All");
    setSearch("");
    setSearchParams({}, { replace: true });
  };

  const filtered = useMemo(() => {
    return mockListings.filter((l) => {
      if (involvesCommunity !== "All") {
        if (!listingInvolvesCollection(l, involvesCommunity)) return false;
      } else {
        if (offeringFrom !== "All" && !listingOffersCollection(l, offeringFrom)) return false;
        if (lookingFor !== "All" && !listingWantsCollection(l, lookingFor)) return false;
      }
      if (tradeType !== "All" && l.tradeType !== tradeType) return false;
      if (status !== "All" && l.status !== status) return false;
      if (sameCollectionOnly && !listingIsSameCollectionSwap(l)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const offeringCol = getCollectionById(l.offeringCollectionId);
        const wantIds = l.lookingForCollectionIds?.length
          ? l.lookingForCollectionIds
          : l.lookingForCollectionId
            ? [l.lookingForCollectionId]
            : [];
        const wantNames = wantIds.map((id) => getCollectionById(id)?.shortName || "").join(" ");
        const hay = `${l.offeringLabel} ${l.lookingForLabel} ${l.trader.name} ${l.notes} ${offeringCol?.shortName} ${wantNames}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [offeringFrom, lookingFor, involvesCommunity, sameCollectionOnly, tradeType, status, search]);

  const involvesCol = involvesCommunity !== "All" ? getCollectionById(involvesCommunity) : null;
  const hasActiveFilters =
    offeringFrom !== "All" ||
    lookingFor !== "All" ||
    involvesCommunity !== "All" ||
    sameCollectionOnly ||
    tradeType !== "All" ||
    status !== "All" ||
    search.trim().length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Browse trades</h1>
      <p className="mt-2 text-tp-muted">I HAVE · I WANT · FIND MATCHES</p>

      {involvesCol && (
        <p className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
          Showing trades involving <strong>{involvesCol.name}</strong> (offering or wanting).{" "}
          <button type="button" onClick={clearFilters} className="font-semibold underline">
            Clear filters
          </button>
        </p>
      )}

      <div className="mt-8 grid gap-4 rounded-2xl border border-tp-border bg-tp-surface/50 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-sm">
          <span className="text-tp-muted">Offering from</span>
          <select
            value={offeringFrom}
            disabled={involvesCommunity !== "All"}
            onChange={(e) => {
              const v = e.target.value;
              setOfferingFrom(v);
              setInvolvesCommunity("All");
              syncUrl({ offeringFrom: v, involvesCommunity: "All" });
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-tp-bg px-3 py-2 disabled:opacity-50"
          >
            <option value="All">All communities</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-tp-muted">NFT they are listing</span>
        </label>
        <label className="block text-sm">
          <span className="text-tp-muted">Looking for</span>
          <select
            value={lookingFor}
            disabled={involvesCommunity !== "All"}
            onChange={(e) => {
              const v = e.target.value;
              setLookingFor(v);
              setInvolvesCommunity("All");
              syncUrl({ lookingFor: v, involvesCommunity: "All" });
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-tp-bg px-3 py-2 disabled:opacity-50"
          >
            <option value="All">Any</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-tp-muted">Community or asset they want</span>
        </label>
        <label className="block text-sm">
          <span className="text-tp-muted">Trade type</span>
          <select
            value={tradeType}
            onChange={(e) => {
              const v = e.target.value;
              setTradeType(v);
              syncUrl({ tradeType: v });
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-tp-bg px-3 py-2"
          >
            {TRADE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-tp-muted">Status</span>
          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value;
              setStatus(v);
              syncUrl({ status: v });
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-tp-bg px-3 py-2"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2 lg:col-span-1">
          <span className="text-tp-muted">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Traits, names…"
            className="mt-1 w-full rounded-lg border border-white/10 bg-tp-bg px-3 py-2"
          />
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={sameCollectionOnly}
          onChange={(e) => {
            const v = e.target.checked;
            setSameCollectionOnly(v);
            syncUrl({ sameCollectionOnly: v });
          }}
          className="h-4 w-4 rounded border-white/20 accent-violet-500"
        />
        <span>
          <span className="font-semibold text-white/90">Same collection swaps only</span>
          <span className="mt-0.5 block text-xs text-tp-muted">
            e.g. trade your DDG for another DDG — trait upgrades and 1:1 refreshes within one community
          </span>
        </span>
      </label>

      {hasActiveFilters && !involvesCol && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-3 text-sm font-semibold text-violet-400 hover:underline"
        >
          Clear all filters
        </button>
      )}

      <p className="mt-6 text-sm text-tp-muted">
        {filtered.length} listing{filtered.length === 1 ? "" : "s"}
        {offeringFrom !== "All" && involvesCommunity === "All" && (
          <> · offering from <strong className="text-white/80">{getCollectionById(offeringFrom)?.shortName}</strong></>
        )}
        {lookingFor !== "All" && involvesCommunity === "All" && (
          <> · wanting <strong className="text-white/80">{getCollectionById(lookingFor)?.shortName}</strong></>
        )}
        {sameCollectionOnly && (
          <> · <strong className="text-white/80">same collection</strong> swaps</>
        )}
      </p>

      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <div className="mt-12 rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
          <p className="font-semibold">No listings match these filters</p>
          <p className="mt-2 text-sm text-tp-muted">Try a different community or clear filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Clear filters
          </button>
          <Link to="/create" className="mt-4 block text-sm font-semibold text-violet-400">
            Create a trade →
          </Link>
        </div>
      )}
    </div>
  );
}
