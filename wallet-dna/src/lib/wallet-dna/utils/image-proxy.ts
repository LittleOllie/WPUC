const ALLOWED_HOST_SUFFIXES = [
  "ipfs.io",
  "nftstorage.link",
  "cloudflare-ipfs.com",
  "dweb.link",
  "gateway.pinata.cloud",
  "arweave.net",
  "arweave.dev",
  "alchemy.com",
  "nftcdn.io",
  "amazonaws.com",
  "googleusercontent.com",
  "mypinata.cloud",
  "w3s.link",
  "ipfs.dweb.link",
  "ipfs.infura.io",
  "quicknode-ipfs.com",
  "media.giphy.com",
  "i.seadn.io",
  "opensea.io",
  "reservoir.tools",
  "simplehash.com",
  "simplehash.xyz",
  "rarible.com",
  "tokensafe.org",
  "ens.domains",
  "foundation.app",
  "looksrare.org",
  "blur.io",
  "manifold.xyz",
  "zora.co",
  "cdn.ens.domains",
];

const BLOCKED_EXTENSIONS = /\.(mp4|webm|mov|avi|mkv|m4v|mp3|wav|glb|gltf)(\?|$)/i;

export function isProxiableImageUrl(raw: string): boolean {
  if (!raw || raw.startsWith("data:")) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    if (BLOCKED_EXTENSIONS.test(url.pathname) || BLOCKED_EXTENSIONS.test(url.search)) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export async function fetchProxiedImage(
  targetUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!isProxiableImageUrl(targetUrl)) return null;

  const res = await fetchImpl(targetUrl, {
    headers: { Accept: "image/*" },
    redirect: "follow",
  });
  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) return null;
  if (contentType.includes("svg")) return null;

  const body = await res.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > 8 * 1024 * 1024) return null;

  return { body, contentType };
}
