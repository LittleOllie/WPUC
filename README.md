# Cert Checker (OGENIE × CERT)

**This file is developer documentation for GitHub.** The **web app** is **`index.html`** in this repo (and `public/index.html`).

| What you want | Where to go |
|---------------|-------------|
| **Use the app** | Open **`index.html`** after deploy, or use your **Cloudflare Worker URL** after `wrangler deploy` (serves `public/` + `/api/*`). |
| **Setup, API, hosting** | **[DEVELOPMENT.md](DEVELOPMENT.md)** |

### If `https://yoursite.com/OGT/` shows this README instead of the app

Your host is serving **`README.md`** (or a Markdown page) as the default page, and **`index.html` is not** what gets loaded for `/OGT/`.

**Fix:** In your hosting control panel (WordPress, cPanel, Cloudflare Pages, GitHub Pages, etc.):

1. Ensure **`index.html`** from this repo is deployed to that folder (same level as this README).
2. Set the **directory index** / default document to **`index.html`** before **`README.md`** (or remove README from the published folder).
3. Or publish **only** the **`public/`** folder contents to the URL and use **`public/index.html`** as the entry.

After that, visiting `/OGT/` should load the Cert Checker UI, not this text.
