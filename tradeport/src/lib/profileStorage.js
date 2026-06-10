const STORAGE_PREFIX = "tradeport:profile:";

export function profileKey(address) {
  if (!address) return null;
  return `${STORAGE_PREFIX}${address.toLowerCase()}`;
}

export function loadProfile(address) {
  const key = profileKey(address);
  if (!key || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProfile(address, profile) {
  const key = profileKey(address);
  if (!key || typeof localStorage === "undefined") return null;
  const next = { ...profile, updatedAt: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function isProfileComplete(profile) {
  if (!profile) return false;
  const name = profile.displayName?.trim();
  const collection = profile.primaryCollectionId;
  return Boolean(name && collection);
}
