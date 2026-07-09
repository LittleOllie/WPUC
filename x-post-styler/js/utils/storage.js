const STORAGE_KEY = "lo-x-post-styler-draft-v1";

/**
 * @param {{ rawPost: string, sections: object[], settings: object }} data
 */
function saveDraft(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

Object.assign(window.XPStyler = window.XPStyler || {}, {
  saveDraft,
  loadDraft,
  clearDraft,
});
