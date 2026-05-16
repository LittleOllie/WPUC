/**
 * BidSniper — frontend (vanilla JS)
 */
(function () {
  "use strict";

  var config = window.BIDSNIPER_CONFIG || {};
  var API_BASE = (config.API_BASE_URL || "").replace(/\/$/, "");

  var $ = function (id) {
    return document.getElementById(id);
  };

  var collectionInput = $("collectionInput");
  var collectionPicker = $("collectionPicker");
  var scanAmount = $("scanAmount");
  var scanAmountOut = $("scanAmountOut");
  var scanBtn = $("scanBtn");
  var statusHint = $("statusHint");
  var loadingPanel = $("loadingPanel");
  var loadingText = $("loadingText");
  var loadingSub = $("loadingSub");
  var resultsPanel = $("resultsPanel");
  var resultsTitle = $("resultsTitle");
  var resultsMeta = $("resultsMeta");
  var resultsGrid = $("resultsGrid");
  var emptyPanel = $("emptyPanel");
  var emptyTitle = $("emptyTitle");
  var emptyText = $("emptyText");

  var selectedChain = "eth";
  var abortController = null;

  function setHint(msg, type) {
    statusHint.textContent = msg || "";
    statusHint.classList.remove("is-error", "is-ok");
    if (type) statusHint.classList.add(type === "error" ? "is-error" : "is-ok");
  }

  function setScanning(on) {
    scanBtn.disabled = on;
    collectionInput.disabled = on;
    if (collectionPicker) collectionPicker.disabled = on;
    scanAmount.disabled = on;
    document.querySelectorAll(".bs-chip").forEach(function (btn) {
      btn.disabled = on;
    });
    loadingPanel.classList.toggle("is-hidden", !on);
    loadingPanel.setAttribute("aria-busy", on ? "true" : "false");
  }

  function showEmpty(title, text) {
    emptyTitle.textContent = title;
    emptyText.textContent = text;
    emptyPanel.classList.remove("is-hidden");
    resultsPanel.hidden = true;
  }

  function hideEmpty() {
    emptyPanel.classList.add("is-hidden");
  }

  function formatEth(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return "—";
    if (x >= 1) return x.toFixed(3) + " ETH";
    if (x >= 0.01) return x.toFixed(4) + " ETH";
    return x.toFixed(5) + " ETH";
  }

  function formatPct(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return "";
    return (x >= 0 ? "+" : "") + x.toFixed(1) + "%";
  }

  function skeletonCards(count) {
    resultsGrid.innerHTML = "";
    for (var i = 0; i < count; i++) {
      var el = document.createElement("article");
      el.className = "bs-skeleton-card";
      el.innerHTML =
        '<div class="bs-skeleton-card__img"></div>' +
        '<div class="bs-skeleton-card__lines">' +
        '<div class="bs-skeleton-card__line"></div>' +
        '<div class="bs-skeleton-card__line bs-skeleton-card__line--short"></div>' +
        '<div class="bs-skeleton-card__line"></div>' +
        "</div>";
      resultsGrid.appendChild(el);
    }
  }

  function buildNftCard(item, index) {
    var card = document.createElement("article");
    card.className = "bs-nft";
    card.style.animationDelay = Math.min(index * 0.04, 0.6) + "s";

    var media = document.createElement("div");
    media.className = "bs-nft__media";

    var skel = document.createElement("div");
    skel.className = "bs-nft__skeleton";
    media.appendChild(skel);

    if (item.imageUrl) {
      var img = document.createElement("img");
      img.className = "bs-nft__img";
      img.alt = "NFT #" + item.tokenId;
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 400;
      img.height = 400;
      img.addEventListener(
        "load",
        function () {
          skel.remove();
          img.classList.add("is-loaded");
        },
        { once: true }
      );
      img.addEventListener(
        "error",
        function () {
          skel.remove();
          img.remove();
        },
        { once: true }
      );
      img.src = item.imageUrl;
      media.appendChild(img);
    } else {
      skel.remove();
    }

    var body = document.createElement("div");
    body.className = "bs-nft__body";

    var idEl = document.createElement("p");
    idEl.className = "bs-nft__id";
    idEl.textContent = "#" + item.tokenId;

    body.appendChild(idEl);
    body.appendChild(row("Listed", formatEth(item.listingEth)));
    body.appendChild(row("Highest offer", formatEth(item.highestOfferEth)));

    var spread = document.createElement("p");
    spread.className = "bs-nft__spread";
    spread.textContent =
      "Spread: +" +
      formatEth(item.spreadEth).replace(" ETH", "") +
      " ETH (" +
      formatPct(item.spreadPct) +
      ")";
    body.appendChild(spread);

    if (item.marketplace) {
      var src = document.createElement("p");
      src.className = "bs-nft__source";
      src.textContent = "Listed on " + item.marketplace;
      body.appendChild(src);
    }

    var link = document.createElement("a");
    link.className = "bs-nft__link";
    link.href = item.openSeaUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on OpenSea";
    body.appendChild(link);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function row(label, value) {
    var wrap = document.createElement("div");
    wrap.className = "bs-nft__row";
    var l = document.createElement("span");
    l.className = "bs-nft__label";
    l.textContent = label;
    var v = document.createElement("span");
    v.className = "bs-nft__val";
    v.textContent = value;
    wrap.appendChild(l);
    wrap.appendChild(v);
    return wrap;
  }

  function renderResultsProgressive(opportunities) {
    resultsGrid.innerHTML = "";
    hideEmpty();
    resultsPanel.hidden = false;

    var batchSize = 4;
    var index = 0;

    function nextBatch() {
      var end = Math.min(index + batchSize, opportunities.length);
      for (; index < end; index++) {
        resultsGrid.appendChild(buildNftCard(opportunities[index], index));
      }
      if (index < opportunities.length) {
        requestAnimationFrame(nextBatch);
      }
    }

    requestAnimationFrame(nextBatch);
  }

  function populateCollectionPicker() {
    if (!collectionPicker || !window.BIDSNIPER_COLLECTIONS) return;
    var list = window.BIDSNIPER_COLLECTIONS.list || [];
    list.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.contract;
      opt.textContent = c.name + (c.shortName && c.shortName !== c.name ? " (" + c.shortName + ")" : "");
      opt.dataset.openSea = c.openSea || "";
      opt.dataset.chain = c.chain || "eth";
      collectionPicker.appendChild(opt);
    });
  }

  function applyPickerSelection() {
    if (!collectionPicker) return;
    var contract = (collectionPicker.value || "").trim();
    if (!contract) return;
    collectionInput.value = contract;
    var chain = collectionPicker.selectedOptions[0]?.dataset?.chain;
    if (chain === "eth" || chain === "base") {
      selectedChain = chain;
      document.querySelectorAll(".bs-chip").forEach(function (btn) {
        var active = (btn.getAttribute("data-chain") || "") === chain;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    setHint("");
  }

  function syncPickerFromInput() {
    if (!collectionPicker || !window.BIDSNIPER_COLLECTIONS) return;
    var raw = (collectionInput.value || "").trim();
    if (!raw) {
      collectionPicker.value = "";
      return;
    }
    var match = window.BIDSNIPER_COLLECTIONS.getByContract(raw);
    if (match) {
      collectionPicker.value = match.contract;
      return;
    }
    try {
      var url = new URL(raw);
      if (/opensea\.io/i.test(url.hostname)) {
        var parts = url.pathname.split("/").filter(Boolean);
        if (parts[0] === "collection" && parts[1]) {
          var slug = decodeURIComponent(parts[1]).toLowerCase();
          var bySlug = window.BIDSNIPER_COLLECTIONS.list.find(function (c) {
            return (c.openSea || "").toLowerCase().indexOf("/collection/" + slug) !== -1;
          });
          if (bySlug) {
            collectionPicker.value = bySlug.contract;
            return;
          }
        }
      }
    } catch (e) {
      /* not a URL */
    }
    collectionPicker.value = "";
  }

  function bindChips() {
    document.querySelectorAll(".bs-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (scanBtn.disabled) return;
        selectedChain = btn.getAttribute("data-chain") || "eth";
        document.querySelectorAll(".bs-chip").forEach(function (b) {
          var active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", active ? "true" : "false");
        });
      });
    });
  }

  scanAmount.addEventListener("input", function () {
    scanAmountOut.textContent = scanAmount.value;
  });

  async function runScan() {
    var collection = (collectionInput.value || "").trim();
    if (!collection) {
      setHint("Paste a collection URL or contract address.", "error");
      collectionInput.focus();
      return;
    }

    if (!API_BASE) {
      setHint("API not configured — check config.js", "error");
      return;
    }

    if (abortController) abortController.abort();
    abortController = new AbortController();

    var amount = Math.max(10, Math.min(200, parseInt(scanAmount.value, 10) || 50));

    setHint("");
    hideEmpty();
    resultsPanel.hidden = false;
    resultsTitle.textContent = "Scanning…";
    resultsMeta.textContent = "";
    setScanning(true);
    loadingText.textContent = "Scanning " + amount + " lowest listings…";
    loadingSub.textContent = "Fetching offers from Reservoir";
    skeletonCards(Math.min(6, Math.ceil(amount / 10)));

    try {
      var res = await fetch(API_BASE + "/api/bidsniper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: collection,
          chain: selectedChain,
          scanAmount: amount,
        }),
        signal: abortController.signal,
      });

      var data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok || data.ok === false) {
        var errMsg =
          data.error ||
          data.message ||
          (res.status === 429
            ? "Rate limited — try again in a minute."
            : "Scan failed. Check your connection.");
        setHint(errMsg, "error");
        showEmpty("Scan issue", errMsg);
        return;
      }

      var name = (data.collection && data.collection.name) || "Collection";
      var scanned = data.scanned || 0;
      var opps = data.opportunities || [];

      if (!opps.length) {
        var msg =
          data.message || "No listings below active offers in this scan range.";
        setHint(msg, "ok");
        resultsTitle.textContent = "No opportunities";
        resultsMeta.textContent =
          name + " · scanned " + scanned + " lowest listings";
        resultsGrid.innerHTML = "";
        resultsPanel.hidden = false;
        showEmpty("All clear (for now)", msg);
        return;
      }

      setHint("Found " + opps.length + " opportunit" + (opps.length === 1 ? "y" : "ies") + "!", "ok");
      resultsTitle.textContent = opps.length + " opportunit" + (opps.length === 1 ? "y" : "ies");
      resultsMeta.textContent =
        name + " · scanned " + scanned + " listings on " + (data.chain || selectedChain);

      renderResultsProgressive(opps);
    } catch (e) {
      if (e && e.name === "AbortError") return;
      setHint("Network error — try again.", "error");
      showEmpty("Connection hiccup", "Could not reach the scan API. Try again shortly.");
    } finally {
      setScanning(false);
    }
  }

  scanBtn.addEventListener("click", runScan);
  collectionInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") runScan();
  });
  collectionInput.addEventListener("input", syncPickerFromInput);
  if (collectionPicker) {
    collectionPicker.addEventListener("change", applyPickerSelection);
  }

  populateCollectionPicker();
  bindChips();
  showEmpty("No snipes yet", "Run a scan to discover listings below active offers.");
})();
