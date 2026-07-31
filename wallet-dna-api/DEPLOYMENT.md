# Wallet DNA API — Cloudflare Worker Deployment

Production API for the static Wallet DNA site on GitHub Pages.

| Item | Value |
|------|-------|
| Worker name | `lowalletdna` |
| Worker URL | `https://lowalletdna.littleollienft.workers.dev` |
| Health | `GET /health` |
| Analyse | `POST /api/wallet-dna/analyse` |
| Required secret | `ALCHEMY_API_KEY_WALLET_DNA` |

## Prerequisites

- Cloudflare account with Workers enabled (same account as FlexGrid / Collection Overlap)
- Alchemy app with **Ethereum Mainnet + Base Mainnet** NFT API access
- Node.js 20+

## 1. Cloudflare login

```bash
cd wallet-dna-api
npm install
npx wrangler login
npx wrangler whoami
```

Confirm the account/subdomain matches your existing Little Ollie Workers (`littleollienft.workers.dev`).

## 2. Build the Worker handler

```bash
cd ../wallet-dna
npm install
npm run build:worker
```

This creates `wallet-dna/dist-worker/handler.mjs`.

## 3. Set the Alchemy secret (never commit)

```bash
cd ../wallet-dna-api
npx wrangler secret put ALCHEMY_API_KEY_WALLET_DNA
# paste your Alchemy key when prompted
```

Optional local dev: copy `.dev.vars.example` → `.dev.vars` and add the key.

## 4. Deploy

```bash
npm run deploy
```

## 5. Verify health

```bash
curl -sS "https://lowalletdna.littleollienft.workers.dev/health" | jq .
```

Expected when configured:

```json
{
  "success": true,
  "service": "wallet-dna-api",
  "status": "ok",
  "scoringVersion": "1.0",
  "schemaVersion": 2,
  "alchemyConfigured": true,
  "deploymentVersion": "1.0.0",
  "requestId": "..."
}
```

## 6. Verify analyse

```bash
curl -sS -X POST "https://lowalletdna.littleollienft.workers.dev/api/wallet-dna/analyse" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'
```

## 7. Publish static frontend

```bash
cd ../wallet-dna
npm run build:ollie-images   # first time / after PNG changes
npm run publish
```

Commit and push the `wallet-dna/` static output folder with the main site.

## Frontend API base

Set at publish time in `scripts/publish-static.mjs`:

`NEXT_PUBLIC_WALLET_DNA_API_BASE=https://lowalletdna.littleollienft.workers.dev`
