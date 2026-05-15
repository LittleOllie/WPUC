# TradePort — Get it working (Alchemy + Wallet)

Follow these steps in order. You need **two terminals** for local dev.

---

## What you have now

| Piece | Folder | Role |
|-------|--------|------|
| **Website** | `tradeport/` | React app (UI) |
| **API** | `tradeport/tradeport-worker/` | Cloudflare Worker → calls Alchemy (key stays secret) |

Browse trades still uses **mock data** until you add a database (Firebase later).  
**Create Trade** loads **real NFTs** from your wallet via Alchemy when the API is running.

---

## Step 1 — Alchemy key (you did this)

1. [dashboard.alchemy.com](https://dashboard.alchemy.com) → your **TradePort** app  
2. Chain: **Ethereum** → **Mainnet**  
3. Copy the **API key**

---

## Step 2 — Worker local secret

```bash
cd tradeport/tradeport-worker
npm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and paste your key:

```
ALCHEMY_API_KEY=alcht_xxxxxxxx
```

**Never commit `.dev.vars`.**

---

## Step 3 — Run API + website (local)

**Terminal A — API (port 8787):**

```bash
cd tradeport/tradeport-worker
npm run dev
```

Test: open http://127.0.0.1:8787/api/health  
You should see `"alchemy": true`.

**Terminal B — Website (port 5173):**

```bash
cd tradeport
npm install
npm run dev
```

Open http://localhost:5173

Vite proxies `/api/*` → the worker automatically.

---

## Step 4 — Test wallet + NFTs

1. Install [MetaMask](https://metamask.io) and use **Ethereum Mainnet**  
2. Open TradePort → **Connect Wallet**  
3. Go to **Create Trade** → pick a collection you hold (DDG / Long Lost / Quirkies)  
4. Step 2 should load your NFTs from Alchemy  

If you see *"Could not load NFTs. Is the API running?"* → Terminal A is not running or `.dev.vars` is missing.

---

## Step 5 — Deploy API to Cloudflare

```bash
cd tradeport/tradeport-worker
npx wrangler login
npx wrangler secret put ALCHEMY_API_KEY
npm run deploy
```

Note the URL, e.g. `https://tradeport-api.yourname.workers.dev`

Test: `https://tradeport-api.yourname.workers.dev/api/health`

---

## Step 6 — Deploy website (Cloudflare Pages)

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → Connect **GitHub**  
2. Repo: `LittleOllie/WPUC` (or your repo)  
3. **Root directory:** `tradeport`  
4. **Build command:** `npm install && npm run build`  
5. **Build output:** `dist`  
6. **Environment variable** (Production):

   | Name | Value |
   |------|--------|
   | `VITE_API_BASE_URL` | `https://tradeport-api.yourname.workers.dev` |

7. Deploy

**Do not** use the generic “Create Worker” wizard with an empty build command for the React app — use **Pages** with the settings above.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `alchemy: false` on /api/health | Set `ALCHEMY_API_KEY` in `.dev.vars` or `wrangler secret put` |
| No NFTs | Wallet on **Mainnet**; you must hold NFTs from DDG / Long Lost / Quirkies contracts |
| CORS errors | Use `VITE_API_BASE_URL` pointing to your Worker in production |
| Images broken | Worker `/api/img` proxy; some IPFS URLs may still fail |

---

## Still mock (coming later)

- Browse `/trades` listings (needs database)
- Save / publish listings permanently
- Profile persistence

---

## Quick commands

```bash
# API
cd tradeport/tradeport-worker && npm run dev

# UI
cd tradeport && npm run dev
```
