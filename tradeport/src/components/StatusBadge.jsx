const config = {
  Active: { label: "Open", className: "bg-emerald-500/25 text-emerald-200 border-emerald-400/40" },
  "In Talks": { label: "In Talks", className: "bg-amber-500/25 text-amber-200 border-amber-400/40" },
  Pending: { label: "Pending", className: "bg-blue-500/25 text-blue-200 border-blue-400/40" },
  Expired: { label: "Expired", className: "bg-red-500/20 text-red-300 border-red-400/35" },
  Completed: { label: "Completed", className: "bg-slate-500/25 text-slate-300 border-slate-400/35" },
};

export default function StatusBadge({ status, className = "" }) {
  const c = config[status] ?? { label: status, className: "bg-white/10 text-white/60 border-white/20" };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${c.className} ${className}`}
    >
      {c.label}
    </span>
  );
}
