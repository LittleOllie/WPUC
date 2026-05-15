import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import CollectionLogo from "./CollectionLogo";
import { collectionThemeStyle } from "../utils/theme";

export default function CommunityHero({ collection }) {
  const theme = collection.theme;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 px-6 py-10 text-center sm:px-12 sm:py-14"
      style={{
        ...collectionThemeStyle(theme),
        background: `linear-gradient(145deg, ${theme.background} 0%, ${theme.primary}35 50%, ${theme.background} 100%)`,
        boxShadow: `0 0 100px ${theme.primary}35, inset 0 1px 0 ${theme.secondary}33`,
      }}
    >
      <motion.div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: theme.secondary }}
        animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full blur-3xl"
        style={{ background: theme.primary }}
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center">
        <motion.div whileHover={{ scale: 1.04 }} transition={{ type: "spring", stiffness: 300 }}>
          <CollectionLogo collection={collection} className="h-28 w-28 sm:h-36 sm:w-36" textClass="text-4xl" />
        </motion.div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
          Collection showcase
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl lg:text-6xl">{collection.name}</h1>

        {collection.tagline && (
          <p
            className="mt-4 font-display text-xl font-semibold italic sm:text-2xl lg:text-3xl"
            style={{ color: theme.accent }}
          >
            &ldquo;{collection.tagline}&rdquo;
          </p>
        )}

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
          {collection.description}
        </p>

        <div className="mt-8 flex w-full max-w-lg flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/join"
            className="inline-flex justify-center rounded-xl px-8 py-4 text-sm font-bold text-white"
            style={{ background: theme.primary, boxShadow: `0 8px 32px ${theme.primary}55` }}
          >
            I want to join {collection.shortName}
          </Link>
          <a
            href={collection.openSea}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center rounded-xl border border-white/25 bg-white/5 px-8 py-4 text-sm font-semibold backdrop-blur-sm"
          >
            View collection on OpenSea
          </a>
        </div>

        <Link
          to={`/trades?involves=${collection.id}`}
          className="mt-4 text-sm font-semibold transition hover:underline"
          style={{ color: theme.secondary }}
        >
          See active trades involving {collection.shortName} →
        </Link>
      </div>
    </motion.section>
  );
}
