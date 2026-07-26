/**
 * Lazy-load GIF export vendor scripts (same-origin) when needed.
 */

let gifLibsPromise = null;

export function loadGifExportLibs() {
  if (typeof window.GIF === "function" && typeof window.applyLoGifBranding === "function") {
    return Promise.resolve();
  }
  if (gifLibsPromise) return gifLibsPromise;

  gifLibsPromise = new Promise((resolve, reject) => {
    const scripts = ["vendor/loGifBranding.js", "vendor/gif.js"];
    let i = 0;
    const loadNext = () => {
      if (i >= scripts.length) {
        resolve();
        return;
      }
      const src = scripts[i++];
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        loadNext();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = () => loadNext();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    };
    loadNext();
  });

  return gifLibsPromise;
}
