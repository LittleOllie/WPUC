export type SupportedChain = "ethereum" | "base";

export type ScoreConfidence = "high" | "medium" | "limited";

export type DiamondHandsComponentScores = {
  holdingDuration: number;
  longTermRetention: number;
  sellBehaviour: number;
  transferBehaviour: number;
  holdingStreak: number;
};

export type DiamondHandsDiagnostics = {
  finalScore: number;
  averageHoldingDays: number;
  medianHoldingDays: number;
  oldestCurrentHoldingDays: number;
  currentAssetsOver180DaysPercent: number;
  currentAssetsOver365DaysPercent: number;
  currentAssetsOver730DaysPercent: number;
  historicalAssetsSold: number;
  historicalAssetsTransferredOut: number;
  recentSales: number;
  recentTransfersOut: number;
  walletAgeDays: number;
  analysedAssetCount: number;
  unknownAcquisitionDateCount: number;
  componentScores: DiamondHandsComponentScores;
  penalties: string[];
  warnings: string[];
  rawMedianHoldingDays: number | null;
  reconciledMedianHoldingDays: number | null;
  retentionRate: number | null;
  shortTermOutboundRate: number | null;
  outboundToInboundRatio: number | null;
  transferHistoryCapped: boolean;
  inboundTransfersComplete: boolean;
};

export type DiamondHandsTokenSample = {
  tokenKey: string;
  rawAcquiredAt: string | null;
  reconciledHoldStartedAt: string | null;
  holdDays: number | null;
  everOutbound: boolean;
};

export type WalletDNAScoreDebug = {
  diamondHands: DiamondHandsDiagnostics;
  tokenSamples?: DiamondHandsTokenSample[];
};

export type WalletDNAScore = {
  value: number;
  confidence: ScoreConfidence;
  summary: string;
  factors: Array<{ label: string; value: string; contribution?: number }>;
};

export type WalletDNAScores = {
  collector: WalletDNAScore;
  diamondHands: WalletDNAScore;
  explorer: WalletDNAScore;
  discovery: WalletDNAScore;
  loyalty: WalletDNAScore;
};

export type NormalizedNFT = {
  chain: SupportedChain;
  contractAddress: string;
  tokenId: string;
  tokenType: "ERC721" | "ERC1155" | "UNKNOWN";
  balance: number;
  title: string | null;
  collectionName: string | null;
  imageUrl: string | null;
  thumbnailUrl?: string | null;
  acquiredAt: string | null;
  isSpam: boolean;
};

export type NormalizedNFTTransfer = {
  chain: SupportedChain;
  blockNumber: string | null;
  transactionHash: string | null;
  contractAddress: string;
  tokenId: string | null;
  tokenType: "ERC721" | "ERC1155" | "UNKNOWN";
  from: string;
  to: string;
  timestamp: string | null;
  direction: "inbound" | "outbound";
  isMint: boolean;
  quantity: number;
  dedupeKey: string;
};

export type ChainCoverage = {
  ownershipComplete: boolean;
  inboundTransfersComplete: boolean;
  outboundTransfersComplete: boolean;
  transferCountAnalysed: number;
  capped: boolean;
};

export type AnalysisCoverage = {
  ethereum: ChainCoverage;
  base: ChainCoverage;
};

export type WalletCollectionSummary = {
  chain: SupportedChain;
  contractAddress: string;
  collectionName: string;
  currentQuantity: number;
  totalInbound: number;
  totalOutbound: number;
  firstInteractionAt: string | null;
  latestInteractionAt: string | null;
  currentOldestHoldDays: number | null;
};

export type WalletPersonality = {
  id: string;
  name: string;
  shortDescription: string;
  /** One-sentence Ollie voice line for the share profile card */
  shareSummary: string;
  themeKey: string;
  ollieVariant: string;
  shareSubtitle: string;
};

export type WalletBadge = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedReason: string | null;
  iconKey: string;
  rarityLabel?: string;
};

export type WalletDNAStats = {
  nftsCurrentlyHeld: number | "unknown";
  uniqueCurrentCollections: number | "unknown";
  chainsUsed: SupportedChain[];
  firstKnownActivity: string | null;
  longestCurrentHoldDays: number | null;
  medianCurrentHoldDays: number | null;
  identifiedMints: number;
  inboundTransfers: number;
  outboundTransfers: number;
  mostHeldCollection: string | null;
  ethereumNftCount: number;
  baseNftCount: number;
  spamExcluded: number;
  rawNftCount: number;
};

export type WalletDNAResult = {
  schemaVersion: number;
  scoringVersion: string;
  walletAddress: string;
  ensName: string | null;
  generatedAt: string;
  chainsAnalysed: SupportedChain[];
  analysisCoverage: AnalysisCoverage;
  personality: WalletPersonality;
  scores: WalletDNAScores;
  stats: WalletDNAStats;
  badges: WalletBadge[];
  topCollections: WalletCollectionSummary[];
  narrative: string;
  warnings: string[];
  visuals: WalletDNAVisuals;
  /** Development-only score breakdown — never returned in production unless explicitly enabled */
  scoreDebug?: WalletDNAScoreDebug;
};

