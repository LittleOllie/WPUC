import {
  filterHandleInput,
  isValidHandle,
  normalizeHandleInput,
  MAX_HANDLE_LENGTH,
} from "./xhandle";

export { filterHandleInput, isValidHandle, normalizeHandleInput, MAX_HANDLE_LENGTH };

/** @deprecated Prefer normalizeHandleInput — kept for existing components */
export function normalizeHandle(raw: string): string {
  return normalizeHandleInput(raw);
}

export const X_HANDLE_STORAGE_KEY = "frappy_x_handle";

export function readStoredHandle(): string | null {
  try {
    const v = localStorage.getItem(X_HANDLE_STORAGE_KEY);
    if (v == null || v === "") return null;
    return v;
  } catch {
    return null;
  }
}

/** Alias for leaderboard / shell — same as readStoredHandle */
export function getSavedHandle(): string | null {
  return readStoredHandle();
}

export function writeStoredHandle(handle: string): void {
  localStorage.setItem(X_HANDLE_STORAGE_KEY, handle);
}
