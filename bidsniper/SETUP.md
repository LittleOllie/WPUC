# BidSniper — setup

Isolated app at `/bidsniper/`. Uses the **OpenSea API** (Reservoir NFT API is discontinued).

## 1. OpenSea API key

1. Get a key: [OpenSea API keys](https://docs.opensea.io/reference/api-keys)
2. Copy `bidsniper/bidsniper-worker/.dev.vars.example` → `.dev.vars`
3. Set `OPENSEA_API_KEY=...` (never commit `.dev.vars`)

## 2. Run worker locally

```bash
cd bidsniper/bidsniper-worker
npm install
npm run dev
```

Worker: `http://127.0.0.1:8790`  
Health: `http://127.0.0.1:8790/api/health`

### Port already in use?

If you see `Address already in use (127.0.0.1:8790)`:

```bash
lsof -i :8790
kill <PID>
```

Or free the old default port:

```bash
lsof -i :8788
kill <PID>
```

Then run `npm run dev` again. Only **one** worker terminal should be running.

## 3. Run frontend locally

From repo root:

```bash
python3 -m http.server 8767
```

Open: `http://localhost:8767/bidsniper/`

## 4. Deploy worker

```bash
cd bidsniper/bidsniper-worker
npx wrangler secret put OPENSEA_API_KEY
npm run deploy
```

Update `bidsniper/config.js` → `BIDSNIPER_WORKER_PROD` with your Workers URL.

## API

`POST /api/bidsniper`

```json
{
  "collection": "https://opensea.io/collection/...",
  "chain": "eth",
  "scanAmount": 50
}
```

Chains: `eth` / `ethereum`, `base`.
