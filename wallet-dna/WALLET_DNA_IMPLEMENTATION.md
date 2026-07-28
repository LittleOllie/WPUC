# Wallet DNA — Implementation Plan

## Stack decision

| Layer | Choice | Rationale |
|-------|--------|-----------|
| UI | Next.js 15 + React 19 + TypeScript | Matches `x-inner-circle`; supports `/wallet-dna`, methodology, SEO metadata |
| Styling | Tailwind 4 + Little Ollie CSS tokens | Reuses brand colours from `styles/site-brand.css` |
| API (dev/Vercel) | Next.js Route Handler `POST /api/wallet-dna/analyse` | Server-side Alchemy; keys never in browser |
| API (production static site) | Cloudflare Worker `wallet-dna-api/` | Same pattern as `collection-overlap-api` |
| Static hosting | `npm run publish` → `/wallet-dna/` on GitHub Pages | Dual deploy like X Inner Circle |
| Tests | Vitest | Matches sibling apps |
| ENS | ensideas public API (fetch) | Forward + reverse resolution |
| Share export | html-to-image | Client-side PNG |

## Routes

| Route | Purpose |
|-------|---------|
| `/wallet-dna/` | Landing + analysis + results (query `?wallet=0x...`) |
| `/wallet-dna/methodology/` | Scoring transparency |
| `POST /api/wallet-dna/analyse` | Analysis endpoint (Next dev / Vercel) |
| Worker `POST /api/wallet-dna/analyse` | Analysis endpoint (static site) |

## Directory layout

```text
wallet-dna/
  src/lib/wallet-dna/     # Pure analysis (shared by Next + Worker bundle)
  src/components/wallet-dna/
  src/app/
  src/tests/
  scripts/publish-static.mjs

wallet-dna-api/
  worker.js
  wrangler.toml
```

## Navigation

Add to `links/index.html` → NFT Tools Lab panel.

## Environment variables

See `.env.example`. Secret Alchemy key never uses `NEXT_PUBLIC_` prefix.

## Phases completed in this MVP

1. Core types + Alchemy provider (ETH + Base ownership + transfers)
2. Spam filtering + coverage metadata
3. Five deterministic scores + personalities + badges + narrative
4. API with cache, rate limit, fixtures mode
5. Full UI flow + Share Studio + methodology
6. Vitest unit tests + API route tests
7. Worker API for static deployment
8. Publish script + hub link
9. **Premium visual upgrade (schema v2)** — NFT gallery, highlights, collection breakdown, hide-from-showcase, redesigned Share Studio

## Visual data model (schema v2)

`WalletDNAResult.visuals` is computed server-side during analysis:

| Field | Purpose |
|-------|---------|
| `highlights` | Oldest Friend, Newest Pickup, Most-Held Collection, Most Active Chain |
| `galleryNFTs` | Deterministic sample for gallery + share collage source |
| `collectionShowcase` | Top collections with representative NFT thumbnails |

Client-side `useVisualPreferences` filters hidden collections (`chain:contract`) from gallery, breakdown, highlights and share card only. Analytical scores and snapshot totals are unchanged.

### Longest hold

`currentHoldStartedAt()` walks inbound/outbound transfer history. Outbound clears ownership; the next inbound starts a new hold period.

### NFT images

`normaliseNftImageUrl()` accepts HTTPS, IPFS and Arweave; rejects SVG/data URLs. UI uses thumbnails where available with branded fallback tiles.

### Valuation

Types exist (`NFTValuationResult`) but feature flag `WALLET_DNA_ENABLE_VALUATION=false` — no valuation cards are shown.

## Web3 Passport (share v3)

Primary Share Studio export. Does **not** replace blockchain analysis.

| Module | Purpose |
|--------|---------|
| `passport/passport-number.ts` | `createWalletPassportNumber()` → `WD-XXXX-XXXX` |
| `passport/passport-stamps.ts` | Stamp candidates + `selectPassportStamps()` |
| `passport/passport-layout.ts` | Deterministic stamp zones + layout presets |
| `passport/passport-data.ts` | `buildWalletPassportData()` |
| `components/wallet-dna/passport/*` | Landscape / square / portrait layouts |
| `hooks/usePassportPreferences.ts` | Per-wallet localStorage prefs |

### Passport number methodology

Decorative identifier: `hash(normalisedAddress + scoringVersion + salt)` → uppercase hex segments. Not reversible, not a credential, not ownership verification.

### Stamp criteria

| Stamp | Unlock |
|-------|--------|
| Wallet DNA Analysed | Always |
| Ethereum | ≥1 included ETH NFT |
| Base | ≥1 included Base NFT |
| Multi-Chain | Both chains + ≥3 held |
| NFT Veteran | First activity ≥3 years ago |
| Diamond Hands | Badge or score ≥65 |
| Deep Freeze | 730+ day hold badge |
| Mint Machine | Badge |
| Collection Explorer | Badge |
| Loyal Holder | Badge |
| Vault Keeper | Badge |

Max stamps: landscape 6, square 5, portrait 7. Density: minimal / standard / full.

### Design alignment

See `WALLET_DNA_DESIGN_AUDIT.md` — Fredoka + Nunito, `--lo-blue` / `--lo-yellow`, glass cards on brand gradient.

### Asset requirements

Optional PNGs in `public/passport/ollie-*.png`. Falls back to `/ollie/default.png`.

## Known MVP limitations

Documented in README — partial history caps, ERC-1155 approximations, no sales inference, Genesis Analyst badge disabled without DB.
