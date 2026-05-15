import { Link } from "react-router-dom";
import { mockListings } from "../data/listings";
import ListingCard from "../components/ListingCard";

const MOCK_USER = {
  name: "CollectorDemo",
  verified: true,
  twitter: "@collectordemo",
  discord: "demo#4242",
  email: "",
};

export default function Profile() {
  const active = mockListings.filter((l) => l.trader.name === "GorgezCollector").slice(0, 3);
  const saved = mockListings.slice(0, 2);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 font-display text-2xl font-bold">
          {MOCK_USER.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{MOCK_USER.name}</h1>
          {MOCK_USER.verified && (
            <span className="mt-1 inline-block rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300">
              Wallet verified (mock)
            </span>
          )}
          <p className="mt-2 text-sm text-tp-muted">
            {MOCK_USER.twitter} · {MOCK_USER.discord}
          </p>
        </div>
      </div>

      <p className="mt-6 rounded-xl bg-white/5 p-4 text-sm text-tp-muted">
        Choose what contact info is public. (Privacy controls coming in live version.)
      </p>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">Active listings</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {active.length > 0 ? active.map((l) => <ListingCard key={l.id} listing={l} showInterested={false} />) : (
            <p className="text-tp-muted">No active listings in mock profile.</p>
          )}
        </div>
        <Link to="/create" className="mt-4 inline-block text-sm font-semibold text-violet-400">
          Create a trade →
        </Link>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">Completed trades (mock)</h2>
        <ul className="mt-4 space-y-2 text-sm text-tp-muted">
          <li>DDG #42 ↔ Long Lost #331 — completed</li>
          <li>Quirkies #100 → DDG entry — completed</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">Saved listings</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {saved.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>
    </div>
  );
}
