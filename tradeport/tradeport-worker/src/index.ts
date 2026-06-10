/**
 * TradePort API — Alchemy proxy (keys stay server-side).
 * Routes: GET /api/health, GET /api/nfts, GET /api/img
 */

export interface Env {
	ALCHEMY_API_KEY: string;
}

const ALCHEMY_HOST = 'eth-mainnet.g.alchemy.com';

/** Supported community contracts (lowercase) → collection id */
const CONTRACT_TO_COLLECTION: Record<string, string> = {
	'0x9c51a3cb5094b26aa1dcb380f3dc7e1a7c681c2d': 'ddg',
	'0x1347a97789cd3aa0b11433e8117f55ab640a0451': 'longlost',
	'0xd4b7d9bb20fa20ddada9ecef8a7355ca983cccb1': 'quirkies',
	'0xc9d198089d6c31d0ca5cc5b92c97a57a97bbfde2': 'spaceriders',
	'0x5b12e009e1b5f14b1e8f3a3b9fb3ca165702dcbd': 'ogenies',
	'0x8f1b132e9fd2b9a2b210baa186bf1ae650adf7ac': 'quirklings',
};

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
	});
}

function corsPreflight(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function parseMetadata(raw: unknown): Record<string, unknown> | null {
	if (raw == null) return null;
	if (typeof raw === 'object') return raw as Record<string, unknown>;
	if (typeof raw === 'string') {
		try {
			const o = JSON.parse(raw);
			return typeof o === 'object' && o ? (o as Record<string, unknown>) : null;
		} catch {
			return null;
		}
	}
	return null;
}

function pickImageUrl(nft: Record<string, unknown>): string | null {
	const img = nft.image as Record<string, unknown> | undefined;
	if (img && typeof img.cachedUrl === 'string' && img.cachedUrl) return img.cachedUrl;
	if (img && typeof img.originalUrl === 'string' && img.originalUrl) return img.originalUrl;
	if (img && typeof img.pngUrl === 'string' && img.pngUrl) return img.pngUrl;
	if (typeof nft.media === 'object' && Array.isArray(nft.media)) {
		for (const m of nft.media as Record<string, unknown>[]) {
			const g = m.gateway as string | undefined;
		 if (g) return g;
			const raw = m.raw as string | undefined;
			if (raw && raw.startsWith('http')) return raw;
		}
	}
	const meta = parseMetadata(nft.rawMetadata ?? nft.metadata);
	if (meta) {
		const i = meta.image;
		if (typeof i === 'string' && i.startsWith('http')) return i;
		if (typeof i === 'string' && i.startsWith('ipfs://')) return i;
	}
	const uri = nft.tokenUri as string | undefined;
	if (uri && uri.startsWith('http')) return uri;
	return null;
}

function normalizeNft(nft: Record<string, unknown>) {
	const contract =
		(typeof nft.contractAddress === 'string' && nft.contractAddress) ||
		((nft.contract as Record<string, unknown> | undefined)?.address as string) ||
		'';
	const contractLower = contract.toLowerCase();
	const tokenIdRaw = nft.tokenId ?? (nft.id as Record<string, unknown> | undefined)?.tokenId;
	let tokenId = '';
	if (typeof tokenIdRaw === 'string') {
		tokenId = tokenIdRaw.startsWith('0x')
			? String(parseInt(tokenIdRaw, 16))
			: tokenIdRaw;
	} else if (tokenIdRaw != null) {
		tokenId = String(tokenIdRaw);
	}
	const meta = parseMetadata(nft.rawMetadata ?? nft.metadata);
	const name =
		(typeof nft.name === 'string' && nft.name) ||
		(typeof meta?.name === 'string' && meta.name) ||
		(tokenId ? `#${tokenId}` : 'NFT');
	const imageUrl = pickImageUrl(nft);
	return {
		contract: contractLower,
		tokenId,
		name,
		imageUrl,
		collectionId: CONTRACT_TO_COLLECTION[contractLower] ?? null,
	};
}

function shufflePick<T>(arr: T[], count: number): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy.slice(0, Math.min(count, copy.length));
}

