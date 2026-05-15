import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useProfile } from "../context/ProfileContext";

export default function ConnectWalletButton({ className = "" }) {
  const { isConnected, shortAddress, isConnecting, connect, disconnect, error } = useWallet();
  const { needsSetup } = useProfile();

  if (isConnected) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Link
          to="/profile"
          className={`hidden rounded-lg border px-3 py-2 text-xs font-semibold sm:inline ${
            needsSetup
              ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {needsSetup ? "Set up profile" : shortAddress}
        </Link>
        <button
          type="button"
          onClick={disconnect}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10 sm:px-4"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={isConnecting}
        onClick={connect}
        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-60 sm:w-auto"
      >
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-amber-400">{error}</p>}
    </div>
  );
}
