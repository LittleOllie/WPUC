/** iOS detection and mobile helpers. */

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
