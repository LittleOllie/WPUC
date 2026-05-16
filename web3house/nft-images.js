/**
 * NFT image URL fallbacks — mirrors tradeport/src/utils/nftImages.js
 */
(function (global) {
  "use strict";

  var Api = global.Web3HouseApi;
  if (!Api) return;

  var QUIRKIES_S3_BASE = "https://quirkies-images.s3.ap-southeast-2.amazonaws.com";
  var QUIRKLINGS_IPFS_CID = "bafybeib6rkqikdf7czbrtzjphk5k6cdi44smd5ewwc3ysihwr3g2onpwl4";

  var IPFS_GATEWAYS = [
    "https://nftstorage.link/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://w3s.link/ipfs/",
    "https://dweb.link/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.io/ipfs/",
  ];

  function dedupe(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || seen[list[i]]) continue;
      seen[list[i]] = true;
      out.push(list[i]);
    }
    return out;
  }

  function resolveRawUrl(raw) {
    if (!raw || typeof raw !== "string") return null;
    var u = raw.trim();
    if (!u) return null;
    if (u.startsWith("ipfs://")) {
      u = "https://nftstorage.link/ipfs/" + u.slice(7).replace(/^ipfs\//, "");
    } else if (u.startsWith("ar://")) {
      u = "https://arweave.net/" + u.slice(5);
    }
    return u;
  }

  function buildNftImageCandidates(opts) {
    opts = opts || {};
    var collectionId = opts.collectionId;
    var tokenId = opts.tokenId;
    var imageUrl = opts.imageUrl;
    var raw = [];
    var tid = tokenId != null ? String(tokenId).trim() : "";

    var primary = resolveRawUrl(imageUrl);
    if (primary) raw.push(primary);

    if (collectionId === "quirkies" && tid) {
      raw.push(QUIRKIES_S3_BASE + "/" + tid + ".png");
    }

    if (collectionId === "quirklings" && tid) {
      for (var g = 0; g < IPFS_GATEWAYS.length; g++) {
        raw.push(IPFS_GATEWAYS[g] + QUIRKLINGS_IPFS_CID + "/" + tid + ".png");
      }
    }

    if (primary && collectionId !== "quirklings") {
      var ipfsPath = null;
      if (primary.indexOf("ipfs://") === 0) {
        ipfsPath = primary.slice(7);
      } else {
        var m = primary.match(/\/ipfs\/([^?#]+)/i);
        if (m) ipfsPath = m[1];
      }
      if (ipfsPath) {
        for (var j = 0; j < IPFS_GATEWAYS.length; j++) {
          raw.push(IPFS_GATEWAYS[j] + ipfsPath);
        }
      }
    }

    return dedupe(
      raw.map(function (u) {
        return Api.displayImageUrl(u);
      }).filter(Boolean)
    );
  }

  /** Build <img> that cycles through imageCandidates on error */
  function createNftImage(opts) {
    opts = opts || {};
    var urls = opts.imageCandidates && opts.imageCandidates.length
      ? opts.imageCandidates.slice()
      : opts.imageUrl
        ? [opts.imageUrl]
        : [];
    var index = 0;
    var img = document.createElement("img");
    img.className = opts.className || "";
    img.alt = opts.alt || "";
    if (opts.loading) img.loading = opts.loading;

    function tryNext() {
      if (index >= urls.length) {
        if (opts.onFailed) opts.onFailed(img);
        return;
      }
      img.src = urls[index++];
    }

    img.addEventListener("error", tryNext);
    if (urls.length) tryNext();
    else if (opts.onFailed) opts.onFailed(img);

    return img;
  }

  global.Web3HouseNftImages = {
    buildNftImageCandidates: buildNftImageCandidates,
    createNftImage: createNftImage,
  };
})(window);
