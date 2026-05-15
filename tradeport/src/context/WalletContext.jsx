import { createContext, useCallback, useContext, useMemo, useState } from "react";

const WalletContext = createContext(null);

const ETH_MAINNET = "0x1";

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const hasProvider = typeof window !== "undefined" && !!window.ethereum;

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("No wallet found. Install MetaMask or open in a Web3 browser.");
      return null;
    }
    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const acc = accounts?.[0] || null;
      const cid = await window.ethereum.request({ method: "eth_chainId" });
      setAddress(acc);
      setChainId(cid);
      if (cid && cid !== ETH_MAINNET) {
        setError("TradePort uses Ethereum Mainnet. Switch network in your wallet.");
      }
      return acc;
    } catch (e) {
      setError(e?.message || "Could not connect wallet");
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setError(null);
  }, []);

  const shortAddress = useMemo(() => {
    if (!address) return null;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }, [address]);

  const isMainnet = chainId === ETH_MAINNET;

  const value = useMemo(
    () => ({
      address,
      shortAddress,
      chainId,
      isMainnet,
      hasProvider,
      isConnecting,
      error,
      isConnected: !!address,
      connect,
      disconnect,
      setError,
    }),
    [address, shortAddress, chainId, isMainnet, hasProvider, isConnecting, error, connect, disconnect]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
