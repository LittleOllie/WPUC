/**
 * Web3House API client — mirrors tradeport/src/lib/api.js (vanilla JS)
 */
(function (global) {
  "use strict";

  function getBase() {
    var cfg = global.WEB3HOUSE_CONFIG || {};
    return String(cfg.API_BASE_URL || "").replace(/\/$/, "");
  }

  function apiUrl(path) {
    var p = path.charAt(0) === "/" ? path : "/" + path;
    var base = getBase();
    if (!base) {
      console.error(
        "[Web3House] Missing API_BASE_URL in config.js — NFT art cannot load. Set TRADEPORT_WORKER_PROD."
      );
      return "";
    }
    return base + p;
  }

  function fetchCollectionSamples(contract, count) {
    var url = apiUrl(
      "/api/collection-samples?" +
        new URLSearchParams({
          contract: contract,
          count: String(count || 3),
        }).toString()
    );
    if (!url) {
      return Promise.reject(new Error("Web3House API not configured"));
    }
    return fetch(url)
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!res.ok) {
            throw new Error(data.error || "Failed to load collection samples (" + res.status + ")");
          }
          return data;
        });
      });
  }

  function checkApiHealth() {
    return fetch(apiUrl("/api/health")).then(function (res) {
      if (!res.ok) throw new Error("API " + res.status);
      return res.json();
    });
  }

  function proxiedImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    var u = rawUrl.trim();
    if (!u.startsWith("http")) return u;
    return apiUrl("/api/img?url=" + encodeURIComponent(u));
  }

  var DIRECT_IMAGE_HOSTS = [
    "alchemy.com",
    "ipfs.io",
    "cloudflare-ipfs.com",
    "nftstorage.link",
    "w3s.link",
    "dweb.link",
    "pinata.cloud",
    "arweave.net",
    "amazonaws.com",
    "quirkies-images.s3.ap-southeast-2.amazonaws.com",
    "googleusercontent.com",
  ];

  function displayImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    var u = rawUrl.trim();
    if (u.startsWith("ipfs://")) {
      u = "https://nftstorage.link/ipfs/" + u.slice(7).replace(/^ipfs\//, "");
    } else if (u.startsWith("ar://")) {
      u = "https://arweave.net/" + u.slice(5);
    }
    if (!u.startsWith("http")) return u;
    /* Always proxy on live site — avoids hotlink/CORS blocks from CDNs */
    var proxied = proxiedImageUrl(u);
    if (proxied) return proxied;
    try {
      var host = new URL(u).hostname;
      for (var i = 0; i < DIRECT_IMAGE_HOSTS.length; i++) {
        if (host.indexOf(DIRECT_IMAGE_HOSTS[i]) !== -1) return u;
      }
    } catch (e) {
      /* fall through */
    }
    return u;
  }

  global.Web3HouseApi = {
    apiUrl: apiUrl,
    getBase: getBase,
    fetchCollectionSamples: fetchCollectionSamples,
    checkApiHealth: checkApiHealth,
    proxiedImageUrl: proxiedImageUrl,
    displayImageUrl: displayImageUrl,
  };
})(window);
