export interface XPublicMetrics {
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
}

export interface XUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: XPublicMetrics;
}

export interface XEntityMention {
  username: string;
  start?: number;
  end?: number;
}

export interface XReferencedTweet {
  type: "replied_to" | "quoted" | "retweeted";
  id: string;
  author_id?: string;
}

export interface XPost {
  id: string;
  text?: string;
  author_id: string;
  created_at: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: XReferencedTweet[];
  entities?: { mentions?: XEntityMention[] };
  public_metrics?: Record<string, number>;
}

export interface XApiErrorBody {
  title?: string;
  detail?: string;
  type?: string;
  status?: number;
}

export interface XApiResponse<T> {
  data?: T;
  includes?: { users?: XUser[]; tweets?: XPost[] };
  meta?: { next_token?: string; result_count?: number };
  errors?: XApiErrorBody[];
}

export interface XRequestMeta {
  endpoint: string;
  status: number;
  durationMs: number;
  resourcesReturned: number;
  paginationIndex: number;
  rateLimitRemaining: number | null;
}

export interface XUsageSummary {
  apiRequests: number;
  postsRetrieved: number;
  mentionsRetrieved: number;
  profilesRetrieved: number;
  paginationCount: number;
  durationMs: number;
  endpoints: string[];
  rateLimitRemaining: number | null;
  requestLog: XRequestMeta[];
}

export class XApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "XApiError";
  }
}
