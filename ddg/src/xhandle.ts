/**
 * X handle normalization for UI + Firestore document IDs.
 * Allowed: [a-zA-Z0-9_], max length 15.
 */

export const MAX_HANDLE_LENGTH = 15;

/** Strip leading @, keep only [a-zA-Z0-9_], cap length. Use before any leaderboard write. */
export function normalizeHandleInput(raw: string): string {
  let s = raw.trim();
  while (s.startsWith("@")) s = s.slice(1);
  s = s.replace(/[^a-zA-Z0-9_]/g, "");
  return s.slice(0, MAX_HANDLE_LENGTH);
}

export function filterHandleInput(raw: string): string {
  let s = raw.replace(/[^a-zA-Z0-9_]/g, "");
  while (s.startsWith("@")) s = s.slice(1);
  return s.slice(0, MAX_HANDLE_LENGTH);
}

export function isValidHandle(s: string): boolean {
  return normalizeHandleInput(s).length > 0;
}
