import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import CollectionLogo from "./CollectionLogo";
import { collectionThemeStyle } from "../utils/theme";

export default function CommunitySpotlight({ collection }) {
  const theme = collection.theme;
  const highlights = collection.highlights || [];
  const vibeTags = collection.vibe?.split(",").map((s) => s.trim()).filter(Boolean) || [];

  const stats = [
    { label: "Active trades", value: collection.activeTrades },
    { label: "Wanted listings", value: collection.wantedCount },
    { label: "Chain", value: collection.chain },
  ];

  const links = [
    { label: "Website", href: collection.website },
    { label: "X / Twitter", href: collection.twitter },
    { label: "OpenSea", href: collection.openSea },
    { label: "Discord", href: collection.discord },
  ].filter((l) => l.href);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="relative overflow-hidden rounded-3xl border border-white/10"
      style={{
        ...collectionThemeStyle(theme),
        background: `linear-gradient(160deg, ${theme.background} 0%, ${theme.primary}22 40%, ${theme.background} 100%)`,
        boxShadow: `0 24px 64px ${theme.primary}20`,
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${theme.primary}55, transparent)`,
        }}
      />

      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: theme.secondary }}>
            Why collectors join
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
            Discover <span style={{ color: theme.accent }}>{collection.name}</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/80 sm:text-lg">{collection.description}</p>

          {highlights.length > 0 && (
            <ul className="mt-6 space-y-3">
              {highlights.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-white/75 sm:text-base">
                  <span
                    className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: theme.primary }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          )}

          {vibeTags.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-tp-muted">The vibe</p>
              <motion.div className="mt-2 flex flex-wrap gap-2">
                {vibeTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border px-3 py-1 text-xs font-semibold capitalize"
                    style={{
                      borderColor: `${theme.primary}66`,
                      background: `${theme.primary}18`,
                      color: theme.secondary,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </motion.div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div
            className="flex flex-col items-center rounded-2xl border border-white/10 bg-black/25 p-6 text-center backdrop-blur-sm"
            style={{ boxShadow: `inset 0 0 40px ${theme.primary}15` }}
          >
            <CollectionLogo collection={collection} className="h-24 w-24 sm:h-28 sm:w-28" textClass="text-3xl" />
            <p className="mt-4 font-display text-lg font-bold">{collection.shortName}</p>
            <p className="mt-1 text-sm text-tp-muted">{collection.chain} mainnet</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {stats.map((s) => (
              <motion.div
                key={s.label}
                className="rounded-xl border border-white/10 bg-black/30 px-2 py-3 text-center sm:px-3 sm:py-4"
              >
                <p className="font-display text-xl font-bold sm:text-2xl" style={{ color: theme.accent }}>
                  {s.value}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-tp-muted sm:text-xs">
                  {s.label}
                </p>
              </motion.div>
            ))}
          </div>

          {links.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-tp-muted">Official links</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm font-semibold transition hover:border-white/30 hover:bg-white/10"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div
            className="mt-auto rounded-2xl border p-5 sm:p-6"
            style={{
              borderColor: `${theme.primary}55`,
              background: `linear-gradient(135deg, ${theme.primary}33, ${theme.background}cc)`,
            }}
          >
            <p className="font-display text-lg font-bold">Ready to join?</p>
            <p className="mt-2 text-sm text-white/70">
              Browse entry offers from collectors who want to trade into {collection.shortName}.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/join"
                className="flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold text-white"
                style={{ background: theme.primary, boxShadow: `0 6px 24px ${theme.primary}55` }}
              >
                Explore joining
              </Link>
              <a
                href={collection.openSea}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-center text-sm font-semibold"
              >
                View on OpenSea
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
