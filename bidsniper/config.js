/**
 * BidSniper — API configuration (keys stay on Cloudflare Worker)
 *
 * Local: cd bidsniper/bidsniper-worker && npm run dev  → http://127.0.0.1:8790
 * Deploy: wrangler deploy — then set BIDSNIPER_WORKER_PROD below.
 */
(function (global) {
  "use strict";

  var BIDSNIPER_WORKER_PROD = "https://bidsniper-worker.hermanft-eth.workers.dev";
  var host = typeof location !== "undefined" ? location.hostname : "";
  var isLocal = host === "localhost" || host === "127.0.0.1";

  global.BIDSNIPER_CONFIG = {
    API_BASE_URL: isLocal ? "http://127.0.0.1:8790" : BIDSNIPER_WORKER_PROD,
  };
})(window);
