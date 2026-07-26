# FlexGrid setup

## Overview

FlexGrid is a static site (`site/`) plus a Cloudflare Worker (`worker.js`) that proxies NFT APIs and images. API keys never ship to the browser.

## Prerequisites

- Node.js 20+ (22 LTS recommended)
- npm
- Cloudflare account + Wrangler CLI (via `npm install` in this folder)

## Installation

```bash
cd flexgrid
npm install
```

## Local secrets (`.dev.vars`)

Wrangler reads **`.dev.vars`** in the `flexgrid/` folder for local development only.

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with placeholder keys replaced by your own:

- `ALCHEMY_API_KEY` — Ethereum, Base, Polygon (required for those chains)
- `MORALIS_API_KEY` — ApeChain primary
- `HELIUS_API_KEY` — Solana beta

**Never commit `.dev.vars`.** It is listed in `.gitignore`.

Production secrets:

```bash
npx wrangler secret put ALCHEMY_API_KEY
npx wrangler secret put MORALIS_API_KEY
npx wrangler secret put HELIUS_API_KEY
```

Optional rate-limit tuning (Worker env vars):

- `RATE_LIMIT_API_MAX` (default 90/min/IP)
- `RATE_LIMIT_IMG_MAX` (default 240/min/IP)
- `RATE_LIMIT_WINDOW_MS` (default 60000)

## Build

```bash
npm run build          # site/dist/app.js (minified + sourcemap)
npm run build:images   # WebP variants in site/src/assets/images/
```

`site/index.html` loads `dist/app.js`. Run `npm run build` before `npm run dev` or deploy.

## Development

```bash
npm run build
npm run dev
```

On localhost, `config.js` tries the production Worker first, then same-origin `/api/config/flex-grid`.

## Production deploy

```bash
npm run deploy
```

This runs `npm run build` then `wrangler deploy`. Static assets come from `site/` per `wrangler.jsonc`.

## Worker routes

| Route | Purpose |
|-------|---------|
| `GET /api/config/flex-grid` | Returns `{ workerUrl }` (no secrets) |
| `GET /api/nfts` | Wallet NFTs (Alchemy / Moralis) |
| `GET /api/solana-nfts` | Solana via Helius |
| `GET /api/nft-metadata` | Single NFT metadata |
| `GET /api/contract-metadata` | Collection logo / name |
| `GET /img?url=` | Image proxy + IPFS gateway fallback |

## Troubleshooting

- **Config error on load** — Worker missing secrets or not running; check Wrangler logs.
- **429 errors** — Rate limit hit; wait for `Retry-After` seconds.
- **Missing `dist/app.js`** — Run `npm run build`. For **littleollielabs.com** (static GitHub/host deploy), commit `site/dist/app.js` with the site — it is not generated on the server.
- **Continue button does nothing** — Usually `dist/app.js` 404 on production; rebuild, commit `site/dist/app.js`, redeploy. The welcome overlay also has an inline `onclick` fallback on Continue.
- **Disclaimer every session** — Expected; dismissed via `sessionStorage` per tab. Force with `?disclaimer=1`.

## Security

Never commit API keys. Rotate any key that was ever committed to git history — removing a file does not erase history.

See [SECURITY.md](SECURITY.md).
