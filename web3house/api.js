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
    return base ? base + p : p;
  }

  function fetchCollectionSamples(contract, count) {
    var params = new URLSearchParams({
      contract: contract,
      count: String(count || 3),
    });
    return fetch(apiUrl("/api/collection-samples?" + params.toString()))
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
      u = "https://ipfs.io/ipfs/" + u.slice(7);
    }
    if (!u.startsWith("http")) return null;
    try {
      var host = new URL(u).hostname;
      for (var i = 0; i < DIRECT_IMAGE_HOSTS.length; i++) {
        if (host.indexOf(DIRECT_IMAGE_HOSTS[i]) !== -1) return u;
      }
    } catch (e) {
      /* proxy */
    }
    return proxiedImageUrl(u);
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
