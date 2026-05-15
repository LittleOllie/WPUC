const styles = {
  WTT: "bg-violet-500/25 text-violet-200 border-violet-400/35 shadow-violet-500/10",
  WTS: "bg-emerald-500/25 text-emerald-200 border-emerald-400/35",
  WTB: "bg-amber-500/25 text-amber-200 border-amber-400/35",
  "Community Entry": "bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/35",
  "Trait Hunt": "bg-cyan-500/25 text-cyan-200 border-cyan-400/35",
  "Open To Offers": "bg-slate-400/20 text-slate-200 border-slate-400/30",
};

export default function TradeTypeBadge({ type, className = "" }) {
  const style = styles[type] ?? "bg-white/10 text-white/70 border-white/20";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-sm ${style} ${className}`}
    >
      {type}
    </span>
  );
}
