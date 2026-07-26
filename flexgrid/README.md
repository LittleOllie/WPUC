# Flex Grid — Little Ollie NFT Grid Builder

Build shareable NFT collages from one or more wallets. Export PNG, GIF, or MP4.

## Quick start

```bash
cd flexgrid
npm install
cp .dev.vars.example .dev.vars   # add API keys locally (never commit)
npm run build                   # bundle frontend → site/dist/app.js
npm run dev                     # Wrangler dev (Worker + static site)
```

Open the URL Wrangler prints (typically `http://127.0.0.1:8787`).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Worker + static assets |
| `npm run build` | Minified ESM bundle to `site/dist/app.js` |
| `npm run build:images` | Generate WebP variants of large PNGs |
| `npm run test` | Vitest unit tests |
| `npm run check` | Build + tests |
| `npm run deploy` | Build then `wrangler deploy` |

## Documentation

- [docs/FLEX_GRID_SETUP.md](docs/FLEX_GRID_SETUP.md) — install, secrets, deploy
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, Worker, caches
- [docs/SECURITY.md](docs/SECURITY.md) — secrets, rate limits, CSP
- [docs/TESTING.md](docs/TESTING.md) — automated and manual test matrix

## Structure

```text
flexgrid/
├── worker.js              # Production Cloudflare Worker
├── worker/rateLimit.js    # In-Worker abuse protection
├── wrangler.jsonc
├── site/                  # Static UI (Wrangler assets)
│   ├── index.html
│   ├── dist/app.js        # Production bundle (generated)
│   └── src/js/            # Source modules
└── tests/
```

## Supported chains

Ethereum, Base, ApeChain, Polygon (contract-scoped), Solana (beta), Custom image upload.

---

Little Ollie Studio
