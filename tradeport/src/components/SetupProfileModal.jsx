import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collections } from "../data/collections";
import CollectionLogo from "./CollectionLogo";
import { useProfile } from "../context/ProfileContext";
import { useWallet } from "../context/WalletContext";
import { collectionThemeStyle } from "../utils/theme";

export default function SetupProfileModal() {
  const { shortAddress } = useWallet();
  const { profile, showSetup, saveProfile } = useProfile();
  const [displayName, setDisplayName] = useState("");
  const [primaryCollectionId, setPrimaryCollectionId] = useState("");
  const [twitter, setTwitter] = useState("");
  const [discord, setDiscord] = useState("");
  const [bio, setBio] = useState("");
  const [showTwitter, setShowTwitter] = useState(true);
  const [showDiscord, setShowDiscord] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!showSetup) return;
    setDisplayName(profile?.displayName || "");
    setPrimaryCollectionId(profile?.primaryCollectionId || "");
    setTwitter(profile?.twitter || "");
    setDiscord(profile?.discord || "");
    setBio(profile?.bio || "");
    setShowTwitter(profile?.showTwitter ?? true);
    setShowDiscord(profile?.showDiscord ?? true);
    setError("");
  }, [showSetup, profile]);

  const selected = collections.find((c) => c.id === primaryCollectionId);
  const theme = selected?.theme;

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError("Choose a display name so other collectors know who you are.");
      return;
    }
    if (!primaryCollectionId) {
      setError("Pick your primary community.");
      return;
    }
    saveProfile({
      displayName: name,
      primaryCollectionId,
      twitter: twitter.trim().replace(/^@/, ""),
      discord: discord.trim(),
      bio: bio.trim(),
      showTwitter,
      showDiscord,
    });
  };

  return (
    <AnimatePresence>
      {showSetup && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-profile-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-tp-surface p-6 shadow-2xl sm:p-8"
            style={theme ? collectionThemeStyle(theme) : undefined}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Welcome to TradePort</p>
            <h2 id="setup-profile-title" className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              Set up your profile
            </h2>
            <p className="mt-2 text-sm text-tp-muted">
              Connected as <span className="font-mono text-white/80">{shortAddress}</span>. This helps collectors
              recognize you when browsing trades.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="displayName" className="block text-sm font-semibold">
                  Display name <span className="text-fuchsia-400">*</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  maxLength={32}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. GorgezCollector"
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none ring-violet-500/50 focus:ring-2"
                  autoComplete="nickname"
                />
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Primary community <span className="text-fuchsia-400">*</span>
                </p>
                <p className="mt-1 text-xs text-tp-muted">Where you trade most — you can still browse all communities.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {collections.map((c) => {
                    const active = primaryCollectionId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPrimaryCollectionId(c.id)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                          active
                            ? "border-white/30 bg-white/10 ring-2 ring-white/20"
                            : "border-white/10 bg-black/20 hover:border-white/20"
                        }`}
                        style={
                          active
                            ? {
                                boxShadow: `0 0 24px ${c.theme.primary}44`,
                                borderColor: `${c.theme.primary}88`,
                              }
                            : undefined
                        }
                      >
                        <CollectionLogo collection={c} className="h-12 w-12" />
                        <span className="text-center text-xs font-semibold">{c.shortName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="twitter" className="block text-sm font-semibold">
                    X / Twitter
                  </label>
                  <input
                    id="twitter"
                    type="text"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="@handle"
                    className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-tp-muted">
                    <input
                      type="checkbox"
                      checked={showTwitter}
                      onChange={(e) => setShowTwitter(e.target.checked)}
                      className="rounded"
                    />
                    Show on public profile
                  </label>
                </div>
                <div>
                  <label htmlFor="discord" className="block text-sm font-semibold">
                    Discord
                  </label>
                  <input
                    id="discord"
                    type="text"
                    value={discord}
                    onChange={(e) => setDiscord(e.target.value)}
                    placeholder="username"
                    className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-tp-muted">
                    <input
                      type="checkbox"
                      checked={showDiscord}
                      onChange={(e) => setShowDiscord(e.target.checked)}
                      className="rounded"
                    />
                    Show on public profile
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-semibold">
                  Short bio
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  maxLength={160}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What you collect, what you're looking for…"
                  className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <p className="mt-1 text-right text-xs text-tp-muted">{bio.length}/160</p>
              </div>

              {error && <p className="text-sm text-amber-400">{error}</p>}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="submit"
                  className="rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
                  style={{
                    background: theme?.primary || "#7c5cff",
                    boxShadow: theme ? `0 4px 20px ${theme.primary}55` : undefined,
                  }}
                >
                  Save profile & continue
                </button>
              </div>
            </form>

            <p className="mt-4 text-center text-xs text-tp-muted">
              Stored locally on this device until cloud profiles launch.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
