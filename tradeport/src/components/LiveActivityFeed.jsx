import { motion } from "framer-motion";
import { getCollectionById } from "../data/collections";
import CollectionLogo from "./CollectionLogo";

const ACTIVITY = [
  {
    id: "a1",
    collectionId: "ddg",
    text: "DDG collector looking to enter Long Lost",
    time: "2m ago",
    pulse: true,
  },
  {
    id: "a2",
    collectionId: "quirkies",
    text: "Quirkies trait hunt posted — Skull Mask",
    time: "8m ago",
  },
  {
    id: "a3",
    collectionId: "longlost",
    text: "Long Lost grail listing marked In Talks",
    time: "14m ago",
  },
  {
    id: "a4",
    collectionId: "ddg",
    text: "Cross-community WTT gaining interest",
    time: "22m ago",
  },
];

export default function LiveActivityFeed() {
  return (
    <section className="mt-16">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Live activity</h2>
      </div>
      <ul className="mt-5 space-y-3">
        {ACTIVITY.map((item, i) => {
          const col = getCollectionById(item.collectionId);
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ x: 4 }}
              className="tp-card-lift group flex items-center gap-3 rounded-xl border border-tp-border bg-tp-surface/50 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4"
            >
              {col && <CollectionLogo collection={col} className="h-9 w-9 shrink-0" textClass="text-xs" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/90 sm:text-base">{item.text}</p>
                <p className="mt-0.5 text-xs text-tp-muted">{item.time}</p>
              </div>
              {item.pulse && (
                <span className="hidden shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 sm:inline">
                  New
                </span>
              )}
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
