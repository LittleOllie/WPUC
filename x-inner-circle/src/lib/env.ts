import { z } from "zod";

const envSchema = z.object({
  X_BEARER_TOKEN: z.string().optional().default(""),
  X_API_BASE_URL: z.string().url().default("https://api.x.com/2"),
  X_MAX_POSTS_PER_SCAN: z.coerce.number().int().positive().default(100),
  X_MAX_MENTIONS_PER_SCAN: z.coerce.number().int().positive().default(100),
  X_MAX_PROFILE_LOOKUPS_PER_SCAN: z.coerce.number().int().positive().default(75),
  X_MAX_PAGINATION_REQUESTS_PER_SCAN: z.coerce.number().int().positive().default(3),
  X_MAX_API_REQUESTS_PER_SCAN: z.coerce.number().int().positive().default(20),
  X_MAX_RESULTS_PER_RING: z.coerce.number().int().positive().default(20),
  X_ANALYSIS_DAYS: z.coerce.number().int().positive().default(90),
  ENABLE_MOCK_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  ENABLE_LIVE_X_API: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type AppEnv = z.infer<typeof envSchema> & {
  isMockMode: boolean;
  isLiveMode: boolean;
  hasBearerToken: boolean;
};

let cached: AppEnv | null = null;

function buildEnv(data: z.infer<typeof envSchema>): AppEnv {
  const isLiveMode = data.ENABLE_LIVE_X_API && !data.ENABLE_MOCK_MODE;
  const hasBearerToken = Boolean(data.X_BEARER_TOKEN?.trim());
  return {
    ...data,
    isMockMode: data.ENABLE_MOCK_MODE || !data.ENABLE_LIVE_X_API,
    isLiveMode,
    hasBearerToken,
  };
}

/** Parse env without throwing when live mode is misconfigured (safe for build/health). */
export function getEnvSafe(): AppEnv {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }

  cached = buildEnv(parsed.data);
  return cached;
}

/** Same as getEnvSafe — live token validation happens at analysis time only. */
export function getEnv(): AppEnv {
  return getEnvSafe();
}

/** Call immediately before live X API work (not during build or health checks). */
export function assertLiveAnalysisReady(): void {
  const env = getEnvSafe();
  if (env.isLiveMode && !env.hasBearerToken) {
    throw new Error(
      "ENABLE_LIVE_X_API is true but X_BEARER_TOKEN is missing. Set a valid Bearer Token or enable mock mode.",
    );
  }
}

export function resetEnvCache(): void {
  cached = null;
}
