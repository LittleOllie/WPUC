/**
 * Random NFT samples per collection — uses TradePort Worker + image fallbacks
 */
(function (global) {
  "use strict";

  var Api = global.Web3HouseApi;
  var Img = global.Web3HouseNftImages;
  if (!Api || !Img) return;

  var CACHE_TTL_MS = 5 * 60 * 1000;
  var cache = {};

  function cacheKey(contract, count) {
    return contract.toLowerCase() + ":" + count;
  }

  function mapNft(nft, community) {
    var candidates = Img.buildNftImageCandidates({
      collectionId: community.collectionId,
      tokenId: nft.tokenId,
      imageUrl: nft.imageUrl,
    });
    return {
      tokenId: nft.tokenId,
      name: nft.name || "#" + nft.tokenId,
      imageUrl: candidates[0] || null,
      imageCandidates: candidates,
    };
  }

  /**
   * @param {object} community — needs contract, collectionId
   * @param {number} count
   * @returns {Promise<Array>}
   */
  function fetchSamples(community, count) {
    if (!community || !community.contract) {
      return Promise.resolve([]);
    }

    var contract = community.contract.toLowerCase();
    var key = cacheKey(contract, count);
    var hit = cache[key];
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return Promise.resolve(hit.items);
    }

    return Api.fetchCollectionSamples(contract, count)
      .then(function (data) {
        var items = (data.nfts || []).map(function (n) {
          return mapNft(n, community);
        });
        if (items.length) {
          cache[key] = { items: items, at: Date.now() };
        }
        return items;
      })
      .catch(function () {
        return [];
      });
  }

  function placeholderTiles(count, community) {
    var primary = (community.theme && community.theme.primary) || "#4c6fff";
    var bg = (community.theme && community.theme.background) || "#1a1a2e";
    var out = [];
    for (var i = 0; i < count; i++) {
      out.push({ placeholder: true, gradient: [primary, bg] });
    }
    return out;
  }

  function fillStripPlaceholders(strip) {
    strip.innerHTML =
      '<div class="community-card__nft-cell community-card__nft-cell--placeholder"></div>' +
      '<div class="community-card__nft-cell community-card__nft-cell--placeholder"></div>' +
      '<div class="community-card__nft-cell community-card__nft-cell--placeholder"></div>';
  }

  /** Mini strip on community cards (3 NFTs) */
  function hydrateCardStrip(cardEl, community) {
    var strip = cardEl.querySelector(".community-card__nft-strip");
    if (!strip) return;

    if (!community.contract) {
      fillStripPlaceholders(strip);
      return;
    }

    strip.innerHTML = '<span class="community-card__nft-loading">Loading art…</span>';

    fetchSamples(community, 3).then(function (items) {
      strip.innerHTML = "";
      if (!items.length) {
        fillStripPlaceholders(strip);
        return;
      }
      items.forEach(function (item) {
        var cell = document.createElement("div");
        cell.className = "community-card__nft-cell";
        if (item.imageUrl || (item.imageCandidates && item.imageCandidates.length)) {
          var img = Img.createNftImage({
            imageUrl: item.imageUrl,
            imageCandidates: item.imageCandidates,
            alt: item.name,
            className: "community-card__nft-img",
            loading: "lazy",
            onFailed: function () {
              cell.classList.add("community-card__nft-cell--empty");
            },
          });
          cell.appendChild(img);
        } else {
          cell.classList.add("community-card__nft-cell--empty");
        }
        strip.appendChild(cell);
      });
    });
  }

  /** Detail modal gallery (6 NFTs) */
  function loadGallery(community, gridEl, noteEl, refreshBtn) {
    if (!gridEl) return;

    var count = 6;

    if (!community.contract) {
      gridEl.innerHTML = "";
      if (noteEl) {
        noteEl.textContent =
          "Little Ollie is our studio brand — explore games and collectibles via the official links above.";
      }
      if (refreshBtn) refreshBtn.hidden = true;
      return;
    }

    if (refreshBtn) refreshBtn.hidden = false;
    if (noteEl) noteEl.textContent = "Loading random pieces from the collection…";
    gridEl.innerHTML = "";
    for (var i = 0; i < count; i++) {
      var sk = document.createElement("div");
      sk.className = "detail__gallery-tile detail__gallery-tile--loading";
      gridEl.appendChild(sk);
    }

    var bust = refreshBtn && refreshBtn.dataset.force === "1";
    if (bust) {
      delete cache[cacheKey(community.contract.toLowerCase(), count)];
      refreshBtn.dataset.force = "";
    }

    fetchSamples(community, count).then(function (items) {
      gridEl.innerHTML = "";
      if (!items.length) {
        if (noteEl) {
          noteEl.textContent =
            "Could not load art right now — visit OpenSea or the official site. (Is the TradePort API worker running?)";
        }
        return;
      }
      if (noteEl) {
        noteEl.textContent = "Random pieces from the collection — refreshes when you reopen or tap Refresh.";
      }
      items.forEach(function (item) {
        var tile = document.createElement("figure");
        tile.className = "detail__gallery-tile detail__gallery-tile--live";

        if (item.imageUrl || (item.imageCandidates && item.imageCandidates.length)) {
          var img = Img.createNftImage({
            imageUrl: item.imageUrl,
            imageCandidates: item.imageCandidates,
            alt: item.name,
            className: "detail__gallery-img",
            loading: "lazy",
            onFailed: function () {
              tile.classList.add("detail__gallery-tile--empty");
            },
          });
          tile.appendChild(img);
        } else {
          tile.classList.add("detail__gallery-tile--empty");
        }

        var cap = document.createElement("figcaption");
        cap.className = "detail__gallery-cap";
        cap.textContent = item.name;
        tile.appendChild(cap);
        gridEl.appendChild(tile);
      });
    });
  }

  /** Warm cache for all on-chain communities after hub opens */
  function prefetchAll(communities) {
    communities.forEach(function (c) {
      if (c.contract) fetchSamples(c, 3);
    });
  }

  global.Web3HouseSamples = {
    fetchSamples: fetchSamples,
    hydrateCardStrip: hydrateCardStrip,
    loadGallery: loadGallery,
    prefetchAll: prefetchAll,
    clearCache: function (contract, count) {
      delete cache[cacheKey(contract, count)];
    },
  };
})(window);
