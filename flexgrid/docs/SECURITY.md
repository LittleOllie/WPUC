# FlexGrid security

## Secret management

- Production keys: Cloudflare Worker secrets (`env.ALCHEMY_API_KEY`, `MORALIS_API_KEY`, `HELIUS_API_KEY`).
- Local dev: `flexgrid/.dev.vars` (gitignored).
- Browser receives only `{ workerUrl }` from `/api/config/flex-grid`.

**Rotate manually** any API key that ever appeared in committed source (including removed legacy files). Editing files does not remove secrets from git history.

## Legacy worker folder

`flexgrid/worker/` contains **no executable Worker code** — only README pointing to `../worker.js`. Previously committed keys in deleted files must still be rotated.

## Rate limiting

Implemented in `worker/rateLimit.js`:

- **API routes** (`/api/nfts`, `/api/solana-nfts`, metadata): default **90 requests / minute / IP**
- **`/img` proxy**: default **240 requests / minute / IP**
- Response: HTTP **429** JSON + **`Retry-After`** header
- CORS headers preserved

### Limitations

Limits are stored in **Worker isolate memory**. They are not globally authoritative across PoPs or cold starts. Use Cloudflare WAF / rate limiting rules for stronger protection if needed.

Tune via Worker environment variables (see FLEX_GRID_SETUP.md).

## CORS

Worker uses `Access-Control-Allow-Origin: *` so the public static site can call the API. This allows third-party sites to consume your Worker quota — rate limits mitigate abuse.

## Content Security Policy

`site/index.html` CSP allows:

- `'unsafe-inline'` — required for the small path-normalisation script in `<head>` (could be moved to external file in a future pass)
- `img-src https:` — required for NFT images from many CDNs
- `connect-src` — Worker origin + localhost Wrangler

No `unsafe-eval`.

## Reporting

Email security concerns to Littleollienft@gmail.com with subject **FlexGrid security**.
