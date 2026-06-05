# RATZILLA2 — deploy to GitHub / littleollielabs.com

## The `main.tsx` 404 error

Your live site is serving the **dev** HTML file, which contains:

```html
<script type="module" src="/src/main.tsx"></script>
```

Browsers cannot run that on GitHub. You must deploy the **built** files instead.

## Deploy steps (every time you update)

```bash
cd ratzilla2
npm run publish
```

Then **commit and push** these files (not `src/` or `index.vite.html`):

- `ratzilla2/index.html`
- `ratzilla2/404.html`
- `ratzilla2/assets/` (whole folder)

Open: **https://littleollielabs.com/ratzilla2/** (must include `/ratzilla2/`)

## Dev vs production files

| File | Purpose |
|------|---------|
| `index.vite.html` | Local dev only (`npm run dev`) |
| `index.html` | **Production** — created by `npm run publish` |
| `src/` | Source code — not needed on the server |

## CSP / `eval` warning in DevTools

If you see **"Content Security Policy blocks eval"** with `lockdown-install.js`, that comes from a **browser extension** (e.g. MetaMask), not from RATZILLA2. The production build does not use `eval`. You can ignore it, or test in a private/incognito window with extensions disabled.
