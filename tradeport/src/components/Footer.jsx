import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="relative z-10 mt-auto border-t border-tp-border bg-tp-surface/60 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold">TradePort</p>
            <p className="text-sm text-tp-muted">by LO Labs</p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            <Link to="/about" className="text-tp-muted hover:text-white">
              Safety
            </Link>
            <Link to="/collections" className="text-tp-muted hover:text-white">
              Communities
            </Link>
            <Link to="/trades" className="text-tp-muted hover:text-white">
              Trades
            </Link>
          </nav>
        </div>
        <p className="mt-8 max-w-2xl text-xs leading-relaxed text-tp-muted">
          TradePort does not process trades, payments, escrow, or asset transfers. Collectors connect
          directly and trade at their own risk.
        </p>
      </div>
    </footer>
  );
}
