# NFT Twin Finder — Contract Import API

Cloudflare Worker that fetches NFT metadata from a contract via Alchemy.

## Setup

```bash
cd nft-twin-finder-import-api
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars — add ALCHEMY_API_KEY_NFT_IMPORT
npm run dev
```

Worker runs at `http://127.0.0.1:8787` by default.

## Deploy

```bash
npx wrangler secret put ALCHEMY_API_KEY_NFT_IMPORT
npm run deploy
```

Production worker: `https://twinapp.littleollienft.workers.dev`

## Endpoint

```
GET /api/import-collection?network=ethereum&contract=0x...
```

Networks: `ethereum`, `base`, `apechain`, `polygon`

Returns: collection name, supply, metadata source info, samples, `metadata`, `images`.

Imports use the collection **total supply** when known (e.g. Space Riders 8888), up to **10,000** by default.

Optional env `IMPORT_MAX_TOKENS` raises that ceiling. Hard max per request: **15,000** (Worker limits).

Large collections are fetched in **chunks** (~4,000 tokens per worker call) to stay under Cloudflare's subrequest limit. The importer UI loops automatically.

Query override: `?limit=8888` on the first chunk.

## UI

Open `/nft-twin-finder-import/` (with worker running locally or deployed).
