import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import CollectionLogo from "./CollectionLogo";
import { collectionThemeStyle } from "../utils/theme";

const SOCIAL_LABELS = { Website: "Website", X: "X", OpenSea: "OpenSea", Discord: "Discord" };

export default function CommunityHero({ collection }) {
  const theme = collection.theme;
  const socials = [
    { label: "Website", href: collection.website },
    { label: "X", href: collection.twitter },
    { label: "OpenSea", href: collection.openSea },
    { label: "Discord", href: collection.discord },
  ].filter((s) => s.href);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-10"
      style={{
        ...collectionThemeStyle(theme),
        background: `linear-gradient(145deg, ${theme.background} 0%, ${theme.primary}40 35%, ${theme.background} 100%)`,
        boxShadow: `0 0 80px ${theme.primary}30, inset 0 1px 0 ${theme.secondary}33`,
      }}
    >
      <motion.div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: theme.secondary }}
        animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full blur-3xl"
        style={{ background: theme.primary }}
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
      />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <motion.div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <motion.div whileHover={{ scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }}>
            <CollectionLogo collection={collection} className="h-20 w-20 sm:h-28 sm:w-28" textClass="text-2xl" />
          </motion.div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: theme.secondary }}>
              Community Hub
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl lg:text-5xl">{collection.name}</h1>
            <p className="mt-3 max-w-xl text-base text-white/75">{collection.description}</p>
          </div>
        </motion.div>

        <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-white/20 bg-black/30 px-4 py-2 text-sm font-medium backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/10"
              style={{ ["--tw-shadow-color"]: theme.primary }}
            >
              {SOCIAL_LABELS[s.label] || s.label}
            </a>
          ))}
        </div>
      </div>

      <div className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a
          href={collection.openSea}
          target="_blank"
          rel="noopener noreferrer"
          className="tp-btn-primary inline-flex justify-center rounded-xl px-6 py-3.5 text-sm font-bold text-white"
          style={{ background: theme.primary, boxShadow: `0 8px 32px ${theme.primary}55` }}
        >
          Browse on OpenSea
        </a>
        <Link
          to={`/trades?collection=${collection.id}`}
          className="tp-btn-ghost inline-flex justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold"
        >
          View Active Trades
        </Link>
        <Link
          to="/create"
          className="tp-btn-ghost inline-flex justify-center rounded-xl border-2 px-6 py-3.5 text-sm font-semibold"
          style={{ borderColor: theme.accent, color: theme.accent }}
        >
          Create Trade
        </Link>
      </div>
    </motion.section>
  );
}
