# OGENIE × CERT Set Checker

A small **LO Labs–style** utility: enter an Ethereum wallet and see **OGENIE** and **CERT** NFTs paired by **token ID**, plus who holds the missing counterpart.

- **Frontend:** plain HTML, CSS, and JavaScript (`public/`)
- **Backend:** Cloudflare Worker (`src/index.js`) using **Alchemy Ethereum Mainnet NFT API**
- **Contracts:** OGENIE `0x5aDc3753e8ee8D284D231A38794F688aC30541C5` · CERT `0x0C212fdB58d31e36039EfA2c85DFB0482Af8F2ee`

The Alchemy API key is **never** committed to the repo. It is read at runtime from the Worker secret **`ALCHEMY_API_KEY`**.

The Worker uses Alchemy **NFT API v3** endpoints: `getNFTsForOwner` (with `pageKey` pagination) and `getOwnersForNFT` (v3 name for per–token-id owner lookup; older docs sometimes call this `getOwnersForToken`).

`wrangler.toml` includes **`[assets]`** so the **same Worker URL** serves `public/index.html` (and CSS/JS) and the `/api/...` routes. Opening the Worker root in a browser should show the app, not `{"error":"Not found"}`.

### If you still see `{"error":"Not found"}`

| Situation | Cause | Fix |
|-----------|--------|-----|
| You open the Worker URL **without** redeploying after adding `[assets]` | Old deploy had no static files | Run `wrangler deploy` again from this project |
| You call **`/api/foo`** or a typo | Only `/api/wallet` and `/api/token` exist | Use the exact paths in the docs |
| **Live Server** / localhost can’t load data | Browser calls `localhost` for `/api`, which is not your Worker | Already handled: `public/app.js` uses `WORKER_ORIGIN` on localhost (edit that constant if your Worker URL changes) |

---

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended) if you use `npx` for Wrangler
- A [Cloudflare](https://dash.cloudflare.com/) account
- An [Alchemy](https://www.alchemy.com/) account with an **Ethereum Mainnet** NFT API key

---

## 1. Install Wrangler

```bash
npm install -g wrangler
```

Or use `npx wrangler` without a global install (prefix commands with `npx`).

---

## 2. Log in to Cloudflare

```bash
wrangler login
```

This opens a browser flow to authorize Wrangler for your Cloudflare account.

---

## 3. Add the Alchemy API secret

From the project directory (where `wrangler.toml` lives):

```bash
wrangler secret put ALCHEMY_API_KEY
```

Paste your **Alchemy API key** when prompted. It is stored encrypted in Cloudflare and injected as `env.ALCHEMY_API_KEY` in the Worker.

Do **not** put the key in `wrangler.toml` or in frontend files.

---

## 4. Deploy the Worker

```bash
wrangler deploy
```

Note the **Worker URL** from the output (for example `https://ogenie-cert-checker.<your-subdomain>.workers.dev`).

---

## 5. Test the Worker endpoint

Replace `YOUR_WORKER_URL` and optionally the address:

```bash
curl "https://YOUR_WORKER_URL/api/wallet?address=0x0000000000000000000000000000000000000001"
```

You should get JSON with `wallet`, `ogenies`, `certs`, `matched`, `missingCerts`, and `missingOgenies`.

For a quick browser test, open the same URL (with a real wallet that holds NFTs) in the address bar.

---

## 6. Worker URL in `public/app.js`

Open `public/app.js` and set **`WORKER_ORIGIN`** to your deployed Worker **origin** (no path, no trailing slash):

```javascript
const WORKER_ORIGIN = "https://ogenie-cert-checker.your-subdomain.workers.dev";
```

Save the file. The script picks the API base automatically:

- When the page is opened on **that same** `workers.dev` host, it uses **relative** URLs (`/api/wallet?...`).
- On **localhost** (VS Code Live Server, etc.) or **GitHub Pages**, it calls **`WORKER_ORIGIN`** so the API still hits Cloudflare.

---

## 7. Host the frontend (optional)

After `[assets]` is deployed, **you do not need a separate host** for the UI: the Worker URL serves `index.html` at `/`.

If you still use **GitHub Pages** or another static host, upload the **contents** of `public/` and keep **`WORKER_ORIGIN`** in `app.js` pointing at your Worker.

---

## Local development

**Worker + static (recommended):**

```bash
wrangler dev
```

Wrangler prints a local URL (often `http://127.0.0.1:8787`). Open it in a browser — static files and `/api/*` should work together. Use a **`.dev.vars`** file next to `wrangler.toml` (do not commit real keys):

```
ALCHEMY_API_KEY=your_key_here
```

**Frontend only (Live Server):**

1. In VS Code, open **“Open with Live Server”** on `public/index.html`, or run:
   ```bash
   cd public && python3 -m http.server 8080
   ```
2. Open `http://localhost:8080` (or the port Live Server uses).  
   The app will call **`WORKER_ORIGIN`** for `/api/...` (see `public/app.js`).

**Alchemy**

1. [Dashboard](https://dashboard.alchemy.com/) → create an app → **Ethereum Mainnet**.
2. Copy the **API Key** (not the URL). Use the **NFT** endpoints — the key is the same as for the node API.
3. Put it in **`wrangler secret put ALCHEMY_API_KEY`** (see above) or in `.dev.vars` for local dev.

**Cloudflare**

1. `wrangler login` once per machine.
2. `wrangler secret put ALCHEMY_API_KEY` whenever you rotate the key.
3. `wrangler deploy` after changing `wrangler.toml`, `src/index.js`, or `public/*`.

---

## API shape

`GET /api/wallet?address=0x...`

Returns JSON:

```json
{
  "wallet": "0x...",
  "ogenies": [12, 287],
  "certs": [287],
  "matched": [287],
  "missingCerts": [
    {
      "tokenId": 12,
      "counterpartOwner": "0xabc...",
      "opensea": "https://opensea.io/0xabc..."
    }
  ],
  "missingOgenies": []
}
```

Very large token IDs may appear as **decimal strings** instead of numbers so values are not rounded by JSON.

---

## License

Use and modify freely for your own deployment.
