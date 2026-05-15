import { useWallet } from "../context/WalletContext";
import ConnectWalletButton from "./ConnectWalletButton";
import { VerifiedBadge } from "./TrustBadge";

export default function MockWalletNotice({ className = "" }) {
  const { isConnected, isMainnet, address } = useWallet();

  if (isConnected) {
    return (
      <div
        className={`rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 sm:p-5 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <VerifiedBadge />
            <p className="mt-2 text-sm text-tp-muted">
              Connected: <span className="font-mono text-white/80">{address}</span>
            </p>
            {!isMainnet && (
              <p className="mt-1 text-xs text-amber-400">Switch to Ethereum Mainnet to load supported NFTs.</p>
            )}
          </div>
          <ConnectWalletButton />
        </div>
        <p className="mt-3 text-xs text-tp-muted">Read-only connection — no approvals, no transactions.</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[var(--collection-primary,#7c5cff)]/30 bg-[var(--collection-primary,#7c5cff)]/10 p-4 sm:p-5 ${className}`}
    >
      <p className="text-sm font-medium text-tp-text">Connect your wallet to verify what you own.</p>
      <p className="mt-1 text-sm text-tp-muted">No approvals. No transactions. Read-only.</p>
      <ConnectWalletButton className="mt-4" />
    </div>
  );
}
