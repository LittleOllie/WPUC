# Flex Grid Cloudflare Worker

Serves config and image proxy for the Flex Grid app.

## Routes

- **GET /api/config/flex-grid** — Returns `{ alchemyApiKey, workerUrl, network }` with CORS
- **GET /img?url=...** — Proxies images with CORS

## Deploy

```bash
cd worker
npx wrangler deploy
```

Requires a Cloudflare account. The worker will deploy to your `*.workers.dev` subdomain.

## Environment

For production, store the API key in Wrangler secrets instead of hardcoding:

```bash
npx wrangler secret put ALCHEMY_API_KEY
```

Then update `index.js` to use `env.ALCHEMY_API_KEY` instead of the hardcoded value.
