import { Link } from "react-router-dom";
import SafetyNotice from "../components/SafetyNotice";

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Safety & about TradePort</h1>
      <p className="mt-4 text-lg text-tp-muted">
        TradePort by LO Labs is a curated community trading hub — not a marketplace, not escrow, and not
        on-chain trading.
      </p>

      <div className="mt-10 space-y-6 text-tp-muted">
        <section>
          <h2 className="font-display text-xl font-semibold text-white">What TradePort does</h2>
          <p className="mt-2">
            We help collectors say <strong className="text-white">I HAVE</strong>,{" "}
            <strong className="text-white">I WANT</strong>, and <strong className="text-white">FIND MATCHES</strong>{" "}
            within supported communities. You connect directly with other collectors.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold text-white">What TradePort does not do</h2>
          <ul className="mt-2 list-inside list-disc space-y-2">
            <li>Process payments or escrow</li>
            <li>Execute swaps or transfers on-chain</li>
            <li>Request wallet approvals for trading</li>
            <li>Guarantee trade outcomes</li>
          </ul>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold text-white">Before you trade</h2>
          <ul className="mt-2 list-inside list-disc space-y-2">
            <li>Verify the other party&apos;s identity and ownership</li>
            <li>Never trust screenshots alone — confirm on-chain</li>
            <li>Never click suspicious links in DMs</li>
            <li>Trade at your own risk</li>
          </ul>
        </section>
      </div>

      <SafetyNotice className="mt-10" />

      <div className="mt-10 flex flex-wrap gap-4">
        <Link to="/trades" className="rounded-xl bg-violet-500 px-5 py-2.5 font-semibold">
          Browse trades
        </Link>
        <Link to="/collections" className="rounded-xl border border-white/15 px-5 py-2.5 font-semibold">
          Communities
        </Link>
      </div>
    </div>
  );
}
