/**
 * BidSniper API — OpenSea proxy (keys stay server-side).
 * Routes: GET /api/health, GET|POST /api/bidsniper
 */

const OPENSEA_BASE = 'https://api.opensea.io/api/v2';
const MIN_SPREAD_ETH = 0.001;
const OFFER_CONCURRENCY = 8;
const LISTING_PAGE_SIZE = 50;

const CHAIN_MAP: Record<string, string> = {
	eth: 'ethereum',
	ethereum: 'ethereum',
	base: 'base',
};

const OS_ASSET_CHAIN: Record<string, string> = {
	ethereum: 'ethereum',
	base: 'base',
};

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

interface Env {
	OPENSEA_API_KEY: string;
}

type OsOrder = Record<string, unknown>;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	});
}

function corsPreflight(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function normalizeChain(raw: string | null): string | null {
	if (!raw) return null;
	const key = raw.trim().toLowerCase();
	return CHAIN_MAP[key] ?? null;
}

function isContractAddress(s: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function extractOpenSeaSlug(input: string): string | null {
	try {
		const url = new URL(input.trim());
		if (!/opensea\.io$/i.test(url.hostname.replace(/^www\./, ''))) return null;
		const parts = url.pathname.split('/').filter(Boolean);
		if (parts[0] === 'collection' && parts[1]) return decodeURIComponent(parts[1]);
	} catch {
		/* not a URL */
	}
	return null;
}

function extractOpenSeaAsset(input: string): boolean {
	try {
		const url = new URL(input.trim());
		if (!/opensea\.io$/i.test(url.hostname.replace(/^www\./, ''))) return false;
		const parts = url.pathname.split('/').filter(Boolean);
		return parts[0] === 'assets' && parts.length >= 4;
	} catch {
		return false;
	}
}

function orderPriceEth(order: OsOrder): number {
	const price = order.price as Record<string, unknown> | undefined;
	const current = price?.current as Record<string, unknown> | undefined;
	const value = current?.value ?? price?.value;
	const decimals = (current?.decimals ?? price?.decimals) as number | undefined;
	if (typeof value === 'string' && typeof decimals === 'number') {
		const n = Number(value) / 10 ** decimals;
		if (Number.isFinite(n) && n > 0) return n;
	}
	return 0;
}

function orderEndTime(order: OsOrder): number | null {
	const params = (order.protocol_data as Record<string, unknown> | undefined)
		?.parameters as Record<string, unknown> | undefined;
	const end = params?.endTime;
	if (end == null) return null;
	const n = Number(end);
	return Number.isFinite(n) ? n : null;
}

function isOrderActive(order: OsOrder, nowSec: number): boolean {
	if (order.status !== 'ACTIVE') return false;
	const price = orderPriceEth(order);
	if (price <= 0) return false;
	const end = orderEndTime(order);
	if (end != null && end > 0 && end < nowSec) return false;
	return true;
}

function listingTokenId(order: OsOrder): string | null {
	const params = (order.protocol_data as Record<string, unknown> | undefined)
		?.parameters as Record<string, unknown> | undefined;
	const offer = params?.offer as Record<string, unknown>[] | undefined;
	const item = offer?.[0];
	if (!item) return null;
	const id = item.identifierOrCriteria;
	if (id == null) return null;
	return String(id);
}

async function openSeaFetch(
	env: Env,
	path: string,
	params: Record<string, string | number | undefined> = {}
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; message: string }> {
	const apiKey = env.OPENSEA_API_KEY?.trim();
	if (!apiKey) {
		return { ok: false, status: 503, message: 'OpenSea API key not configured on server.' };
	}

	const url = new URL(`${OPENSEA_BASE}${path}`);
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
	}

	const res = await fetch(url.toString(), {
		headers: {
			accept: 'application/json',
			'x-api-key': apiKey,
		},
	});

	const text = await res.text();
	let data: Record<string, unknown> = {};
	try {
		data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
	} catch {
		return { ok: false, status: 502, message: 'Invalid response from OpenSea.' };
	}

	if (res.status === 429) {
		return { ok: false, status: 429, message: 'Rate limited — wait a moment and try again.' };
	}
	if (!res.ok) {
		const errors = data.errors as string[] | undefined;
		const errObj = data.error as Record<string, unknown> | undefined;
		const msg =
			(errors?.[0]) ||
			(typeof errObj?.message === 'string' && errObj.message) ||
			(typeof data.message === 'string' && data.message) ||
			`OpenSea error (${res.status})`;
		return { ok: false, status: res.status >= 400 && res.status < 600 ? res.status : 502, message: msg };
	}

	return { ok: true, data };
}

async function resolveCollection(
	env: Env,
	chain: string,
	input: string
): Promise<
	| { ok: true; contract: string; name: string; slug: string }
	| { ok: false; message: string }
> {
	const trimmed = input.trim();
	if (!trimmed) return { ok: false, message: 'Enter a collection URL or contract address.' };

	if (extractOpenSeaAsset(trimmed)) {
		return {
			ok: false,
			message: 'Paste a collection page URL or contract — not a single NFT asset link.',
		};
	}

	const slugFromUrl = extractOpenSeaSlug(trimmed);
	if (slugFromUrl) {
		const meta = await openSeaFetch(env, `/collections/${encodeURIComponent(slugFromUrl)}`);
		if (!meta.ok) {
			return { ok: false, message: meta.message || 'Collection not found on OpenSea.' };
		}
		const contracts = meta.data.contracts as { address?: string; chain?: string }[] | undefined;
		const match =
			contracts?.find((c) => (c.chain || '').toLowerCase() === chain) || contracts?.[0];
		const contract = match?.address?.toLowerCase();
		if (!contract || !isContractAddress(contract)) {
			return { ok: false, message: 'Collection not found on this chain.' };
		}
		const name = (typeof meta.data.name === 'string' && meta.data.name) || slugFromUrl;
		const slug =
			(typeof meta.data.collection === 'string' && meta.data.collection) || slugFromUrl;
		return { ok: true, contract, name, slug };
	}

	if (isContractAddress(trimmed)) {
		const contract = trimmed.toLowerCase();
		const meta = await openSeaFetch(
			env,
			`/chain/${chain}/contract/${contract}`
		);
		if (!meta.ok) {
			return {
				ok: false,
				message: 'Contract not found on OpenSea for this chain.',
			};
		}
		const slug =
			(typeof meta.data.collection === 'string' && meta.data.collection) || '';
		const name = (typeof meta.data.name === 'string' && meta.data.name) || 'Collection';
		if (!slug) {
			return { ok: false, message: 'No OpenSea collection linked to this contract.' };
		}
		return { ok: true, contract, name, slug };
	}

	if (trimmed.startsWith('http')) {
		return { ok: false, message: 'Unrecognized URL — use an OpenSea collection link or contract address.' };
	}

	return { ok: false, message: 'Invalid collection — use OpenSea URL or 0x contract address.' };
}

type ListingRow = {
	contract: string;
	tokenId: string;
	listingEth: number;
};

async function fetchLowestListings(
	env: Env,
	slug: string,
	limit: number
): Promise<{ rows: ListingRow[] } | { error: string; status: number }> {
	const rows: ListingRow[] = [];
	let next: string | undefined;
	const nowSec = Math.floor(Date.now() / 1000);

	while (rows.length < limit) {
		const pageLimit = Math.min(LISTING_PAGE_SIZE, limit - rows.length);
		const params: Record<string, string | number | undefined> = { limit: pageLimit };
		if (next) params.next = next;

		const res = await openSeaFetch(
			env,
			`/listings/collection/${encodeURIComponent(slug)}/best`,
			params
		);
		if (!res.ok) return { error: res.message, status: res.status };

		const batch = (res.data.listings as OsOrder[] | undefined) ?? [];
		if (!batch.length) break;

		for (const order of batch) {
			if (!isOrderActive(order, nowSec)) continue;
			const tokenId = listingTokenId(order);
			if (!tokenId) continue;
			const paramsInner = (order.protocol_data as Record<string, unknown> | undefined)
				?.parameters as Record<string, unknown> | undefined;
			const offer = paramsInner?.offer as Record<string, unknown>[] | undefined;
			const contract = (offer?.[0]?.token as string | undefined)?.toLowerCase();
			if (!contract || !isContractAddress(contract)) continue;
			const listingEth = orderPriceEth(order);
			if (listingEth <= 0) continue;
			rows.push({ contract, tokenId, listingEth });
			if (rows.length >= limit) break;
		}

		const nextVal = res.data.next;
		next = typeof nextVal === 'string' && nextVal ? nextVal : undefined;
		if (!next) break;
	}

	return { rows };
}

async function fetchBestOffer(
	env: Env,
	slug: string,
	tokenId: string
): Promise<OsOrder | null> {
	const res = await openSeaFetch(
		env,
		`/offers/collection/${encodeURIComponent(slug)}/nfts/${encodeURIComponent(tokenId)}/best`
	);
	if (!res.ok) return null;
	if (!res.data.order_hash && !res.data.price) return null;
	const nowSec = Math.floor(Date.now() / 1000);
	return isOrderActive(res.data as OsOrder, nowSec) ? (res.data as OsOrder) : null;
}

async function mapPool<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;

	async function worker(): Promise<void> {
		while (true) {
			const i = next++;
			if (i >= items.length) return;
			results[i] = await fn(items[i]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
	return results;
}

async function fetchNftImage(
	env: Env,
	chain: string,
	contract: string,
	tokenId: string
): Promise<string | null> {
	const res = await openSeaFetch(
		env,
		`/chain/${chain}/contract/${contract}/nfts/${encodeURIComponent(tokenId)}`
	);
	if (!res.ok) return null;
	const nft = (res.data.nft ?? res.data) as Record<string, unknown>;
	const image =
		(typeof nft.image_url === 'string' && nft.image_url) ||
		(typeof nft.display_image_url === 'string' && nft.display_image_url) ||
		null;
	return image;
}

interface ScanBody {
	collection?: string;
	chain?: string;
	scanAmount?: number;
}

async function handleScan(env: Env, body: ScanBody): Promise<Response> {
	const collectionInput = typeof body.collection === 'string' ? body.collection : '';
	const chain = normalizeChain(typeof body.chain === 'string' ? body.chain : 'eth');
	if (!chain) {
		return json({ ok: false, error: 'Choose ETH or Base.' }, 400);
	}

	let scanAmount = Number(body.scanAmount);
	if (!Number.isFinite(scanAmount)) scanAmount = 50;
	scanAmount = Math.max(1, Math.min(200, Math.floor(scanAmount)));

	const resolved = await resolveCollection(env, chain, collectionInput);
	if (!resolved.ok) {
		return json({ ok: false, error: resolved.message }, 400);
	}

	const listingsRes = await fetchLowestListings(env, resolved.slug, scanAmount);
	if ('error' in listingsRes) {
		const status = listingsRes.status === 429 ? 429 : listingsRes.status >= 500 ? 502 : 400;
		return json({ ok: false, error: listingsRes.error }, status);
	}

	const rows = listingsRes.rows;
	if (!rows.length) {
		return json({
			ok: true,
			collection: {
				contract: resolved.contract,
				name: resolved.name,
				slug: resolved.slug,
			},
			chain,
			scanned: 0,
			opportunities: [],
			message: 'No active listings found for this collection.',
		});
	}

	const offerResults = await mapPool(rows, OFFER_CONCURRENCY, async (row) => {
		const offer = await fetchBestOffer(env, resolved.slug, row.tokenId);
		return { row, offer };
	});

	const candidates: {
		contract: string;
		tokenId: string;
		listingEth: number;
		offerEth: number;
		spreadEth: number;
		spreadPct: number;
	}[] = [];

	for (const { row, offer } of offerResults) {
		if (!offer) continue;
		const offerEth = orderPriceEth(offer);
		if (offerEth <= 0) continue;
		if (offerEth <= row.listingEth) continue;

		const spreadEth = offerEth - row.listingEth;
		if (spreadEth < MIN_SPREAD_ETH) continue;

		const spreadPct = row.listingEth > 0 ? (spreadEth / row.listingEth) * 100 : 0;
		candidates.push({
			contract: row.contract,
			tokenId: row.tokenId,
			listingEth: row.listingEth,
			offerEth,
			spreadEth,
			spreadPct,
		});
	}

	candidates.sort((a, b) => b.spreadEth - a.spreadEth);

	const osChain = OS_ASSET_CHAIN[chain] ?? 'ethereum';
	const opportunities = await mapPool(candidates, 6, async (c) => {
		const imageUrl = await fetchNftImage(env, chain, c.contract, c.tokenId);
		return {
			tokenId: c.tokenId,
			imageUrl,
			listingEth: roundEth(c.listingEth),
			highestOfferEth: roundEth(c.offerEth),
			spreadEth: roundEth(c.spreadEth),
			spreadPct: Math.round(c.spreadPct * 10) / 10,
			marketplace: 'OpenSea',
			openSeaUrl: `https://opensea.io/assets/${osChain}/${c.contract}/${c.tokenId}`,
		};
	});

	return json({
		ok: true,
		collection: {
			contract: resolved.contract,
			name: resolved.name,
			slug: resolved.slug,
		},
		chain,
		scanned: rows.length,
		opportunities,
		count: opportunities.length,
		message:
			opportunities.length === 0
				? 'No listings below active offers in this scan range.'
				: undefined,
	});
}

function roundEth(n: number): number {
	return Math.round(n * 10000) / 10000;
}

async function parseScanBody(request: Request): Promise<ScanBody> {
	if (request.method === 'POST') {
		try {
			return (await request.json()) as ScanBody;
		} catch {
			return {};
		}
	}
	const url = new URL(request.url);
	return {
		collection: url.searchParams.get('collection') ?? undefined,
		chain: url.searchParams.get('chain') ?? undefined,
		scanAmount: url.searchParams.has('scanAmount')
			? Number(url.searchParams.get('scanAmount'))
			: undefined,
	};
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'OPTIONS') return corsPreflight();

		if (url.pathname === '/api/health') {
			return json({
				ok: true,
				service: 'bidsniper-worker',
				provider: 'opensea',
				hasKey: Boolean(env.OPENSEA_API_KEY?.trim()),
			});
		}

		if (url.pathname === '/api/bidsniper' && (request.method === 'GET' || request.method === 'POST')) {
			const body = await parseScanBody(request);
			return handleScan(env, body);
		}

		return json({ error: 'Not found' }, 404);
	},
};
