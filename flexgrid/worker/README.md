# Legacy Worker folder

**Do not add Worker code here.**

The production Cloudflare Worker is at the FlexGrid project root:

```text
flexgrid/worker.js
```

Deploy from `flexgrid/`:

```bash
npm run deploy
```

Configure secrets via Wrangler (never commit keys):

```bash
npx wrangler secret put ALCHEMY_API_KEY
npx wrangler secret put MORALIS_API_KEY
npx wrangler secret put HELIUS_API_KEY
```

See [docs/FLEX_GRID_SETUP.md](../docs/FLEX_GRID_SETUP.md) and [docs/SECURITY.md](../docs/SECURITY.md).
