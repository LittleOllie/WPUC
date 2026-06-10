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

Optional env `IMPORT_MAX_TOKENS` (default 2000) caps per-request fetch size.

## UI

Open `/nft-twin-finder-import/` (with worker running locally or deployed).
