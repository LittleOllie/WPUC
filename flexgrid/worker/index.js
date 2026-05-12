/**
 * Legacy entry — not used for production deploy.
 * `wrangler.toml` points `main` at `../worker.js` (full Alchemy + /img proxy + contract-metadata).
 */

export { default } from "../worker.js";
