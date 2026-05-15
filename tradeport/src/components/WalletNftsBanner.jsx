import { Link } from "react-router-dom";
import ConnectWalletButton from "./ConnectWalletButton";
import { useWallet } from "../context/WalletContext";

export default function WalletNftsBanner({ collection, loading, error, nftCount }) {
  const { isConnected, isMainnet } = useWallet();

  if (isConnected && isMainnet && nftCount > 0) {
    return (
      <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        Showing {nftCount} {collection.shortName} NFT{nftCount === 1 ? "" : "s"} from your connected wallet.
      </p>
    );
  }

  if (isConnected && isMainnet && !loading && error) {
    return (
      <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        {error}{" "}
        <Link to="/create" className="underline">
          Create a trade
        </Link>{" "}
        for another collection you hold.
      </p>
    );
  }

  if (isConnected && !isMainnet) {
    return (
      <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Switch MetaMask to <strong>Ethereum Mainnet</strong> to load NFTs here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-tp-muted">
        <strong className="text-white">Connect your wallet</strong> to display your real{" "}
        {collection.shortName} NFTs in the showcase below.
      </p>
      <ConnectWalletButton />
    </div>
  );
}
