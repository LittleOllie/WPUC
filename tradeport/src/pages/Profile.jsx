import { Link } from "react-router-dom";
import { mockListings } from "../data/listings";
import { getCollectionById } from "../data/collections";
import ListingCard from "../components/ListingCard";
import CollectionLogo from "../components/CollectionLogo";
import ConnectWalletButton from "../components/ConnectWalletButton";
import { useWallet } from "../context/WalletContext";
import { useProfile } from "../context/ProfileContext";
import { collectionThemeStyle } from "../utils/theme";

export default function Profile() {
  const { isConnected, shortAddress } = useWallet();
  const { profile, isProfileComplete, openSetup } = useProfile();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <h1 className="font-display text-3xl font-bold">Your profile</h1>
        <p className="mt-3 text-tp-muted">Connect your wallet to set up your collector profile and manage listings.</p>
        <ConnectWalletButton className="mt-8 flex justify-center" />
      </div>
    );
  }

  if (!isProfileComplete) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:py-24">
        <h1 className="font-display text-3xl font-bold">Finish your profile</h1>
        <p className="mt-3 text-tp-muted">
          Connected as <span className="font-mono text-white/80">{shortAddress}</span>. Complete setup so other
          collectors can find you.
        </p>
        <button
          type="button"
          onClick={openSetup}
          className="mt-8 rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-400"
        >
          Set up profile
        </button>
      </div>
    );
  }

  const collection = getCollectionById(profile.primaryCollectionId);
  const theme = collection?.theme;
  const initials = profile.displayName.slice(0, 2).toUpperCase();
  const active = mockListings.filter((l) => l.trader.name === "GorgezCollector").slice(0, 3);
  const saved = mockListings.slice(0, 2);

  const contactParts = [];
  if (profile.showTwitter && profile.twitter) contactParts.push(`@${profile.twitter.replace(/^@/, "")}`);
  if (profile.showDiscord && profile.discord) contactParts.push(profile.discord);

  return (
    <div
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12"
      style={theme ? collectionThemeStyle(theme) : undefined}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl font-display text-2xl font-bold text-white"
          style={{
            background: theme
              ? `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
              : "linear-gradient(135deg, #7c5cff, #e63cb4)",
          }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{profile.displayName}</h1>
            {collection && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold">
                <CollectionLogo collection={collection} className="h-5 w-5" textClass="text-[10px]" />
                {collection.name}
              </span>
            )}
          </div>
          <span className="mt-2 inline-block rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300">
            Wallet verified
          </span>
          <p className="mt-2 font-mono text-sm text-tp-muted">{shortAddress}</p>
          {contactParts.length > 0 && (
            <p className="mt-2 text-sm text-tp-muted">{contactParts.join(" · ")}</p>
          )}
          {profile.bio && <p className="mt-3 max-w-xl text-sm text-white/80">{profile.bio}</p>}
        </div>
        <button
          type="button"
          onClick={openSetup}
          className="shrink-0 self-start rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
        >
          Edit profile
        </button>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">Active listings</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {active.length > 0 ? (
            active.map((l) => <ListingCard key={l.id} listing={l} showInterested={false} />)
          ) : (
            <p className="text-tp-muted">No active listings yet.</p>
          )}
        </div>
        <Link to="/create" className="mt-4 inline-block text-sm font-semibold text-violet-400">
          Create a trade →
        </Link>
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
