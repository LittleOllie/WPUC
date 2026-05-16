# Web3House — Live NFT art

Web3House uses the **same Cloudflare Worker as TradePort** for random collection art (Alchemy stays on the server).

## API

| Item | Value |
|------|--------|
| Worker | `tradeport/tradeport-worker/` |
| Production URL | `https://tradeport-worker.hermanft-eth.workers.dev` |
| Config | `web3house/config.js` → `API_BASE_URL` |

Endpoints used:

- `GET /api/collection-samples?contract=0x…&count=6` — random NFTs per collection
- `GET /api/img?url=…` — image proxy when needed
- `GET /api/health` — optional status check

## Local dev

**Terminal 1 — Worker (from TradePort folder):**

```bash
cd tradeport/tradeport-worker
npm run dev
```

**Terminal 2 — Static site (repo root):**

```bash
cd "/path/to/WPUCnew copy 3"
python3 -m http.server 8766
```

Open: `http://localhost:8766/web3house/`

For local API, set in `config.js`:

```javascript
API_BASE_URL: "http://127.0.0.1:8787",
```

## Scripts (load order)

1. `config.js` — Worker URL  
2. `api.js` — fetch samples, image URLs  
3. `nft-images.js` — Quirkies S3 / Quirklings IPFS fallbacks  
4. `nft-samples.js` — card strips + detail gallery  
5. `app.js` — UI  

## Collections with live art

All Ethereum collections include `contract` + `collectionId` (TradePort ids). **Little Ollie** has no contract — gallery explains studio brand only.

Deploy worker once (`npm run deploy` in `tradeport-worker`); both TradePort and Web3House share it.
