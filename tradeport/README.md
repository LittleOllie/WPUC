# TradePort by LO Labs

Frontend prototype — curated NFT community trade + discovery hub.

**Mock data only.** No wallet, Firebase, APIs, or backend.

## Run locally

```bash
cd tradeport
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Routes

| Path | Page |
|------|------|
| `/` | Home |
| `/collections` | All communities |
| `/collection/:id` | Community hub (themed) |
| `/trades` | Browse listings |
| `/join` | Join community flow |
| `/create` | Create trade (mock) |
| `/listing/:id` | Listing detail |
| `/profile` | Mock profile |
| `/about` | Safety & about |

## Collection logos

Assets live at:

- `public/assets/collections/ddg/DDGLogo.png`
- `public/assets/collections/longlost/LLLogo.png`
- `public/assets/collections/quirkies/QuirkiesLogo.png`

Little Ollie / LO Labs brand mark (not used in UI yet): `public/assets/brand/LOLogo.png`

Missing collection logos show themed gradient placeholders automatically.
