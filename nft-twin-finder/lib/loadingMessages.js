export const LOADING_MESSAGES = [
  "Checking traits...",
  "Comparing hats...",
  "Looking for twins...",
  "Matching glasses...",
  "Finding your closest clone...",
  "Almost there...",
];

export function createLoadingRotator(onTick, intervalMs = 1400) {
  let index = 0;
  onTick(LOADING_MESSAGES[0]);
  const id = window.setInterval(() => {
    index = (index + 1) % LOADING_MESSAGES.length;
    onTick(LOADING_MESSAGES[index]);
  }, intervalMs);
  return () => window.clearInterval(id);
}
