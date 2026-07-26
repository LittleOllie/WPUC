/** Shared FlexGrid constants (no DOM dependencies). */

export const DEV =
  typeof window !== "undefined" && window.location?.hostname === "localhost";

/** Max NFTs (including custom uploads) in one grid build / reorder. */
export const FLEX_GRID_MAX_NFTS = 900;

/** Whale mode activates above this tile count. */
export const WHALE_MODE_THRESHOLD = 300;

/** Points users to #retryBtn when image loads fail. */
export const RETRY_MISSING_BUTTON_HINT =
  "Try the 🔄 Retry missing button above.";

export const MAX_WALLET_ADDRESSES = 12;

export const APP_SETTINGS_VERSION = "v2 Beta";

export const EXPORT_WATERMARK_TEXT = "⚡ Powered by Little Ollie";

export const HUB_LINKS_PAGE = "https://littleollielabs.com/links/";

export const MAX_CONCURRENT_LOADS_DEFAULT = 8;
export const MAX_CONCURRENT_LOADS_WHALE = 5;

export const TILE_PLACEHOLDER_SRC = "src/assets/images/tile.png";
export const GRID_LOADING_PLACEHOLDER_SRC = "src/assets/images/LO.png";

export const PLACEHOLDER_DATA_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%23333' width='1' height='1'/%3E%3C/svg%3E";

export const GRID_EMPTY_SENTINEL = Object.freeze({ _gridEmpty: true });

export const ALCHEMY_HOST = {
  eth: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
  apechain: "apechain-mainnet.g.alchemy.com",
};

/** When true, show the dev-only error log panel. */
export const SHOW_ERROR_PANEL = false;

export function isWhaleModeCount(n) {
  return Math.max(0, Math.round(Number(n) || 0)) > WHALE_MODE_THRESHOLD;
}
