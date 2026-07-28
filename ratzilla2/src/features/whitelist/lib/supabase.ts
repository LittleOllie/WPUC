import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
} | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export function getSupabase(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseClient;
}

export function getFunctionsBaseUrl(): string | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  return `${config.url}/functions/v1`;
}

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const baseUrl = getFunctionsBaseUrl();
  const config = getSupabaseConfig();

  if (!baseUrl || !config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${baseUrl}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.anonKey}`,
      apikey: config.anonKey,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    return { outcome: "rate_limited" } as T;
  }

  if (!response.ok) {
    return { outcome: "error" } as T;
  }

  return (await response.json()) as T;
}
