import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import CollectionLogo from "./CollectionLogo";
import NftStackPreview from "./NftStackPreview";
import { collectionThemeStyle } from "../utils/theme";

const CARD_STYLES = {
  ddg: {
    overlay: "from-fuchsia-500/10 via-transparent to-cyan-500/5",
    glowA: "rgba(230, 60, 180, 0.55)",
    glowB: "rgba(100, 213, 223, 0.25)",
  },
  longlost: {
    overlay: "from-violet-600/15 via-transparent to-emerald-500/5",
    glowA: "rgba(139, 61, 255, 0.5)",
    glowB: "rgba(57, 255, 136, 0.2)",
  },
  quirkies: {
    overlay: "from-cyan-400/15 via-transparent to-pink-500/10",
    glowA: "rgba(0, 212, 255, 0.45)",
    glowB: "rgba(255, 79, 163, 0.3)",
  },
};

export default function CollectionCard({ collection, large = false, selected = false }) {
  const theme = collection.theme;
  const accent = CARD_STYLES[collection.id] || CARD_STYLES.ddg;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6 }}
      className={`tp-glow-border tp-card-lift group relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${
        large ? "sm:p-8" : ""
      } ${selected ? "border-white/30 ring-2 ring-white/20" : "border-white/10"}`}
      style={{
        ...collectionThemeStyle(theme),
        ["--glow-a"]: accent.glowA,
        ["--glow-b"]: accent.glowB,
        background: `linear-gradient(160deg, ${theme.background} 0%, ${theme.primary}28 45%, ${theme.background} 100%)`,
        boxShadow: `0 8px 32px ${theme.primary}22, 0 0 0 1px ${theme.primary}11`,
      }}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.overlay} opacity-80`} />
      <motion.div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-50"
        style={{ background: theme.primary }}
        animate={{ opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col gap-4">
        <NftStackPreview collection={collection} />

        <div className="flex items-start gap-4">
          <CollectionLogo collection={collection} className={large ? "h-14 w-14" : "h-12 w-12"} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-bold sm:text-2xl">{collection.name}</h3>
            <p className="mt-0.5 text-sm text-white/55">{collection.chain}</p>
          </div>
        </div>

        <p className="line-clamp-2 text-sm text-white/70">{collection.description}</p>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1 backdrop-blur-sm">
            <strong className="text-white">{collection.activeTrades}</strong>{" "}
            <span className="text-white/60">active</span>
          </span>
          <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1 backdrop-blur-sm">
            <strong className="text-white">{collection.wantedCount}</strong>{" "}
            <span className="text-white/60">wanted</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            to={`/collection/${collection.id}`}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
            style={{ background: theme.primary, boxShadow: `0 4px 20px ${theme.primary}55` }}
          >
            View Hub
          </Link>
          <Link
            to={`/trades?collection=${collection.id}`}
            className="tp-btn-ghost rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Browse Trades
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