/** Random NFT previews for a collection contract (home cards, hub showcase fallback). */
/** Single NFT metadata by contract + token id (mock listing previews). */
async function fetchNftMetadata(
	env: Env,
	contract: string,
	tokenId: string
): Promise<Response> {
	const apiKey = env.ALCHEMY_API_KEY?.trim();
	if (!apiKey) {
		return json({ error: 'Missing ALCHEMY_API_KEY' }, 503);
	}

	const contractVal = contract.trim().toLowerCase();
	if (!/^0x[a-f0-9]{40}$/.test(contractVal)) {
		return json({ error: 'Invalid contract address' }, 400);
	}

	const tokenVal = tokenId.trim();
	if (!/^\d+$/.test(tokenVal)) {
		return json({ error: 'Invalid tokenId' }, 400);
	}

	const base = `https://${ALCHEMY_HOST}/nft/v3/${apiKey}/getNFTMetadata`;
	const params = new URLSearchParams({
		contractAddress: contractVal,
		tokenId: tokenVal,
	});

	try {
		const res = await fetch(`${base}?${params.toString()}`);
		if (!res.ok) {
			const t = await res.text();
			return json({ error: t || `Alchemy ${res.status}` }, 502);
		}
		const data = (await res.json()) as Record<string, unknown>;
		const normalized = normalizeNft(data);
		return json({
			contract: contractVal,
			tokenId: tokenVal,
			nft: normalized,
		});
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Alchemy request failed' }, 502);
	}
}

async function fetchCollectionSamples(
	env: Env,
	contract: string,
	count: number
): Promise<Response> {
	const apiKey = env.ALCHEMY_API_KEY?.trim();
	if (!apiKey) {
		return json({ error: 'Missing ALCHEMY_API_KEY' }, 503);
	}

	const contractVal = contract.trim().toLowerCase();
	if (!/^0x[a-f0-9]{40}$/.test(contractVal)) {
		return json({ error: 'Invalid contract address' }, 400);
	}

	const limit = Math.min(Math.max(count, 1), 12);
	const pageSize = Math.min(Math.max(limit * 6, 24), 48);
	const base = `https://${ALCHEMY_HOST}/nft/v3/${apiKey}/getNFTsForContract`;

	try {
		const params = new URLSearchParams({
			contractAddress: contractVal,
			withMetadata: 'true',
			pageSize: String(pageSize),
		});
		const res = await fetch(`${base}?${params.toString()}`);
		if (!res.ok) {
			const t = await res.text();
			return json({ error: t || `Alchemy ${res.status}` }, 502);
		}
		const data = (await res.json()) as Record<string, unknown>;
		const batch = (data.nfts || []) as Record<string, unknown>[];
		const normalized = batch
			.map(normalizeNft)
			.filter((n) => n.imageUrl && n.contract === contractVal);
		const picked = shufflePick(normalized, limit);
		return json(
			{
				contract: contractVal,
				collectionId: CONTRACT_TO_COLLECTION[contractVal] ?? null,
				nfts: picked,
				count: picked.length,
			},
			200,
			{ 'Cache-Control': 'public, max-age=300' }
		);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Alchemy request failed' }, 502);
	}
}

async function fetchAlchemyNfts(env: Env, owner: string, contractFilter?: string): Promise<Response> {
	const apiKey = env.ALCHEMY_API_KEY?.trim();
	if (!apiKey) {
		return json({ error: 'Missing ALCHEMY_API_KEY. Run: wrangler secret put ALCHEMY_API_KEY' }, 503);
	}

	const ownerVal = owner.trim().toLowerCase();
	if (!/^0x[a-f0-9]{40}$/.test(ownerVal)) {
		return json({ error: 'Invalid wallet address' }, 400);
	}

	const base = `https://${ALCHEMY_HOST}/nft/v3/${apiKey}/getNFTsForOwner`;
	const all: Record<string, unknown>[] = [];
	let pageKey: string | null = null;
	const maxPages = 8;

	try {
		for (let page = 0; page < maxPages; page++) {
			const params = new URLSearchParams({
				owner: ownerVal,
				withMetadata: 'true',
				pageSize: '100',
			});
			if (pageKey) params.set('pageKey', pageKey);
			if (contractFilter) {
				params.append('contractAddresses[]', contractFilter.toLowerCase());
			} else {
				for (const addr of Object.keys(CONTRACT_TO_COLLECTION)) {
					params.append('contractAddresses[]', addr);
				}
			}

			const res = await fetch(`${base}?${params.toString()}`);
			if (!res.ok) {
				const t = await res.text();
				return json({ error: t || `Alchemy ${res.status}` }, 502);
			}
			const data = (await res.json()) as Record<string, unknown>;
			const batch = (data.ownedNfts || data.nfts || []) as Record<string, unknown>[];
			all.push(...batch);
			pageKey = (data.pageKey as string) || null;
			if (!pageKey) break;
		}
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'Alchemy request failed' }, 502);
	}

	const nfts = all.map(normalizeNft).filter((n) => n.collectionId);
	return json({ owner: ownerVal, nfts, count: nfts.length });
}

