import { useEffect, useState } from "react";
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
  const [wantText, setWantText] = useState("");
  const [tradeType, setTradeType] = useState("WTT");
  const [notes, setNotes] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [published, setPublished] = useState(false);

  const have = collections.find((c) => c.id === haveCollection);

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
              <label className="block font-semibold">What do you WANT?</label>
              <textarea
                value={wantText}
                onChange={(e) => setWantText(e.target.value)}
                placeholder="e.g. Long Lost entry, 0.5 ETH, Skull Mask trait…"
                rows={4}
                className="mt-3 w-full rounded-xl border border-white/10 bg-tp-bg px-4 py-3"
              />
              <button type="button" onClick={next} className="mt-4 rounded-xl bg-violet-500 px-6 py-2.5 font-semibold">
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
                    <span className="text-tp-muted">I WANT:</span> {wantText || "—"}
                  </p>
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
