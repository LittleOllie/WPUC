import { motion } from "framer-motion";

export default function FounderMessage({ collection }) {
  const theme = collection.theme;
  const tagline = collection.tagline || collection.founderMessage;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative overflow-hidden rounded-3xl border border-white/10 p-8 sm:p-10"
      style={{
        background: `linear-gradient(135deg, ${theme.background}ee 0%, ${theme.primary}15 50%, ${theme.background}ee 100%)`,
        boxShadow: `inset 0 1px 0 ${theme.primary}33, 0 24px 48px ${theme.primary}15`,
      }}
    >
      <div
        className="pointer-events-none absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full blur-3xl opacity-40"
        style={{ background: theme.primary }}
      />
      <p
        className="relative text-xs font-bold uppercase tracking-[0.2em]"
        style={{ color: theme.secondary }}
      >
        Message from the community
      </p>
      <blockquote
        className="relative mt-4 font-display text-2xl font-bold leading-snug sm:text-3xl md:text-4xl"
        style={{ color: theme.accent }}
      >
        &ldquo;{tagline}&rdquo;
      </blockquote>
      <p className="relative mt-6 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
        {collection.founderMessage}
      </p>
    </motion.section>
  );
}
