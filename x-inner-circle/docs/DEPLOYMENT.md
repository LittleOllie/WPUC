# X Inner Circle — deployment modes

This app supports **two deployments** from the same codebase:

| Deployment | Host | Analysis | Avatars |
|------------|------|----------|---------|
| **Static mock** | `littleollielabs.com/x-inner-circle/` | Browser mock data | Initials only |
| **Live server** | Vercel (Next.js) | `POST /api/analyse` → X API v2 | `/api/avatar` proxy |

---

## 1. Static mock (current site fallback)

Use this for the main Little Ollie Labs static site. No server, no X token, no API cost.

```bash
cd x-inner-circle
npm install
npm run publish
```

What `publish` does:

1. Temporarily moves `src/app/api/` aside
2. Builds with `output: 'export'`, `basePath: /x-inner-circle`
3. Sets `NEXT_PUBLIC_USE_CLIENT_MOCK=true`
4. Copies `index.html`, `_next/`, `privacy/` into the app folder for static hosting
5. Restores API routes

Deploy the `x-inner-circle/` folder with the main site. The NFT Tools Lab link (`links/index.html`) already points to `../x-inner-circle/index.html`.

**Verify:**

```bash
npm test && npm run typecheck
npm run publish
# open index.html locally or deploy to static host
```

---

## 2. Live server on Vercel

### Create the project

1. Import the repo in [Vercel](https://vercel.com/new)
2. Set **Root Directory** to `x-inner-circle`
3. Framework preset: **Next.js** (auto-detected)
4. Build command: `npm run build` (default)
5. Do **not** set `NEXT_OUTPUT_EXPORT`

### Environment variables (Production)

Copy from `.env.example.live` and adjust:

| Variable | Live value | Notes |
|----------|------------|-------|
| `ENABLE_MOCK_MODE` | `false` | Server uses real analysis path |
| `ENABLE_LIVE_X_API` | `true` | Enables X API client |
| `X_BEARER_TOKEN` | *(secret)* | X Developer app Bearer Token — **server only** |
| `NEXT_PUBLIC_USE_CLIENT_MOCK` | `false` or unset | Client calls `/api/analyse` |
| `NEXT_PUBLIC_BASE_PATH` | *(empty)* | Vercel serves at project root |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Absolute avatar URLs for PNG export |

### Safe low-limit testing (recommended first)

Start with tight caps to validate live mode cheaply:

```env
X_MAX_POSTS_PER_SCAN=10
X_MAX_MENTIONS_PER_SCAN=10
X_MAX_PROFILE_LOOKUPS_PER_SCAN=10
X_MAX_PAGINATION_REQUESTS_PER_SCAN=2
X_MAX_API_REQUESTS_PER_SCAN=8
X_ANALYSIS_DAYS=30
```

Increase gradually after confirming auth, avatars, and scoring.

### Verify after deploy

```bash
curl https://your-app.vercel.app/api/health
# → { "ok": true, "mode": "live", "liveConfigured": true, "deployment": "server-live", ... }

curl -X POST https://your-app.vercel.app/api/analyse \
  -H "Content-Type: application/json" \
  -d '{"input":"@public_username"}'
```

Check `data.usage` in the response for request counts. If limits were hit, `data.limitations` includes the stop reason.

### Avatars on live server

Live SVGs use `/api/avatar?url=...` (see `getAvatarProxyBase()`). The proxy:

- Allows only `pbs.twimg.com`, `abs.twimg.com`, `pbs-x.twimg.com`
- Upgrades `_normal` URLs to `_400x400`
- Sets CORS headers for PNG export

---

## 3. Local development

### Mock (default)

```bash
cp .env.example .env.local
npm run dev
```

### Live X API locally

```bash
cp .env.example.live .env.local
# add X_BEARER_TOKEN
npm run dev
```

Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 4. Switching between modes

| Goal | Action |
|------|--------|
| Ship demo to static site | `npm run publish` → commit `index.html`, `_next/`, `privacy/` |
| Enable live analysis | Deploy to Vercel with live env vars; point users to Vercel URL |
| Roll back to mock on server | Set `ENABLE_MOCK_MODE=true`, `ENABLE_LIVE_X_API=false` in Vercel, redeploy |
| Hub link stays on static mock | No change — static path remains the free demo |
| Optional: link hub to live app | Update `links/index.html` to Vercel URL when ready |

---

## 5. Budget guards

Per-scan limits (env-driven, see `src/lib/analysis-limits.ts` + `src/lib/security/scan-budget.ts`):

- `X_MAX_API_REQUESTS_PER_SCAN` — hard stop on total X HTTP calls
- `X_MAX_PAGINATION_REQUESTS_PER_SCAN` — caps timeline pagination
- `X_MAX_POSTS_PER_SCAN` / `X_MAX_MENTIONS_PER_SCAN` — caps posts/mentions retrieved
- `X_MAX_PROFILE_LOOKUPS_PER_SCAN` — caps profile fetches

IP/username rate limits remain in `src/lib/config.ts` (`RATE_LIMIT_CONFIG`).

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails on Vercel with token error | Should not happen — token is validated at analysis time. Check for custom build scripts setting live mode without token. |
| `liveConfigured: false` in health | Add `X_BEARER_TOKEN` in Vercel env, redeploy |
| `X_AUTH_ERROR` on analyse | Token missing, revoked, or app lacks v2 permissions |
| `X_BUDGET_LIMIT_REACHED` | Lower traffic or raise limits carefully |
| Broken avatars in PNG | Set `NEXT_PUBLIC_APP_URL` to your Vercel domain |
| Static site shows mock only | Expected — static export cannot run API routes |
