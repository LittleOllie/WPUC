import { motion, AnimatePresence } from "framer-motion";
import { formatGrassTime } from "../lib/grassEngine.js";
import { PROGRESSION_THRESHOLDS_MS } from "../lib/constants.js";

function RecoveryChart({ history }) {
  const days = Object.keys(history)
    .sort()
    .slice(-7);
  const values = days.map((d) => (history[d] || 0) / 60_000);
  const max = Math.max(1, ...values);

  const w = 240;
  const h = 64;
  const pad = 4;
  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[280px]" aria-hidden>
      <defs>
        <linearGradient id="grassChart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5cb86a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#5cb86a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="#3d8f4f"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {values.length > 1 && (
        <polygon
          fill="url(#grassChart)"
          points={`${points} ${w - pad},${h - pad} ${pad},${h - pad}`}
        />
      )}
    </svg>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border-2 border-[#1a2e1f]/10 bg-white/80 px-3 py-2 shadow-sm">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#1a2e1f]/55">
        {label}
      </p>
      <p className="text-lg font-bold text-[#1a2e1f]">{value}</p>
      {sub && <p className="text-[0.7rem] text-[#1a2e1f]/60">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPanel({ open, onClose, state, progressionLevel }) {
  const tier =
    PROGRESSION_THRESHOLDS_MS.find((t) => t.level === progressionLevel) ||
    PROGRESSION_THRESHOLDS_MS[0];

  const weeklyMs = Object.values(state.dailyHistory || {}).reduce((a, b) => a + b, 0);
  const stability = Math.min(100, Math.round((state.todayGrassMs / 600_000) * 100));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-[#1a2e1f]/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="Close recovery panel"
          />
          <motion.aside
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[72dvh] overflow-y-auto rounded-t-3xl border-2 border-[#1a2e1f]/12 bg-[#fffdf8] p-4 shadow-[0_-12px_40px_rgba(26,46,31,0.15)] sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:rounded-3xl"
            initial={{ y: "100%", opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            role="dialog"
            aria-labelledby="pog-panel-title"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 id="pog-panel-title" className="text-lg font-bold text-[#1a2e1f]">
                  Touch Grass Index
                </h2>
                <p className="text-xs text-[#1a2e1f]/60">Recovery Trend · parody edition</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border-2 border-[#1a2e1f]/15 bg-white px-3 py-1 text-sm font-bold"
              >
                Close
              </button>
            </div>

            <div className="mb-4 rounded-2xl border-2 border-[#3d8f4f]/20 bg-[#e8f8ec]/80 p-3">
              <p className="mb-1 text-xs font-semibold text-[#2d6b3a]">Recovery Trend</p>
              <RecoveryChart history={state.dailyHistory} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Today" value={formatGrassTime(state.todayGrassMs)} />
              <Stat
                label="Streak"
                value={`${state.streak || 0} day${state.streak === 1 ? "" : "s"}`}
                sub="Outside Momentum"
              />
              <Stat
                label="Lifetime"
                value={formatGrassTime(state.totalGrassMs)}
                sub="Total grass exposure"
              />
              <Stat
                label="Mental Stability"
                value={`${stability}%`}
                sub="CT toxicity reduced"
              />
            </div>

            <p className="mt-3 text-center text-xs text-[#1a2e1f]/50">
              Lawn status: <strong>{tier.label}</strong> · weekly{" "}
              {formatGrassTime(weeklyMs)}
            </p>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
