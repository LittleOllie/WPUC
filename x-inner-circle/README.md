# X Inner Circle

A mobile-first Next.js app that analyses **public X activity** and generates a shareable concentric-circle image estimating interaction closeness.

> **Important:** Results are based on recent public X interactions. They do not represent real-world friendships, private relationships, or direct messages.

## What it does

1. Accepts an X username or profile URL
2. Retrieves a limited sample of public posts and mentions (live mode)
3. Scores interaction patterns (replies, mentions, quotes, reciprocity, recency)
4. Places accounts into four rings: Inner Circle, Besties, Good Friends, Community Friends
5. Renders an SVG visual and lets users download PNG / high-res PNG

## Limitations

- Public data only — no DMs, passwords, or private accounts
- Sample-based — scan limits apply (see `src/lib/config.ts`)
- Estimates interaction closeness, not friendship
- In-memory cache and rate limits (single-instance MVP)

## Local installation

```bash
cd x-inner-circle
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

**Two modes:** static mock on `littleollielabs.com/x-inner-circle/` and live server on Vercel.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full switch guide, env vars, and verification steps.

Quick reference:

| Mode | Command / host | Env |
|------|----------------|-----|
| Static mock | `npm run publish` → main site | `NEXT_PUBLIC_USE_CLIENT_MOCK=true` (set by publish script) |
| Live server | Vercel, root dir `x-inner-circle` | Copy `.env.example.live`, add `X_BEARER_TOKEN` |

## Environment setup

Copy `.env.example` to `.env.local`:

| Variable | Description |
|----------|-------------|
| `X_BEARER_TOKEN` | X API v2 Bearer Token (server only) |
| `X_API_BASE_URL` | Default `https://api.x.com/2` |
| `X_MAX_POSTS_PER_SCAN` | Max posts retrieved per analysis |
| `X_MAX_MENTIONS_PER_SCAN` | Max mentions retrieved per analysis |
| `X_MAX_PROFILE_LOOKUPS_PER_SCAN` | Max profile lookups per analysis |
| `X_MAX_PAGINATION_REQUESTS_PER_SCAN` | Max paginated timeline requests |
| `X_MAX_API_REQUESTS_PER_SCAN` | Hard cap on X HTTP calls per scan |
| `X_ANALYSIS_DAYS` | Recency window for scoring |
| `ENABLE_MOCK_MODE` | `true` = use mock data |
| `ENABLE_LIVE_X_API` | `true` = call live X API (requires token) |
| `NEXT_PUBLIC_APP_URL` | Public app URL for avatar proxy in PNG export (Vercel) |

**Never** use `NEXT_PUBLIC_` for secrets.

## Mock mode (default)

```env
ENABLE_MOCK_MODE=true
ENABLE_LIVE_X_API=false
```

Works without X credentials. Full UI, scoring, SVG, PNG export, and explanations.

## Live X API mode

1. Create an X Developer app with v2 access (user lookup, tweets, mentions)
2. Generate a Bearer Token
3. Configure:

```env
ENABLE_MOCK_MODE=false
ENABLE_LIVE_X_API=true
X_BEARER_TOKEN=your_token_here
```

4. Restart the dev server

Live mode validates the Bearer Token when an analysis runs (not at build time). Use `/api/health` to confirm `liveConfigured: true`.

## Deployment (Vercel)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Summary:

1. Vercel project with **Root Directory** = `x-inner-circle`
2. Copy `.env.example.live` → Vercel env, add `X_BEARER_TOKEN`
3. Deploy — Route Handlers run on the server automatically
4. Start with low scan limits; increase after testing

For production, replace in-memory cache/rate limits with Redis (Upstash).

## API cost controls

Tune via env vars (see `.env.example`) or defaults in `src/lib/analysis-limits.ts`:

- `X_MAX_POSTS_PER_SCAN`
- `X_MAX_MENTIONS_PER_SCAN`
- `X_MAX_PROFILE_LOOKUPS_PER_SCAN`
- `X_MAX_PAGINATION_REQUESTS_PER_SCAN`
- `X_MAX_API_REQUESTS_PER_SCAN`

The API returns a usage summary (requests, posts, mentions, profiles) — not dollar estimates unless you add pricing config.

## Scoring formula

Weights live in `src/lib/config.ts` (`SCORING_WEIGHTS`, `RECIPROCITY_MULTIPLIERS`, `RECENCY_BUCKETS`).

Base points × recency decay × reciprocity multiplier + conversation/consistency bonuses − celebrity one-way penalty + diminishing returns cap.

Scoring version: `SCORING_VERSION` in `config.ts` (included in cache keys).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Auth error in live mode | Check Bearer Token and app permissions |
| Rate limited | Wait — IP/username cooldowns apply |
| Empty rings | Not enough public interaction data |
| Avatar missing in PNG | Proxy blocked — initials fallback used |

## Privacy

See `/privacy` in the app. Raw posts are not permanently stored. Results may be cached ~24 hours.

## Future upgrades

- OAuth user-context tokens
- Redis cache + distributed rate limiting
- Optional database for scan history

## Scripts

```bash
npm run dev        # development
npm run build      # production build (Vercel)
npm run publish    # static mock export for littleollielabs.com
npm run start      # production server
npm test           # vitest
npm run typecheck  # tsc
npm run lint       # eslint
```
