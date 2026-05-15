import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { collections } from "../data/collections";
import MockWalletNotice from "../components/MockWalletNotice";
import NftPreview from "../components/NftPreview";
import CollectionLogo from "../components/CollectionLogo";
import { useWallet } from "../context/WalletContext";
import { fetchWalletNfts, proxiedImageUrl } from "../lib/api";

const STEPS = [
  "What you HAVE",
  "Select NFT",
  "What you WANT",
  "Trade type",
  "Notes",
  "Expiry",
  "Preview",
  "Publish",
];
const TRADE_TYPES = ["WTT", "WTS", "WTB", "Community Entry", "Trait Hunt", "Open To Offers"];
const EXPIRY = [
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
];

export default function CreateTrade() {
  const { address, isConnected, isMainnet, connect } = useWallet();
  const [step, setStep] = useState(0);
  const [haveCollection, setHaveCollection] = useState(null);
  const [selectedNft, setSelectedNft] = useState(null);
  const [walletNfts, setWalletNfts] = useState([]);
  const [nftsLoading, setNftsLoading] = useState(false);
  const [nftsError, setNftsError] = useState(null);
  const [wantKind, setWantKind] = useState("collection");
  const [wantCollectionIds, setWantCollectionIds] = useState([]);
  const [wantEth, setWantEth] = useState("");
  const [wantTrait, setWantTrait] = useState("");
  const [wantDetails, setWantDetails] = useState("");
  const [tradeType, setTradeType] = useState("WTT");
  const [notes, setNotes] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [published, setPublished] = useState(false);

  const have = collections.find((c) => c.id === haveCollection);
  const wantCollections = useMemo(
    () => collections.filter((c) => wantCollectionIds.includes(c.id)),
    [wantCollectionIds]
  );

  const toggleWantCollection = (id) => {
    setWantCollectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectSameCollectionSwap = () => {
    if (!haveCollection) return;
    setWantKind("collection");
    setWantCollectionIds([haveCollection]);
    setWantEth("");
    setWantTrait("");
    if (!wantDetails.trim()) {
      setWantDetails(`Another ${have?.shortName ?? "piece"} from the same collection — open to fair 1:1 swaps`);
    }
    if (tradeType === "Community Entry") setTradeType("WTT");
  };

  const isSameCollectionWant =
    haveCollection &&
    wantKind === "collection" &&
    wantCollectionIds.length === 1 &&
    wantCollectionIds[0] === haveCollection;

  const selectAllWantCollections = () => {
    setWantCollectionIds(collections.map((c) => c.id));
  };

  const clearWantCollections = () => {
    setWantCollectionIds([]);
  };

  const wantCollectionsLabel = useMemo(() => {
    if (!wantCollections.length) return null;
    if (wantCollections.length === collections.length) return "Any supported community";
    return wantCollections.map((c) => c.shortName).join(", ");
  }, [wantCollections]);

  const wantSummary = useMemo(() => {
    if (isSameCollectionWant && have) {
      const base = `Another ${have.shortName} (same collection swap)`;
      return wantDetails.trim() ? `${base} — ${wantDetails.trim()}` : base;
    }
    if (wantKind === "collection" && wantCollectionsLabel) {
      return wantDetails.trim()
        ? `${wantCollectionsLabel} — ${wantDetails.trim()}`
        : `${wantCollectionsLabel} (NFT or entry)`;
    }
    if (wantKind === "open") {
      const base = wantCollectionsLabel
        ? `Open to offers (${wantCollectionsLabel})`
        : "Open to offers (any community)";
      return wantDetails.trim() ? `${base} — ${wantDetails.trim()}` : base;
    }
    if (wantKind === "eth") {
      const amount = wantEth.trim();
      return amount ? `${amount} ETH${wantDetails.trim() ? ` · ${wantDetails.trim()}` : ""}` : "ETH";
    }
    if (wantKind === "trait") {
      const trait = wantTrait.trim();
      return trait
        ? `${trait}${wantDetails.trim() ? ` · ${wantDetails.trim()}` : ""}`
        : wantDetails.trim() || "Specific trait";
    }
    return wantDetails.trim() || "Open to offers";
  }, [wantKind, wantCollectionsLabel, wantEth, wantTrait, wantDetails, isSameCollectionWant, have]);

  const canContinueWant = useMemo(() => {
    if (wantKind === "collection") return wantCollectionIds.length > 0;
    if (wantKind === "eth") return Boolean(wantEth.trim());
    if (wantKind === "trait") return Boolean(wantTrait.trim());
    return true;
  }, [wantKind, wantCollectionIds, wantEth, wantTrait]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  useEffect(() => {
    if (step !== 1 || !have || !address || !isMainnet) return;
    let cancelled = false;
    setNftsLoading(true);
    setNftsError(null);
    setWalletNfts([]);
    fetchWalletNfts(address, have.contract)
      .then((data) => {
        if (cancelled) return;
        const list = (data.nfts || []).map((n) => ({
          id: `${n.contract}-${n.tokenId}`,
          tokenId: n.tokenId,
          contract: n.contract,
          label: n.name || `#${n.tokenId}`,
          imageUrl: proxiedImageUrl(n.imageUrl),
          gradient: [have.theme.primary, have.theme.background],
        }));
        setWalletNfts(list);
        if (!list.length) setNftsError(`No ${have.shortName} NFTs found in this wallet on mainnet.`);
      })
      .catch((e) => {
        if (!cancelled) setNftsError(e.message || "Could not load NFTs. Is the API running?");
      })
      .finally(() => {
        if (!cancelled) setNftsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, have, address, isMainnet]);

  if (published) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-emerald-400">Listing published (mock)</h1>
        <p className="mt-4 text-tp-muted">
          Saved listings in a database come next — your NFT selection was verified via wallet + Alchemy.
        </p>
        <Link to="/trades" className="mt-8 inline-block rounded-xl bg-violet-500 px-6 py-3 font-semibold">
          Browse trades
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold">Create trade</h1>
      <p className="mt-2 text-tp-muted">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>
      <MockWalletNotice className="mt-6" />

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-violet-500 transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          className="mt-8"
        >
          {step === 0 && (
            <div>
              <p className="font-semibold">Select what you HAVE (collection)</p>
              {!isConnected && (
                <p className="mt-2 text-sm text-amber-300/90">Connect your wallet above to load your NFTs next.</p>
              )}
              <div className="mt-4 grid gap-3">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={async () => {
                      if (!isConnected) {
                        const acc = await connect();
                        if (!acc) return;
                      }
                      setHaveCollection(c.id);
                      setSelectedNft(null);
                      next();
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                      haveCollection === c.id ? "border-violet-500 bg-violet-500/10" : "border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <CollectionLogo collection={c} />
                    <span className="font-medium">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && have && (
            <div>
              <p className="font-semibold">Select your {have.shortName} NFT</p>
              {!isConnected && (
                <p className="mt-2 text-sm text-amber-300/90">Connect wallet to load NFTs from Alchemy.</p>
              )}
              {nftsLoading && <p className="mt-4 text-sm text-tp-muted">Loading your NFTs…</p>}
              {nftsError && <p className="mt-4 text-sm text-amber-400">{nftsError}</p>}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {walletNfts.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setSelectedNft(n);
                      next();
                    }}
                    className={`overflow-hidden rounded-xl ring-2 ${
                      selectedNft?.id === n.id ? "ring-violet-500" : "ring-transparent"
                    }`}
                  >
                    <NftPreview
                      gradient={n.gradient}
                      label={n.label}
                      imageUrl={n.imageUrl}
                      className="aspect-square w-full"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="font-semibold">What do you WANT?</p>
              <p className="mt-1 text-sm text-tp-muted">
                Pick a category so your listing shows up in the right community filters — then add specifics below.
              </p>

              {have && (
                <button
                  type="button"
                  onClick={selectSameCollectionSwap}
                  className={`mt-5 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                    isSameCollectionWant
                      ? "border-violet-500 bg-violet-500/15 ring-1 ring-violet-400/40"
                      : "border-white/15 bg-white/[0.03] hover:border-violet-500/40 hover:bg-violet-500/5"
                  }`}
                >
                  <CollectionLogo collection={have} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Swap within {have.shortName}</p>
                    <p className="mt-0.5 text-sm text-tp-muted">
                      Trade your {have.shortName} for someone else&apos;s {have.shortName} — trait upgrades, PFP
                      refreshes, or fair 1:1 swaps.
                    </p>
                  </div>
                  {isSameCollectionWant && (
                    <span className="shrink-0 rounded-full bg-violet-500/30 px-3 py-1 text-xs font-bold text-violet-200">
                      Selected
                    </span>
                  )}
                </button>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { id: "collection", label: "NFT / community" },
                  { id: "eth", label: "ETH" },
                  { id: "trait", label: "Trait hunt" },
                  { id: "open", label: "Open offers" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setWantKind(opt.id)}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      wantKind === opt.id ? "border-violet-500 bg-violet-500/20" : "border-white/15"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {(wantKind === "collection" || wantKind === "open") && (
                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {wantKind === "open" ? "Communities (optional)" : "Which collections?"}
                      </p>
                      <p className="mt-1 text-xs text-tp-muted">
                        {wantKind === "open"
                          ? "Select all if you're open to any — or pick specific ones. Same community as your NFT is allowed."
                          : "Select one or more. This links your listing to those hubs and browse filters."}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllWantCollections}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
                      >
                        Select all
                      </button>
                      {wantCollectionIds.length > 0 && (
                        <button
                          type="button"
                          onClick={clearWantCollections}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-tp-muted hover:bg-white/5"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {wantCollectionIds.length > 0 && (
                    <p className="mt-2 text-xs text-violet-300">
                      {wantCollectionIds.length} selected
                      {wantCollectionIds.length === collections.length ? " · shows in all community hubs" : ""}
                    </p>
                  )}
                  <div className="mt-3 grid gap-2">
                    {collections.map((c) => {
                      const selected = wantCollectionIds.includes(c.id);
                      const isSameAsHave = c.id === haveCollection;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleWantCollection(c.id)}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                            selected
                              ? "border-violet-500 bg-violet-500/10"
                              : "border-white/10 hover:bg-white/5"
                          }`}
                        >
                          <CollectionLogo collection={c} className="h-10 w-10" />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{c.name}</span>
                            {isSameAsHave && (
                              <span className="ml-2 text-xs text-tp-muted">(your collection)</span>
                            )}
                          </div>
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs ${
                              selected
                                ? "border-violet-400 bg-violet-500 text-white"
                                : "border-white/20 bg-transparent text-transparent"
                            }`}
                            aria-hidden
                          >
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {wantKind === "eth" && (
                <div className="mt-5">
                  <label htmlFor="wantEth" className="text-sm font-semibold">
                    Amount (ETH)
                  </label>
                  <input
                    id="wantEth"
                    type="text"
                    inputMode="decimal"
                    value={wantEth}
                    onChange={(e) => setWantEth(e.target.value)}
                    placeholder="e.g. 0.5"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-tp-bg px-4 py-3"
                  />
                </div>
              )}

              {wantKind === "trait" && (
                <div className="mt-5">
                  <label htmlFor="wantTrait" className="text-sm font-semibold">
                    Trait name
                  </label>
                  <input
                    id="wantTrait"
                    type="text"
                    value={wantTrait}
                    onChange={(e) => setWantTrait(e.target.value)}
                    placeholder="e.g. Skull Mask, Laser Eyes"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-tp-bg px-4 py-3"
                  />
                </div>
              )}

              <div className="mt-5">
                <label htmlFor="wantDetails" className="text-sm font-semibold">
                  {wantKind === "open" ? "What are you open to?" : "Extra details (optional)"}
                </label>
                <textarea
                  id="wantDetails"
                  value={wantDetails}
                  onChange={(e) => setWantDetails(e.target.value)}
                  placeholder={
                    wantKind === "collection"
                      ? "e.g. entry piece, #331, fair 1:1 + small ETH…"
                      : wantKind === "trait"
                        ? "e.g. any collection, prefer DDG or Long Lost…"
                        : "Anything else collectors should know…"
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-tp-bg px-4 py-3"
                />
              </div>

              <button
                type="button"
                onClick={next}
                disabled={!canContinueWant}
                className="mt-4 rounded-xl bg-violet-500 px-6 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="font-semibold">Trade type</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {TRADE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTradeType(t)}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      tradeType === t ? "border-violet-500 bg-violet-500/20" : "border-white/15"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button type="button" onClick={next} className="mt-6 rounded-xl bg-violet-500 px-6 py-2.5 font-semibold">
                Continue
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <label className="block font-semibold">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-3 w-full rounded-xl border border-white/10 bg-tp-bg px-4 py-3"
              />
              <button type="button" onClick={next} className="mt-4 rounded-xl bg-violet-500 px-6 py-2.5 font-semibold">
                Continue
              </button>
            </div>
          )}

          {step === 5 && (
            <div>
              <p className="font-semibold">Expiry (default 7 days)</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {EXPIRY.map((e) => (
                  <button
                    key={e.days}
                    type="button"
                    onClick={() => setExpiryDays(e.days)}
                    className={`rounded-xl border px-4 py-3 ${
                      expiryDays === e.days ? "border-violet-500 bg-violet-500/20" : "border-white/15"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={next} className="mt-6 rounded-xl bg-violet-500 px-6 py-2.5 font-semibold">
                Preview
              </button>
            </div>
          )}

          {step === 6 && have && selectedNft && (
            <div className="rounded-2xl border border-tp-border bg-tp-surface p-6">
              <h3 className="font-display text-lg font-bold">Preview</h3>
              <div className="mt-4 flex gap-4">
                <NftPreview
                  gradient={selectedNft.gradient}
                  label={selectedNft.label}
                  imageUrl={selectedNft.imageUrl}
                  className="w-32 shrink-0"
                />
                <div className="text-sm">
                  <p>
                    <span className="text-tp-muted">I HAVE:</span> {selectedNft.label}
                  </p>
                  <p className="mt-2">
                    <span className="text-tp-muted">I WANT:</span> {wantSummary}
                  </p>
                  {(wantKind === "collection" || wantKind === "open") && wantCollections.length > 0 && (
                    <p className="mt-1 text-xs text-tp-muted">
                      Linked to{" "}
                      {wantCollections.length === collections.length
                        ? "all community hubs"
                        : `${wantCollections.map((c) => c.shortName).join(", ")} hub${wantCollections.length > 1 ? "s" : ""}`}{" "}
                      &amp; filters
                    </p>
                  )}
                  <p className="mt-2">
                    <span className="text-tp-muted">Type:</span> {tradeType}
                  </p>
                  <p className="mt-2">
                    <span className="text-tp-muted">Expires:</span> {expiryDays} days
                  </p>
                </div>
              </div>
              <button type="button" onClick={next} className="mt-6 rounded-xl bg-violet-500 px-6 py-2.5 font-semibold">
                Continue to publish
              </button>
            </div>
          )}

          {step === 7 && (
            <div className="text-center">
              <p className="text-tp-muted">Ready to publish your listing?</p>
              <button
                type="button"
                onClick={() => setPublished(true)}
                className="mt-6 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 py-3 font-bold"
              >
                Publish mock listing
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step > 0 && step < 7 && (
        <button type="button" onClick={back} className="mt-8 text-sm text-tp-muted hover:text-white">
          ← Back
        </button>
      )}
    </div>
  );
}
