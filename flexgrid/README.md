# Flex Grid — Little Ollie NFT Grid Builder

Build beautiful NFT collages from one or multiple crypto wallets and export as PNG.

## What This App Does

- Load NFTs from wallet addresses via Alchemy
- Group by collection and select which to include
- Build a customizable grid (3×3 to 10×10 or custom)
- Export as PNG with white background and watermark

## Run Locally

```bash
# From project root
python -m http.server 8000
# Or: npx serve .
```

Then open http://localhost:8000

## Config

Configuration lives in `src/js/config.js`:

- **Development:** `FRONTEND_CONFIG.enabled = true` uses the local API key (for testing only).
- **Production:** Use a backend endpoint or Cloudflare Worker to serve config securely. See `docs/FLEX_GRID_SETUP.md`.

## Project Structure

```
├── index.html              # Entry point
├── src/
│   ├── js/
│   │   ├── app.js          # Core logic
│   │   └── config.js       # Config loader
│   ├── styles/
│   │   └── style.css       # Styles
│   └── assets/
│       └── images/         # dad.png, header.png, LO.png, tile.png, pblo.png
├── docs/                   # Setup guides, notes, worker docs
└── README.md
```

## Deployment

1. Deploy the Worker first (from project root):
   ```bash
   npx wrangler deploy
   npx wrangler secret put ALCHEMY_API_KEY   # Paste your Alchemy API key when prompted
   ```
2. Deploy the frontend to any static host (GitHub Pages, Netlify, Vercel, etc.).
3. Ensure `index.html` is served at the root.
4. CSP in `index.html` allows required external domains.

## Docs

- `docs/FLEX_GRID_SETUP.md` — Setup and config
- `docs/WATERMARK_SYSTEM.md` — Watermark behavior
- Other docs in `docs/` for worker, Alchemy, etc.

---

Little Ollie Studio
