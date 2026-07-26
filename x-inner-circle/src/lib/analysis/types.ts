export type InteractionType =
  | "reply_sent"
  | "reply_received"
  | "mention_sent"
  | "mention_received"
  | "quote_sent"
  | "quote_received"
  | "repost_sent"
  | "conversation_exchange";

export type ConfidenceLevel = "low" | "medium" | "high";

export type RingKey = "inner" | "besties" | "goodFriends" | "community";

export interface TargetAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  verified: boolean;
  profileUrl: string;
}

export interface InteractionEvent {
  sourceUserId: string;
  targetUserId: string;
  postId: string;
  conversationId: string | null;
  createdAt: string;
  type: InteractionType;
  weightSource: string;
  direction: "outbound" | "inbound" | "mutual";
}

export interface CandidateAccount {
  userId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  rawEvents: InteractionEvent[];
  counts: Record<InteractionType, number>;
  reciprocity: number;
  uniqueConversationCount: number;
  activeDays: number;
  activeWeeks: number;
  latestInteractionAt: string | null;
  score: number;
  confidence: ConfidenceLevel;
  ring: RingKey | null;
  explanation: string[];
}

export interface AnalysisUsage {
  apiRequests: number;
  postsRetrieved: number;
  mentionsRetrieved: number;
  profilesRetrieved: number;
  paginationCount: number;
  durationMs: number;
  endpoints: string[];
  rateLimitRemaining: number | null;
}

export interface AnalysisResult {
  target: TargetAccount;
  analysedAt: string;
  analysisWindow: { from: string; to: string; days: number };
  sourceCounts: {
    postsAnalysed: number;
    mentionsAnalysed: number;
    accountsDiscovered: number;
    interactionsCounted: number;
  };
  candidates: CandidateAccount[];
  rings: Record<RingKey, CandidateAccount[]>;
  confidence: ConfidenceLevel;
  limitations: string[];
  usage: AnalysisUsage;
  generatedDisclaimer: string;
  scoringVersion: string;
  svgMarkup?: string;
}

export interface AnalysisStage {
  stage: "submitting" | "retrieving" | "analysing" | "rendering";
  label: string;
  index: number;
}
