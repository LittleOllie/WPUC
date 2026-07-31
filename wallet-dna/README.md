# Wallet DNA

A Little Ollie Web3 utility — analyse public Ethereum and Base NFT activity to discover your collector personality, five DNA scores, badges and a shareable card.

## Setup

```bash
cd wallet-dna
npm install
cp .env.example .env.local
```

### Alchemy

1. Create an Alchemy app with Ethereum + Base NFT API access.
2. Add `ALCHEMY_API_KEY` or `ALCHEMY_API_KEY_WALLET_DNA` to `.env.local` (server only).

### Development

```bash
npm run dev          # Next.js at http://localhost:3001
WALLET_DNA_USE_FIXTURES=true npm run dev   # No Alchemy credits
npm test
npm run typecheck
npm run build
```

### Fixture wallets (dev only)

| Address | Profile |
|---------|---------|
| `0x1111111111111111111111111111111111111111` | Diamond Collector |
| `0x2222222222222222222222222222222222222222` | Base Explorer |
| `0x3333333333333333333333333333333333333333` | Genesis Seeker |
| `0x4444444444444444444444444444444444444444` | Collection Loyalist |
| `0x5555555555555555555555555555555555555555` | No NFT activity |

### Static site (GitHub Pages)

```bash
npm run publish
# Deploy wallet-dna/ folder; API via wallet-dna-api Worker
```

### Worker API

```bash
cd wallet-dna
npm run build:worker
cd ../wallet-dna-api
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

Deploy: `npx wrangler secret put ALCHEMY_API_KEY_WALLET_DNA`

## Routes

- `/wallet-dna/` — main app
- `/wallet-dna/methodology/` — scoring transparency
- `POST /api/wallet-dna/analyse`

## Visual showcase (v2)

Results include a premium identity layout with:

- **Personality hero** — large Ollie artwork, narrative, strongest trait
- **Your Wallet Highlights** — Oldest Friend, Newest Pickup, Most-Held Collection, Most Active Chain
- **Inside This Wallet** — deterministic NFT gallery (12–24 items)
- **Collection Breakdown** — visual collection cards with representative artwork
- **Hide from showcase** — local preference per wallet; does **not** change scores
- **Share Studio** — **Web3 Passport** (default) or Collector Showcase; landscape / square / portrait export

## Web3 Passport

The primary share format is a **Web3 Passport** — a Wallet DNA collector identity card. It is **not** legal identification or proof of wallet ownership.

- **Passport number** (`WD-XXXX-XXXX`) — decorative ID from wallet + scoring version (see `WALLET_DNA_IMPLEMENTATION.md`)
- **Stamps** — derived from real analysis (chains, badges, veteran status)
- **No NFT images required** — uses local Ollie artwork with fallback
- Preferences persist per wallet in localStorage

See `WALLET_DNA_DESIGN_AUDIT.md` for FlexGrid / Games Lab styling alignment.

Optional passport Ollie PNGs: `public/passport/` (see README there).

### Language notes

- **Most-Held Collection** is a quantity fact, not a favourite or endorsement.
- **Newest Pickup** means most recently received while still held — not necessarily purchased.
- **Oldest Friend** uses the current uninterrupted hold period (re-acquired NFTs reset the clock).
- NFT valuation is **disabled** (`WALLET_DNA_ENABLE_VALUATION=false`) until reliable market data is wired in.

## MVP limitations

See `WALLET_DNA_IMPLEMENTATION.md`.

Scoring version: **1.0** · Schema version: **2** (includes `visuals` in API results)