async function proxyImage(url: string): Promise<Response> {
	const u = url.trim();
	if (!u.startsWith('http://') && !u.startsWith('https://')) {
		return new Response('Invalid url', { status: 400, headers: CORS_HEADERS });
	}
	try {
		const res = await fetch(u, {
			headers: { Accept: 'image/*,*/*' },
			redirect: 'follow',
		});
		if (!res.ok) {
			return new Response('Upstream error', { status: 502, headers: CORS_HEADERS });
		}
		const ct = res.headers.get('Content-Type') || 'image/jpeg';
		return new Response(res.body, {
			status: 200,
			headers: {
				'Content-Type': ct,
				'Cache-Control': 'public, max-age=86400',
				...CORS_HEADERS,
			},
		});
	} catch {
		return new Response('Fetch failed', { status: 502, headers: CORS_HEADERS });
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === 'OPTIONS') return corsPreflight();

		const url = new URL(request.url);
		const path = url.pathname.replace(/\/+$/, '') || '/';

		if (path === '/api/health' || path === '/health') {
			return json({
				ok: true,
				service: 'tradeport-api',
				alchemy: !!env.ALCHEMY_API_KEY?.trim(),
			});
		}

		if (path === '/api/nfts' && request.method === 'GET') {
			const owner = url.searchParams.get('owner') || '';
			const contract = url.searchParams.get('contract') || undefined;
			return fetchAlchemyNfts(env, owner, contract);
		}

		if (path === '/api/collection-samples' && request.method === 'GET') {
			const contract = url.searchParams.get('contract') || '';
			const count = Number(url.searchParams.get('count') || '3');
			return fetchCollectionSamples(env, contract, count);
		}

		if (path === '/api/nft-metadata' && request.method === 'GET') {
			const contract = url.searchParams.get('contract') || '';
			const tokenId = url.searchParams.get('tokenId') || '';
			return fetchNftMetadata(env, contract, tokenId);
		}

		if (path === '/api/img' && request.method === 'GET') {
			const target = url.searchParams.get('url');
			if (!target) return json({ error: 'Missing url param' }, 400);
			return proxyImage(target);
		}

		if (path === '/' || path === '') {
			const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TradePort API</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1.5rem;line-height:1.5;color:#e8e8f0;background:#0a0a12}
a{color:#a78bfa}code{background:#1a1a28;padding:.15rem .4rem;border-radius:.25rem;font-size:.9em}</style></head>
<body>
<h1>TradePort API</h1>
<p>This is the <strong>backend</strong> for TradePort — not the website.</p>
<p>Open the app: <a href="https://littleollielabs.com/tradeport/">littleollielabs.com/tradeport</a></p>
<p>Status check: <a href="/api/health"><code>/api/health</code></a></p>
</body></html>`;
			return new Response(html, {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
			});
		}

		return json({
			error: 'Not found',
			routes: [
				'/api/health',
				'/api/nfts?owner=0x…',
				'/api/collection-samples?contract=0x…&count=3',
				'/api/nft-metadata?contract=0x…&tokenId=1',
				'/api/img?url=…',
			],
		}, 404);
	},
} satisfies ExportedHandler<Env>;
