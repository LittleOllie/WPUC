import { SafetyShield } from "./TrustBadge";

export default function SafetyNotice({ compact = false, className = "" }) {
  if (compact) {
    return (
      <p className={`flex items-start gap-2 text-sm text-tp-muted ${className}`}>
        <SafetyShield className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" />
        <span>No escrow. No approvals. No on-chain trading. TradePort only helps collectors connect.</span>
      </p>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/8 to-transparent p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
          <SafetyShield className="h-5 w-5 text-amber-300" />
        </div>
        <h3 className="font-display text-lg font-semibold text-amber-100">Safety first</h3>
      </div>
      <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-tp-muted">
        <li>No wallet approvals in the live version — ever.</li>
        <li>No transactions through TradePort — collectors trade directly.</li>
        <li>Always verify who you are dealing with before agreeing to anything.</li>
        <li>Never trust screenshots alone — confirm ownership on-chain.</li>
        <li>Never click suspicious links sent in DMs.</li>
      </ul>
    </div>
  );
}
