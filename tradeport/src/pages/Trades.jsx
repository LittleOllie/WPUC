import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collections } from "../data/collections";
import { mockListings } from "../data/listings";
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

export default function Trades() {
  const [searchParams] = useSearchParams();
  const [collection, setCollection] = useState(searchParams.get("collection") || "All");
  const [tradeType, setTradeType] = useState("All");
  const [status, setStatus] = useState("All");
  const [lookingFor, setLookingFor] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return mockListings.filter((l) => {
      if (collection !== "All" && l.offeringCollectionId !== collection && l.lookingForCollectionId !== collection)
        return false;
      if (tradeType !== "All" && l.tradeType !== tradeType) return false;
      if (status !== "All" && l.status !== status) return false;
      if (lookingFor !== "All" && l.lookingForCollectionId !== lookingFor) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${l.offeringLabel} ${l.lookingForLabel} ${l.trader.name} ${l.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [collection, tradeType, status, lookingFor, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Browse trades</h1>
      <p className="mt-2 text-tp-muted">I HAVE · I WANT · FIND MATCHES</p>

      <div className="mt-8 grid gap-4 rounded-2xl border border-tp-border bg-tp-surface/50 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-sm">
          <span className="text-tp-muted">Collection</span>
          <select
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-tp-bg px-3 py-2"
          >
            <option value="All">All</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-tp-muted">Trade type</span>
          <select
            value={tradeType}
            onChange={(e) => setTradeType(e.target.value)}
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
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-tp-bg px-3 py-2"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-tp-muted">Looking for</span>
          <select
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-tp-bg px-3 py-2"
          >
            <option value="All">All</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName}
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

      <p className="mt-6 text-sm text-tp-muted">{filtered.length} listing(s)</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </div>
  );
}
