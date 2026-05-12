# Flex Grid Worker (legacy folder)

The main Worker is at **project root**: `worker.js`

Deploy from project root:
```bash
npx wrangler deploy
```

Set the Alchemy API key (required):
```bash
npx wrangler secret put ALCHEMY_API_KEY
```

## Routes
- **GET /api/config/flex-grid** — Returns `{ workerUrl, network }` (no API key exposed)
- **GET /img?url=...** — Proxies images with IPFS multi-gateway fallback
