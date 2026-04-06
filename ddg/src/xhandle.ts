/** localStorage key for saved X / Twitter handle (no @). */
export const XHANDLE_STORAGE_KEY = "frappybrew_xhandle";

const MAX_LEN = 15;

/** Returns trimmed saved handle or null if missing / empty. */
export function getSavedHandle(): string | null {
  try {
    const v = localStorage.getItem(XHANDLE_STORAGE_KEY);
    if (v == null) return null;
    const t = v.trim();
    return t === "" ? null : t;
  } catch {
    return null;
  }
}

/** Strip leading @ and keep only a-z A-Z 0-9 _, max length. */
export function normalizeHandleInput(raw: string): string {
  let s = raw.replace(/^@+/, "");
  s = s.replace(/[^a-zA-Z0-9_]/g, "");
  return s.slice(0, MAX_LEN);
}

export function saveHandle(handle: string): void {
  try {
    localStorage.setItem(XHANDLE_STORAGE_KEY, handle);
  } catch {
    /* private mode / quota — caller should still continue UI flow */
  }
}
