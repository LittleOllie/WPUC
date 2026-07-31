export const SCHEMA_VERSION = 2;
export const SCORING_VERSION = "2.1";
/** Bump when highlight / acquisition logic changes (invalidates cached analyses). */
export const HIGHLIGHTS_VERSION = "2";

export const SUPPORTED_CHAINS = ["ethereum", "base"] as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const ALCHEMY_HOSTS = {
  ethereum: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
} as const;

export const DEFAULT_CACHE_TTL_SECONDS = 21600;
export const DEFAULT_MAX_TRANSFERS_PER_CHAIN = 5000;

export const RATE_LIMIT = {
  windowMs: 10 * 60 * 1000,
  maxFreshAnalysesPerIp: 10,
} as const;

export const PROGRESS_STAGES = [
  "Resolving wallet",
  "Finding Ethereum NFTs",
  "Finding Base NFTs",
  "Reading collector history",
  "Calculating Wallet DNA",
  "Unlocking badges",
  "Creating your collector profile",
] as const;

/** Fun copy while Ollie analyses — rotates during long waits */
export const LOADING_OLLIE_LINES = [
  "Hmm… interesting collector signals in here.",
  "No rush — big wallets have big stories.",
  "Still reading. Ollie hasn't napped yet.",
  "Genesis seeker or diamond hands? Finding out…",
  "Ethereum checked. Base is next on the list.",
  "Filtering spam so your profile stays clean.",
  "Your personality badge is almost ready…",
  "Five DNA scores brewing — worth the wait.",
] as const;

export const LOADING_TIPS = [
  "We never ask you to connect a wallet or sign anything.",
  "Outbound transfers aren't automatically called sales.",
  "Wallet DNA looks at public NFT activity on Ethereum and Base.",
  "Bigger wallets can take 1–2 minutes — that's normal.",
  "Scores are deterministic — same wallet, same rules, same result.",
  "Spam NFTs are filtered out where we can spot them.",
] as const;

export const LOADING_PERSONALITY_TEASES = [
  "Diamond Collector",
  "Genesis Seeker",
  "Base Explorer",
  "Collection Loyalist",
  "Art Wanderer",
  "Vault Keeper",
] as const;

export const APP_COPY = {
  name: "Wallet DNA",
  tagline: "A Little Ollie Web3 Utility",
  heroTitle: "Discover Your Wallet DNA",
  heroSubtitle:
    "Every NFT wallet tells a story. Enter an address or ENS name to uncover its collector personality, strongest traits and achievement badges.",
  privacy: "No wallet connection. No signature. Public on-chain data only.",
  disclaimer:
    "For entertainment and informational purposes only. Not financial advice.",
  ownershipNote:
    "Anyone can analyse a public address. A result does not prove that the person viewing it owns the wallet.",
} as const;

export const SCORE_LABELS = {
  collector: "Collector",
  diamondHands: "Diamond Hands",
  explorer: "Explorer",
  discovery: "Discovery",
  loyalty: "Loyalty",
} as const;

/** Loading screen — one letter per DNA score, cycled while analysis runs */
export const LOADING_DNA_SCORES = [
  { letter: "C", label: SCORE_LABELS.collector },
  { letter: "D", label: SCORE_LABELS.diamondHands },
  { letter: "E", label: SCORE_LABELS.explorer },
  { letter: "G", label: SCORE_LABELS.discovery },
  { letter: "L", label: SCORE_LABELS.loyalty },
] as const;

export const SCORE_DESCRIPTIONS = {
  collector: "How broad and deep your current NFT collection is.",
  diamondHands: "How long your NFTs tend to remain in the wallet.",
  explorer: "How widely the wallet explores chains and collections.",
  discovery:
    "How often you find and participate in projects early — through mints, early secondary buys, and exploring newer collections.",
  loyalty: "How committed the wallet is to holding — low selling, retention, and staying power.",
} as const;

/** Disabled until a reliable valuation provider is connected. */
export const WALLET_DNA_ENABLE_VALUATION = false;

/** Maximum NFTs featured on share card. */
export const MAX_SHARE_CARD_NFTS = 4;

/** NFT picker grid page size. */
export const NFT_PICKER_PAGE_SIZE = 24;

/** Maximum page size for NFT picker API. */
export const MAX_NFTS_PAGE_LIMIT = 100;
