import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWallet } from "./WalletContext";
import { isProfileComplete, loadProfile, saveProfile as persistProfile } from "../lib/profileStorage";

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { address, isConnected } = useWallet();
  const [profile, setProfile] = useState(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!address) {
      setProfile(null);
      setShowSetup(false);
      return;
    }
    const stored = loadProfile(address);
    setProfile(stored);
    setShowSetup(!isProfileComplete(stored));
  }, [address]);

  const saveProfile = useCallback(
    (updates) => {
      if (!address) return null;
      const merged = {
        ...profile,
        ...updates,
        walletAddress: address,
        completedAt: new Date().toISOString(),
      };
      const saved = persistProfile(address, merged);
      setProfile(saved);
      setShowSetup(false);
      return saved;
    },
    [address, profile]
  );

  const openSetup = useCallback(() => setShowSetup(true), []);
  const closeSetup = useCallback(() => {
    if (isProfileComplete(profile)) setShowSetup(false);
  }, [profile]);

  const needsSetup = isConnected && !isProfileComplete(profile);

  const value = useMemo(
    () => ({
      profile,
      needsSetup,
      showSetup,
      isProfileComplete: isProfileComplete(profile),
      saveProfile,
      openSetup,
      closeSetup,
    }),
    [profile, needsSetup, showSetup, saveProfile, openSetup, closeSetup]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
