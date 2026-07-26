# FlexGrid engineering status

**Updated:** 2026-07-21

## Recent improvements

- Removed legacy Worker code with hardcoded API keys (`flexgrid/worker/worker.js` deleted)
- Production Worker secrets via Cloudflare env only
- In-Worker rate limiting (`worker/rateLimit.js`) with 429 + Retry-After
- Frontend modularisation started (`core/`, `ui/`, `wallets/`, `wizard/`, `export/`)
- User-facing toast notifications
- Disclaimer dismiss per browser session (`sessionStorage`)
- esbuild production bundle → `site/dist/app.js`
- WebP image variants + lazy GIF vendor loading
- Vitest unit tests + documentation in `docs/`

## Known limitations

- `app.js` still coordinates most grid/export logic (~8.5k lines) — further module splits planned
- Worker rate limits are per-isolate, not global
- CSP still allows `'unsafe-inline'` for the head path-normalisation script

## Manual key rotation

If any Alchemy/Moralis/Helius key was ever committed, rotate it in the provider dashboard regardless of file deletion.

See [docs/SECURITY.md](docs/SECURITY.md).
