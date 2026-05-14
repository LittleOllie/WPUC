/** Ethereum mainnet DDG collection (per product spec). */
export const DDG_CONTRACT = "0x9c51a3cb5094b26aa1dcb380f3dc7e1a7c681c2d";

/**
 * Site operator supplies an Alchemy NFT API key (never shown in the app UI).
 * Resolution order:
 * 1) `window.DDG_GORGEZ_ALCHEMY_KEY` (inline script in index.html)
 * 2) `<meta name="ddg-gorgez-alchemy-key" content="…">` (CMS / static host injection)
 * 3) On localhost only: `sessionStorage.DDG_GORGEZ_ALCHEMY_KEY` (dev convenience; set once in DevTools)
 * Prefer a server proxy in production so the key is not in page source.
 */
export function getInjectedAlchemyKey() {
  const trim = (s) => String(s ?? "").trim();
  try {
    const w = trim(globalThis.DDG_GORGEZ_ALCHEMY_KEY);
    if (w) return w;
  } catch (_) {
    /* ignore */
  }
  try {
    if (typeof document !== "undefined") {
      const meta = document.querySelector('meta[name="ddg-gorgez-alchemy-key"]');
      const c = trim(meta?.getAttribute("content"));
      if (c) return c;
    }
  } catch (_) {
    /* ignore */
  }
  try {
    const h = String(globalThis.location?.hostname || "");
    const local = h === "localhost" || h === "127.0.0.1" || h === "[::1]";
    if (local && typeof globalThis.sessionStorage !== "undefined") {
      const k = trim(globalThis.sessionStorage.getItem("DDG_GORGEZ_ALCHEMY_KEY"));
      if (k) return k;
    }
  } catch (_) {
    /* ignore */
  }
  return "";
}

/**
 * @param {string} ownerAddress
 * @returns {Promise<{ tokenId: string; thumb: string; full: string; name: string }[]>}
 */
export async function fetchDdgNftsForOwner(ownerAddress) {
  const owner = String(ownerAddress || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(owner)) {
    throw new Error("Paste a valid 0x wallet address.");
  }
  const key = getInjectedAlchemyKey();
  if (!key) {
    throw new Error(
      "Wallet loading needs an Alchemy NFT API key on this page. You can still use Upload DDGs. Site owner: set window.DDG_GORGEZ_ALCHEMY_KEY or a meta tag (see index.html comments). On localhost, sessionStorage.DDG_GORGEZ_ALCHEMY_KEY also works."
    );
  }

  const contract = DDG_CONTRACT.toLowerCase();
  const base = `https://eth-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(key)}/getNFTsForOwner`;
  const out = [];
  let pageKey = null;

  for (let guard = 0; guard < 40; guard++) {
    const u = new URL(base);
    u.searchParams.set("owner", owner);
    u.searchParams.set("contractAddresses[]", contract);
    u.searchParams.set("withMetadata", "true");
    u.searchParams.set("pageSize", "100");
    if (pageKey) u.searchParams.set("pageKey", pageKey);

    const res = await fetch(u.toString(), { method: "GET", mode: "cors" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Could not load wallet (${res.status}). ${t.slice(0, 120)}`);
    }
    const data = await res.json();
    const list = data?.ownedNfts || data?.nfts || [];
    for (const nft of list) {
      const tid = nft?.tokenId != null ? String(nft.tokenId) : "";
      const rawImg = nft?.image;
      const meta = typeof rawImg === "object" && rawImg ? rawImg : {};
      const fromRaw = typeof rawImg === "string" && rawImg ? rawImg : "";
      const metaStr = nft?.metadata?.image;
      const metaUrl = typeof metaStr === "string" && metaStr ? metaStr : "";
      const thumb =
        meta.thumbnailUrl ||
        meta.cachedUrl ||
        nft?.media?.[0]?.thumbnail ||
        nft?.contract?.openSeaMetadata?.imageUrl ||
        fromRaw ||
        metaUrl ||
        "";
      const full =
        meta.originalUrl ||
        meta.pngUrl ||
        meta.gateway ||
        thumb ||
        (typeof rawImg === "object" && rawImg?.cachedUrl) ||
        "";
      const name =
        nft?.metadata?.name ||
        nft?.name ||
        nft?.title ||
        `DDG #${tid}`;
      if (tid && (thumb || full)) {
        out.push({ tokenId: tid, thumb: thumb || full, full: full || thumb, name: String(name) });
      }
    }
    pageKey = data?.pageKey || null;
    if (!pageKey) break;
  }

  return out;
}

/**
 * Merge several DDG lists in order, skipping duplicate `tokenId`s (first occurrence wins).
 * @param {Array<{ tokenId: string; thumb: string; full: string; name: string }[]>} lists
 * @returns {{ tokenId: string; thumb: string; full: string; name: string }[]}
 */
export function mergeDdgNftLists(lists) {
  const seen = new Set();
  const out = [];
  if (!Array.isArray(lists)) return out;
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const nft of list) {
      const id = String(nft?.tokenId ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(nft);
    }
  }
  return out;
}
