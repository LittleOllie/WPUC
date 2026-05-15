import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { collections } from "../data/collections";
import CollectionCard from "../components/CollectionCard";
import SafetyNotice from "../components/SafetyNotice";
import LiveActivityFeed from "../components/LiveActivityFeed";
import { SafetyShield } from "../components/TrustBadge";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="tp-hero-card relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-10 lg:p-12">
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-950/90 via-tp-surface/95 to-fuchsia-950/50"
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl tp-hero-glow" />
        <motion.div
          className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl"
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300 sm:text-sm">
            TradePort by LO Labs
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
            I Have. I Want.{" "}
            <span className="tp-gradient-text block sm:inline">Find a Match.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-tp-muted sm:text-lg">
            A curated community trading hub for collectors looking to swap, sell, hunt traits, or trade into
            new NFT communities.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/create"
              className="tp-btn-primary inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-violet-500/30 sm:min-w-[160px]"
            >
              Start a Trade
            </Link>
            <Link
              to="/trades"
              className="tp-btn-ghost inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-center text-sm font-semibold sm:min-w-[140px]"
            >
              Browse Trades
            </Link>
            <Link
              to="/collections"
              className="tp-btn-ghost inline-flex items-center justify-center rounded-xl border border-white/15 bg-transparent px-6 py-3.5 text-center text-sm font-semibold text-tp-muted hover:text-white sm:min-w-[160px]"
            >
              Explore Communities
            </Link>
          </div>

          <p className="mt-6 flex items-start gap-2 text-sm text-amber-200/90">
            <SafetyShield className="mt-0.5 h-5 w-5 shrink-0 text-amber-300/80" />
            <span>No escrow. No approvals. No on-chain trading. TradePort only helps collectors connect.</span>
          </p>
        </motion.div>
      </section>

      <section className="mt-16 sm:mt-20">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Supported communities</h2>
        <p className="mt-2 text-tp-muted">Walk into a community — see the art, feel the vibe, find your match.</p>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {collections.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <CollectionCard collection={c} large />
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-tp-border bg-tp-surface/40 p-6 backdrop-blur-sm sm:mt-20 sm:p-8">
        <h2 className="font-display text-2xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {[
            { step: "1", title: "Choose what you have", desc: "Select your NFT from a supported community." },
            { step: "2", title: "Choose what you want", desc: "ETH, another NFT, traits, or community entry." },
            { step: "3", title: "Find collectors & connect safely", desc: "Browse matches and reach out directly." },
          ].map((item) => (
            <li
              key={item.step}
              className="tp-card-lift rounded-xl border border-white/5 bg-white/[0.04] p-5 sm:p-6"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/20 font-display text-lg font-bold text-violet-300"
              >
                {item.step}
              </span>
              <h3 className="mt-4 font-semibold text-base sm:text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-tp-muted">{item.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <LiveActivityFeed />

      <section className="mt-16 sm:mt-20">
        <SafetyNotice />
      </section>
    </div>
  );
}
