/**
 * Web3House — API configuration
 * Uses the same Cloudflare Worker as TradePort (Alchemy proxy, keys stay server-side).
 *
 * Local worker: cd tradeport/tradeport-worker && npm run dev  → http://127.0.0.1:8787
 * Override below for local testing if needed.
 */
(function (global) {
  "use strict";

  var TRADEPORT_WORKER_PROD = "https://tradeport-worker.hermanft-eth.workers.dev";

  global.WEB3HOUSE_CONFIG = {
    /** Cloudflare Worker base URL (no trailing slash) */
    API_BASE_URL: TRADEPORT_WORKER_PROD,
  };
})(window);
