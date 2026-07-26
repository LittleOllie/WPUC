/** Central configuration — change app name, scoring, limits, and visuals here. */

export const SCORING_VERSION = "v1.0.0";

export const APP_CONFIG = {
  name: "X Inner Circle",
  subtitle: "See who appears closest to you based on your recent public X conversations and interactions.",
  heroTitle: "Discover Your X Inner Circle",
  heroSubtitle:
    "See who appears closest to you based on your recent public X conversations and interactions.",
  inputPlaceholder: "Enter @username or X profile URL",
  primaryButton: "Analyse My Community",
  privacyNote: "No passwords. No private messages. Based only on available public X activity.",
  disclaimer:
    "Based on recent public X interactions. Results estimate interaction closeness — not real-world friendships.",
  footerDisclaimer:
    "This tool analyses available public X activity. It does not access passwords, private messages or private account content.",
  brandingCorner: "X Inner Circle",
  showGeneratedDate: true,
} as const;

export const RING_LABELS = {
  inner: "Inner Circle",
  besties: "Besties",
  goodFriends: "Good Friends",
  community: "Community Friends",
} as const;

export const RING_CAPACITY = {
  inner: 8,
  besties: 12,
  goodFriends: 18,
  community: 24,
} as const;

export const RING_COLORS = {
  inner: "#6366f1",
  besties: "#8b5cf6",
  goodFriends: "#a78bfa",
  community: "#c4b5fd",
  background: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
} as const;

export const SCORING_WEIGHTS = {
  reply_sent: 3,
  reply_received: 4,
  mention_sent: 2,
  mention_received: 3,
  quote_sent: 3,
  quote_received: 4,
  repost_sent: 1,
  conversation_exchange: 6,
} as const;

export const RECIPROCITY_MULTIPLIERS = {
  low: 1.05,
  moderate: 1.2,
  strong: 1.4,
} as const;

export const RECENCY_BUCKETS = [
  { maxDays: 7, weight: 1.0 },
  { maxDays: 30, weight: 0.85 },
  { maxDays: 60, weight: 0.65 },
  { maxDays: 90, weight: 0.45 },
] as const;

export const ANALYSIS_CONFIG = {
  analysisDays: 90,
  maxPostsPerScan: 100,
  maxMentionsPerScan: 100,
  maxProfileLookupsPerScan: 75,
  maxPaginationRequests: 10,
  requestTimeoutMs: 20_000,
  cacheDurationMs: 24 * 60 * 60 * 1000,
  minScoreForRing: 4,
  minEventsForCandidate: 1,
  uniqueConversationBonus: 2.5,
  consistencyDayBonus: 0.4,
  consistencyWeekBonus: 1.2,
  diminishingReturnsCap: 40,
  celebrityFollowerThreshold: 500_000,
  celebrityOneWayPenalty: 0.35,
  innerCircleRequiresReciprocity: true,
} as const;

export const RATE_LIMIT_CONFIG = {
  scansPerIpPerHour: 5,
  scansPerUsernamePerHour: 2,
  maxActiveScansPerIp: 1,
  maxBodyBytes: 4096,
} as const;

export const IMAGE_CONFIG = {
  canvasSize: 1600,
  targetAvatarSize: 120,
  ringAvatarSizes: {
    inner: 72,
    besties: 60,
    goodFriends: 52,
    community: 44,
  },
  ringRadii: {
    inner: 180,
    besties: 320,
    goodFriends: 460,
    community: 600,
  },
  highResScale: 2,
} as const;

export const AVATAR_PROXY_CONFIG = {
  allowedHosts: [
    "pbs.twimg.com",
    "abs.twimg.com",
    "pbs-x.twimg.com",
  ],
  maxBytes: 2 * 1024 * 1024,
  timeoutMs: 10_000,
} as const;

export const PROGRESS_STAGES = [
  "Finding profile",
  "Reading recent public activity",
  "Finding conversations",
  "Scoring connections",
  "Creating your circles",
] as const;

export type RingKey = keyof typeof RING_LABELS;
