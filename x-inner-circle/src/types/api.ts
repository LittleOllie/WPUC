import type { AnalysisResult } from "@/lib/analysis/types";

export type AnalysisErrorCode =
  | "INVALID_USERNAME"
  | "USER_NOT_FOUND"
  | "PRIVATE_OR_UNAVAILABLE_ACCOUNT"
  | "X_AUTH_ERROR"
  | "X_RATE_LIMITED"
  | "X_BUDGET_LIMIT_REACHED"
  | "INSUFFICIENT_PUBLIC_DATA"
  | "X_API_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface AnalyseRequest {
  input: string;
}

export interface AnalyseSuccessResponse {
  success: true;
  data: AnalysisResult;
  cacheHit?: boolean;
  stage?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: AnalysisErrorCode;
    friendlyMessage: string;
    technicalMessage?: string;
    retryable: boolean;
  };
}

export type AnalyseResponse = AnalyseSuccessResponse | ApiErrorResponse;

export interface HealthResponse {
  ok: boolean;
  mode: "mock" | "live";
  liveConfigured: boolean;
  deployment: "static-mock" | "server-live" | "server-mock";
  scoringVersion: string;
}
