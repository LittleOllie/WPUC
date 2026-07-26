# FlexGrid architecture

## Frontend

Entry: `site/index.html` → bundled `site/dist/app.js` (esbuild from `site/src/js/app.js`).

### Module layout (incremental refactor)

| Path | Responsibility |
|------|----------------|
| `core/constants.js` | Limits, chain hosts, placeholders |
| `core/state.js` | Shared `state`, `uiState`, config flags |
| `core/dom.js` | `$()` helper |
| `core/escapeHtml.js` | Safe HTML escaping |
| `core/errors.js` | Error log + user toasts |
| `ui/loading.js` | Loading overlay, status line |
| `ui/notifications.js` | Toast UI + message mapping |
| `ui/theme.js` | Dark/light theme toggle |
| `wizard/disclaimer.js` | Session disclaimer |
| `collections/collectionSearch.js` | Collection filter |
| `wallets/walletValidation.js` | EVM / Solana validation |
| `platform/ios.js` | iOS detection |
| `export/gifLazyLoad.js` | Lazy GIF vendor scripts |
| `bootstrap.js` | Small UI initialisers |
| `api.js` | Worker NFT fetch, caches |
| `config.js` | Worker config bootstrap |
| `modules/imageLoader.js` | Image URL resolution cache |
| `chains/polygon/*` | Polygon contract-scoped load |
| `app.js` | Grid, collections, export, wizard (coordinator) |

`app.js` remains the largest file; extraction continues without behaviour changes.

## State

Single mutable `state` object in `core/state.js`. Grid build, selection, and settings read/write this object.

## Wallet → grid flow

1. User picks chain (wizard step 1).
2. Wallets validated and loaded via Worker `/api/nfts` (or Polygon contract path / Solana / custom upload).
3. NFTs grouped into collections; user selects collections / traits.
4. Build grid → tiles rendered with Worker `/img` proxy for IPFS.
5. Export PNG / GIF / MP4.

## Worker

`worker.js` routes requests, reads secrets from `env`, calls Alchemy / Moralis / Helius, and proxies images with multi-gateway IPFS fallback + edge cache.

Rate limiting: `worker/rateLimit.js` (per-isolate memory; see SECURITY.md).

## Caches

1. **NFT fetch** — memory + sessionStorage + localStorage (5 min TTL) in `api.js`
2. **Image loader** — session cache keyed by contract+tokenId in `modules/imageLoader.js`
3. **Worker `/img`** — Cloudflare cache API

## Whale mode

When grid items exceed 300, concurrency and timeouts tighten (see `core/constants.js`).

## Max NFTs

Hard cap 900 (`FLEX_GRID_MAX_NFTS`) enforced at build time.

## Errors

Technical details → console + hidden dev error log. User-facing copy → toast (`ui/notifications.js`).
