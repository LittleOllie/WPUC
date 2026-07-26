/** Application state (shared mutable singleton). */

export let currentStep = 0;

export const uiState = {
  step: 1,
  chain: null,
  wallet: null,
};

export const state = {
  collections: [],
  selectedKeys: new Set(),
  selectionModeByCollection: {},
  selectedNFTsByCollection: {},
  selectedSortByCollection: {},
  gridCollectionOrder: [],
  wallets: [],
  chain: "eth",
  host: "eth-mainnet.g.alchemy.com",
  walletCollapsed: false,
  collectionsCollapsed: true,
  traitOrderCollapsed: true,
  selectedLayout: "classic",
  gridLayoutMeta: null,
  customImages: [],
  selectedCustomImageIds: new Set(),
  customImageRemoveMode: false,
  includeCollectionLogoInBuild: new Set(),
  contractLogoCache: Object.create(null),
  contractLogoInflight: new Map(),
  isSettingsOpen: false,
  settingsCanvasBg: "theme",
  settingsGridSpacing: "none",
  settingsTileBorder: false,
  settingsKeepGridSquare: true,
  settingsAutoFillEmpty: true,
  settingsTextShadow: true,
  settingsStageCaption: "",
  exportType: "gif",
  whaleMode: false,
  currentGridItems: [],
  orderedItems: [],
};

state.imageLoadState = { total: 0, loaded: 0, failed: 0, retrying: 0 };

export function setCurrentStep(step) {
  currentStep = step;
}

export function syncOrderedItemsFromGrid() {
  state.orderedItems = state.currentGridItems;
}

export let configLoaded = false;

export function setConfigLoaded(value) {
  configLoaded = !!value;
}

export function isConfigLoaded() {
  return configLoaded;
}

/** Worker image proxy base (set after config load). */
export let IMG_PROXY = "";

export function setImgProxy(url) {
  IMG_PROXY = url || "";
}
