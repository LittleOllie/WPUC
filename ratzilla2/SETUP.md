# BlackWater Infection — GitHub Pages deploy

Live site: **https://blackwater-labs.com/**

Custom domain via `CNAME` → `blackwater-labs.com`. Production build uses base path `/`.

## Deploy steps (every time you update)

```bash
cd ratzilla2
npm run publish
```

Then **commit and push** these files to the **root** of your GitHub Pages repo:

- `index.html`
- `404.html`
- `CNAME`
- `assets/` (whole folder — includes hashed `.js` / `.css` **and** images/video)

Do **not** push `src/` or `index.vite.html` (dev only).

## Subpath deploy (legacy)

If hosting under a subfolder (e.g. `/blackwaterinfection/`):

```bash
VITE_BASE_PATH=/blackwaterinfection/ npm run publish
```

## Dev vs production

| File | Purpose |
|------|---------|
| `index.vite.html` | Local dev only (`npm run dev`) |
| `index.html` | Production — created by `npm run publish` |
| `src/` | Source code — not needed on GitHub Pages |

## SPA routes

`404.html` is a copy of `index.html` so `/infection` works after refresh on GitHub Pages.

## X share

Tap **DOWNLOAD INFECTED IMAGE**, then **REPORT TO X** — opens X directly (website on desktop, X app on phone) with your message pre-filled. Attach the downloaded image in your post, then publish.
