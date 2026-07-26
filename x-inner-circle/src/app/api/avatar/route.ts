import { NextRequest } from "next/server";
import { AVATAR_PROXY_CONFIG } from "@/lib/config";
import { upgradeTwitterProfileImageUrl } from "@/lib/deployment";

const AVATAR_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: AVATAR_HEADERS });
}

export async function GET(req: NextRequest): Promise<Response> {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("Missing url", { status: 400 });

  const upgraded = upgradeTwitterProfileImageUrl(raw) ?? raw;

  let parsed: URL;
  try {
    parsed = new URL(upgraded);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (parsed.protocol !== "https:") return new Response("HTTPS only", { status: 400 });

  const host = parsed.hostname.toLowerCase();
  const allowed = AVATAR_PROXY_CONFIG.allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) return new Response("Host not allowed", { status: 403 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AVATAR_PROXY_CONFIG.timeoutMs);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return new Response("Upstream error", { status: 404 });

    const ct = res.headers.get("content-type") ?? "image/jpeg";
    if (!ct.startsWith("image/")) return new Response("Not an image", { status: 415 });

    const buf = await res.arrayBuffer();
    if (buf.byteLength > AVATAR_PROXY_CONFIG.maxBytes) {
      return new Response("Image too large", { status: 413 });
    }

    return new Response(buf, {
      status: 200,
      headers: {
        ...AVATAR_HEADERS,
        "Content-Type": ct.split(";")[0] ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
