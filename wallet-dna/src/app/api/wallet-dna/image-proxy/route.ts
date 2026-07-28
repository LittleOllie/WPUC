import { fetchProxiedImage, isProxiableImageUrl } from "@/lib/wallet-dna/utils/image-proxy";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = url.searchParams.get("url");
  if (!target) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return new Response("Invalid url parameter", { status: 400 });
  }

  if (!isProxiableImageUrl(decoded)) {
    return new Response("URL not allowed", { status: 403 });
  }

  try {
    const result = await fetchProxiedImage(decoded);
    if (!result) {
      return new Response("Image unavailable", { status: 502 });
    }

    return new Response(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Proxy fetch failed", { status: 502 });
  }
}