export type NFTValuationEvidence =
  | {
      type: "active-token-offer";
      amountNative: string;
      currency: string;
      source: string;
      expiresAt: string | null;
    }
  | {
      type: "active-listing";
      amountNative: string;
      currency: string;
      source: string;
      expiresAt: string | null;
    }
  | {
      type: "recent-token-sale";
      amountNative: string;
      currency: string;
      source: string;
      soldAt: string;
    }
  | {
      type: "collection-floor";
      amountNative: string;
      currency: string;
      source: string;
      observedAt: string;
    };

export type NFTValuationResult = {
  nftKey: string;
  estimatedAmountNative: string | null;
  currency: string | null;
  confidence: "strong" | "market" | "collection-only" | "unavailable";
  evidence: NFTValuationEvidence[];
  label: string;
  disclaimer: string;
};

export type WalletNFTHighlight = {
  id: string;
  type:
    | "longest-held"
    | "newest-pickup"
    | "most-held-collection"
    | "most-active-chain"
    | "highest-current-offer"
    | "highest-collection-floor";
  title: string;
  subtitle: string;
  nft?: NormalizedNFT;
  collection?: WalletCollectionSummary;
  chain?: SupportedChain;
  value?: string;
  supportingText?: string;
  confidence?: "high" | "medium" | "limited";
};

export type WalletCollectionVisualSummary = WalletCollectionSummary & {
  representativeNFTs: NormalizedNFT[];
  percentageOfCurrentHoldings: number;
};

export type WalletDNAVisuals = {
  highlights: WalletNFTHighlight[];
  galleryNFTs: NormalizedNFT[];
  collectionShowcase: WalletCollectionVisualSummary[];
};

export type WalletDNAVisualPreferences = {
  walletAddress: string;
  hiddenCollections: string[];
};

export type WalletDNASharePreferences = {
  walletAddress: string;
  selectedNFTKeys: string[];
  includeNFTArtwork: boolean;
  updatedAt: string;
};

export type ShareCardFormat = "landscape" | "square" | "portrait";

export type ShareStyle = "passport" | "showcase";

export type WalletPassportStamp = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  iconKey: string;
  styleKey:
    | "ethereum"
    | "base"
    | "veteran"
    | "diamond"
    | "mint"
    | "explorer"
    | "loyalty"
    | "vault"
    | "multichain"
    | "default";
  unlocked: boolean;
  priority: number;
  rotationSeed: number;
  subtext?: string;
  dateText?: string;
};

export type WalletPassportData = {
  passportNumber: string;
  walletIdentity: string;
  ensName: string | null;
  personalityName: string;
  personalityId: string;
  personalitySummary: string;
  collectorSinceYear: number | null;
  generatedAt: string;
  scores: WalletDNAScores;
  displayedBadges: WalletBadge[];
  stamps: WalletPassportStamp[];
  chains: SupportedChain[];
  strongestTrait: {
    name: string;
    value: number;
  };
  traitCombo: string | null;
  ollieVariant: string;
  fingerprintSeed: string;
  scoringVersion: string;
  walletAddress: string;
};

export type WalletPassportPreferences = {
  shareStyle: ShareStyle;
  format: ShareCardFormat;
  showENS: boolean;
  showShortAddress: boolean;
  showGeneratedDate: boolean;
  showCollectorSince: boolean;
  showPassportNumber: boolean;
  showScores: boolean;
  showStamps: boolean;
  showBadges: boolean;
  showOllie: boolean;
  stampDensity: "minimal" | "standard" | "full";
  stampLayoutIndex: number;
};

export type SelectedShareNFT = {
  nftKey: string;
  position: number;
};

export type ShareSelectableNFT = NormalizedNFT;

export type WalletNFTCollectionOption = {
  key: string;
  chain: SupportedChain;
  contractAddress: string;
  name: string;
  quantity: number;
  representativeImageUrl: string | null;
};

export type WalletNFTPickerResponse = {
  nfts: ShareSelectableNFT[];
  nextCursor: string | null;
  total: number;
  collections: WalletNFTCollectionOption[];
};

export type WalletDNAErrorCode =
  | "INVALID_WALLET"
  | "ENS_NOT_FOUND"
  | "NO_NFT_ACTIVITY"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "ANALYSIS_TIMEOUT"
  | "HISTORY_PARTIAL"
  | "MISSING_ALCHEMY_CONFIG"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export type AnalysisContext = {
  walletAddress: string;
  nfts: NormalizedNFT[];
  transfers: NormalizedNFTTransfer[];
  collections: WalletCollectionSummary[];
  coverage: AnalysisCoverage;
  stats: WalletDNAStats;
};
