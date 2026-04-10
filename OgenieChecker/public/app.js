/**
 * OGENIE × CERT Set Checker V2
 */
const WORKER_ORIGIN = "https://ogenie-cert-checker.littleollienft.workers.dev";

function getApiBase() {
  var loc = window.location;
  if (loc.protocol === "file:") return WORKER_ORIGIN;
  try {
    if (loc.hostname === new URL(WORKER_ORIGIN).hostname) return "";
  } catch (e) {
    /* ignore */
  }
  if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") {
    return WORKER_ORIGIN;
  }
  return WORKER_ORIGIN;
}

function apiUrl(pathAndQuery) {
  var base = getApiBase().replace(/\/$/, "");
  return (base ? base : "") + pathAndQuery;
}

/**
 * CERT collection uses one shared artwork for every token — use this for “missing CERT” previews
 * instead of fetching per-token metadata. Resolves correctly on the deployed Worker, localhost, or file://.
 */
function getMissingCertCounterpartImageUrl() {
  return apiUrl("/cert.png");
}

function shortAddress(addr) {
  if (!addr || typeof addr !== "string") return "—";
  var a = addr.trim();
  if (a.length < 12) return a;
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function formatTokenId(t) {
  if (t === undefined || t === null) return "—";
  return String(t);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function setStatus(el, type, message) {
  el.className = "status" + (type ? " " + type : "");
  el.textContent = message || "";
}

var WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function isValidWallet(s) {
  return typeof s === "string" && WALLET_RE.test(s.trim());
}

/**
 * Try alternate IPFS gateways if primary img fails (data-fb = JSON array of URLs).
 */
window.__nftImgErr = function (img) {
  if (!img) return;
  var raw = img.getAttribute("data-fb");
  var idx = parseInt(img.getAttribute("data-fbi") || "0", 10);
  if (raw) {
    try {
      var list = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(list) && idx < list.length) {
        img.setAttribute("data-fbi", String(idx + 1));
        img.src = list[idx];
        return;
      }
    } catch (e) {
      /* ignore */
    }
  }
  img.classList.add("is-broken");
};

function normalizeMediaUrl(u) {
  if (!u || typeof u !== "string") return null;
  var s = u.trim();
  if (!s) return null;
  if (s.indexOf("ipfs://") === 0) {
    var path = s.slice(7).replace(/^ipfs\//, "");
    return "https://ipfs.io/ipfs/" + path;
  }
  if (s.indexOf("ar://") === 0) {
    return "https://arweave.net/" + s.slice(5);
  }
  return s;
}

/** Primary URL + extra gateways for the same IPFS content */
function buildImageCandidates(raw) {
  var primary = normalizeMediaUrl(raw);
  if (!primary) return { primary: null, fallbacks: [] };
  var list = [primary];
  var pos = primary.indexOf("/ipfs/");
  if (pos !== -1) {
    var after = primary.slice(pos + 6);
    list.push("https://cloudflare-ipfs.com/ipfs/" + after);
    list.push("https://dweb.link/ipfs/" + after);
    list.push("https://w3s.link/ipfs/" + after);
  }
  var seen = {};
  var uniq = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && !seen[list[i]]) {
      seen[list[i]] = 1;
      uniq.push(list[i]);
    }
  }
  return { primary: uniq[0], fallbacks: uniq.slice(1) };
}

function thumbHtml(url, alt) {
  if (url) {
    var c = buildImageCandidates(String(url));
    if (!c.primary) {
      return (
        '<div class="nft-thumb nft-thumb--empty"><span class="nft-thumb-fallback">No image</span></div>'
      );
    }
    var fbAttr = "";
    if (c.fallbacks.length) {
      fbAttr =
        ' data-fb="' +
        escapeAttr(encodeURIComponent(JSON.stringify(c.fallbacks))) +
        '" data-fbi="0"';
    }
    return (
      '<div class="nft-thumb">' +
      '<img src="' +
      escapeAttr(c.primary) +
      '" alt="' +
      escapeAttr(alt || "NFT") +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
      fbAttr +
      ' onerror="window.__nftImgErr(this)" />' +
      '<div class="nft-thumb-fallback" aria-hidden="true">No image</div>' +
      "</div>"
    );
  }
  return (
    '<div class="nft-thumb nft-thumb--empty"><span class="nft-thumb-fallback">No image</span></div>'
  );
}

function renderWalletCardMatched(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--ok">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.imageOgenie, "OGENIE " + tid) +
    thumbHtml(item.imageCert, "CERT " + tid) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--ok">✅ Matched set</p>' +
    "</div>" +
    "</article>"
  );
}

function renderCounterpartSlot(missingLabel, openseaNft, counterpartImageUrl, altForImage) {
  var findBtn = openseaNft
    ? '<a class="nft-thumb__find" href="' +
      escapeHtml(openseaNft) +
      '" target="_blank" rel="noopener noreferrer">Find on OpenSea</a>'
    : '<span class="nft-thumb__find nft-thumb__find--disabled">Find</span>';

  var visual = "";
  if (counterpartImageUrl) {
    var c = buildImageCandidates(String(counterpartImageUrl));
    if (c.primary) {
      var fbAttr = "";
      if (c.fallbacks.length) {
        fbAttr =
          ' data-fb="' +
          escapeAttr(encodeURIComponent(JSON.stringify(c.fallbacks))) +
          '" data-fbi="0"';
      }
      visual =
        '<div class="nft-thumb__counterpart-visual">' +
        '<img class="nft-thumb__counterpart-img" src="' +
        escapeAttr(c.primary) +
        '" alt="' +
        escapeAttr(altForImage || "Counterpart NFT") +
        '" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
        fbAttr +
        ' onerror="window.__nftImgErr(this)" />' +
        '<div class="nft-thumb-fallback" aria-hidden="true">No image</div>' +
        "</div>";
    }
  }
  if (!visual) {
    visual =
      '<div class="nft-thumb__counterpart-visual nft-thumb__counterpart-visual--empty">' +
      '<span class="nft-thumb-fallback">No preview</span></div>';
  }

  return (
    '<div class="nft-thumb nft-thumb--counterpart" data-counterpart-slot tabindex="0" role="group" aria-label="' +
    escapeAttr(missingLabel) +
    '">' +
    visual +
    '<span class="nft-thumb__counterpart-label">' +
    escapeHtml(missingLabel) +
    "</span>" +
    findBtn +
    "</div>"
  );
}

function renderWalletCardMissingCert(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--warn">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.image, "OGENIE " + tid) +
    renderCounterpartSlot(
      "CERT #" + tid + " (missing)",
      item.openseaNft,
      getMissingCertCounterpartImageUrl(),
      "CERT " + tid
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--bad">❌ Missing CERT</p>' +
    '<p class="wallet-card__meta">CERT holder: <span class="mono">' +
    escapeHtml(shortAddress(item.counterpartOwner)) +
    "</span></p>" +
    "</div>" +
    "</article>"
  );
}

function renderWalletCardNoCert(item, certMaxTokenId) {
  var tid = formatTokenId(item.tokenId);
  var cap = certMaxTokenId != null ? String(certMaxTokenId) : "1000";
  return (
    '<article class="wallet-card wallet-card--nocert">' +
    '<div class="wallet-card__visuals wallet-card__visuals--single">' +
    thumbHtml(item.image, "OGENIE " + tid) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--nocert">No matching CERT</p>' +
    '<p class="wallet-card__meta">CERT exists only for token IDs 1–' +
    escapeHtml(cap) +
    ".</p>" +
    "</div>" +
    "</article>"
  );
}

function renderWalletCardExtraCert(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--info">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.image, "CERT " + tid) +
    renderCounterpartSlot(
      "OGENIE #" + tid + " (missing)",
      item.openseaNft,
      item.counterpartImage,
      "OGENIE " + tid
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--extra">🧾 Extra CERT</p>' +
    '<p class="wallet-card__meta">OGENIE holder: <span class="mono">' +
    escapeHtml(shortAddress(item.counterpartOwner)) +
    "</span></p>" +
    "</div>" +
    "</article>"
  );
}

function applyWalletFilter(container, filter) {
  var m = container.querySelector("[data-wallet-section=\"matched\"]");
  var u = container.querySelector("[data-wallet-section=\"unmatched\"]");
  var buttons = container.querySelectorAll(".filter-btn");
  for (var b = 0; b < buttons.length; b++) {
    var btn = buttons[b];
    var f = btn.getAttribute("data-filter");
    var on = f === filter;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (!m || !u) return;
  if (filter === "all") {
    m.classList.remove("hidden");
    u.classList.remove("hidden");
  } else if (filter === "matched") {
    m.classList.remove("hidden");
    u.classList.add("hidden");
  } else if (filter === "unmatched") {
    m.classList.add("hidden");
    u.classList.remove("hidden");
  }
}

function renderWalletResults(container, data) {
  var matched = data.matched || [];
  var missingCerts = data.missingCerts || [];
  var noCert = data.noCert || [];
  var missingOgenies = data.missingOgenies || [];
  var ogenies = data.ogenies || [];
  var certs = data.certs || [];
  var certMaxTokenId = data.certMaxTokenId;

  var hasAny = ogenies.length > 0 || certs.length > 0;
  var html = "";

  if (!hasAny) {
    html +=
      '<p class="empty-hint prominent">No NFTs found for this wallet in OGENIE or CERT on mainnet.</p>';
    container.innerHTML = html;
    container.classList.remove("hidden");
    return;
  }

  html +=
    '<div class="wallet-filter" role="tablist" aria-label="Show matched or unmatched">' +
    '<span class="wallet-filter-label">View:</span>' +
    '<button type="button" class="filter-btn is-active" data-filter="all" role="tab" aria-pressed="true">All</button>' +
    '<button type="button" class="filter-btn" data-filter="matched" role="tab" aria-pressed="false">Matched</button>' +
    '<button type="button" class="filter-btn" data-filter="unmatched" role="tab" aria-pressed="false">Unmatched</button>' +
    "</div>";

  html += '<div class="wallet-section-wrap" data-wallet-section="matched">';
  html += '<h3 class="section-title">Complete sets</h3><div class="wallet-grid">';
  if (matched.length === 0) {
    html +=
      '<p class="empty-hint">' +
      (hasAny
        ? "No token IDs appear in both collections."
        : "—") +
      "</p>";
  } else {
    for (var i = 0; i < matched.length; i++) {
      html += renderWalletCardMatched(matched[i]);
    }
  }
  html += "</div></div>";

  html += '<div class="wallet-section-wrap" data-wallet-section="unmatched">';
  html += '<h3 class="section-title">Extra CERTs</h3><div class="wallet-grid">';
  if (missingOgenies.length === 0) {
    html +=
      '<p class="empty-hint">None — no CERTs without a matching OGENIE.</p>';
  } else {
    for (var k = 0; k < missingOgenies.length; k++) {
      html += renderWalletCardExtraCert(missingOgenies[k]);
    }
  }
  html += "</div>";

  html += '<h3 class="section-title">Missing CERTs</h3><div class="wallet-grid">';
  if (missingCerts.length === 0) {
    if (ogenies.length === 0) {
      html +=
        '<p class="empty-hint">No OGENIEs detected — so no "missing CERT" rows. If you hold OGENIEs, they may be staked or filtered until the API returns them.</p>';
    } else if (noCert.length > 0) {
      html +=
        '<p class="empty-hint">None with a findable CERT on OpenSea — higher token IDs are listed under "No CERT for this ID".</p>';
    } else {
      html +=
        '<p class="empty-hint">None — every OGENIE here has a matching CERT.</p>';
    }
  } else {
    for (var j = 0; j < missingCerts.length; j++) {
      html += renderWalletCardMissingCert(missingCerts[j]);
    }
  }
  html += "</div>";

  html +=
    '<h3 class="section-title">No CERT for this ID</h3>' +
    '<p class="section-blurb">The OGTriple CERT collection was only minted for token IDs 1–' +
    escapeHtml(String(certMaxTokenId != null ? certMaxTokenId : 1000)) +
    ". There is no matching CERT for these OGENIEs, so OpenSea has no CERT page to open.</p>" +
    '<div class="wallet-grid">';
  if (noCert.length === 0) {
    html +=
      '<p class="empty-hint">None — no OGENIEs above the CERT token ID range (or all are paired).</p>';
  } else {
    for (var nc = 0; nc < noCert.length; nc++) {
      html += renderWalletCardNoCert(noCert[nc], certMaxTokenId);
    }
  }
  html += "</div></div>";

  container.innerHTML = html;
  container.classList.remove("hidden");

  var filterBar = container.querySelector(".wallet-filter");
  if (filterBar) {
    filterBar.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-filter]");
      if (!t || t.tagName !== "BUTTON") return;
      ev.preventDefault();
      applyWalletFilter(container, t.getAttribute("data-filter"));
    });
  }
}

function renderTokenResults(container, data) {
  var tid = formatTokenId(data.tokenId);
  var cap =
    data.certMaxTokenId != null ? String(data.certMaxTokenId) : "1000";

  if (data.noCertForId) {
    var oOnly = data.ogenie || {};
    var seaOnly = oOnly.opensea;
    var btnOnly = seaOnly
      ? '<a class="btn-secondary" href="' +
        escapeHtml(seaOnly) +
        '" target="_blank" rel="noopener noreferrer">OpenSea</a>'
      : "";
    container.innerHTML =
      '<div class="token-pair token-pair--nocert">' +
      '<article class="token-side token-side--ogenie">' +
      thumbHtml(oOnly.image, "OGENIE " + tid) +
      '<h4 class="token-side__label">OGENIE</h4>' +
      '<p class="token-side__owner mono" title="' +
      escapeAttr(oOnly.owner || "") +
      '">' +
      escapeHtml(oOnly.owner ? shortAddress(oOnly.owner) : "—") +
      "</p>" +
      btnOnly +
      "</article>" +
      '<div class="token-no-cert-pane">' +
      '<p class="token-no-cert-pane__title">No CERT for this OGENIE</p>' +
      "<p class=\"token-no-cert-pane__body\">The OGTriple CERT collection was only minted for token IDs 1–" +
      escapeHtml(cap) +
      ". This token ID has no matching CERT on-chain or on OpenSea.</p>" +
      "</div>" +
      "</div>" +
      '<p class="verdict verdict--nocert">Only OGENIE applies — there is no CERT for this ID.</p>';
    container.classList.remove("hidden");
    return;
  }

  var o = data.ogenie || {};
  var c = data.cert || {};
  var matched = !!data.matched;

  var verdict = matched
    ? '<p class="verdict verdict--ok">✅ Perfect match — same owner for OGENIE &amp; CERT.</p>'
    : '<p class="verdict verdict--bad">❌ Different owners (or one side has no owner).</p>';

  function sideCard(label, side, kind) {
    var img = side.image;
    var owner = side.owner;
    var sea = side.opensea;
    var btn = sea
      ? '<a class="btn-secondary" href="' +
        escapeHtml(sea) +
        '" target="_blank" rel="noopener noreferrer">OpenSea</a>'
      : "";
    return (
      '<article class="token-side token-side--' +
      kind +
      '">' +
      thumbHtml(img, label + " " + tid) +
      '<h4 class="token-side__label">' +
      escapeHtml(label) +
      "</h4>" +
      '<p class="token-side__owner mono" title="' +
      escapeAttr(owner || "") +
      '">' +
      escapeHtml(owner ? shortAddress(owner) : "—") +
      "</p>" +
      btn +
      "</article>"
    );
  }

  container.innerHTML =
    '<div class="token-pair">' +
    sideCard("OGENIE", o, "ogenie") +
    sideCard("CERT", c, "cert") +
    "</div>" +
    verdict;
  container.classList.remove("hidden");
}

async function checkWallet() {
  var input = document.getElementById("wallet-input");
  var btn = document.getElementById("check-wallet-btn");
  var statusEl = document.getElementById("wallet-status");
  var resultsEl = document.getElementById("wallet-results");
  var tokenResultsEl = document.getElementById("token-results");
  var tokenStatusEl = document.getElementById("token-status");

  tokenResultsEl.classList.add("hidden");
  tokenResultsEl.innerHTML = "";
  setStatus(tokenStatusEl, "", "");

  var raw = (input.value || "").trim();
  if (!raw) {
    setStatus(statusEl, "error", "Enter a wallet address.");
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    return;
  }
  if (!isValidWallet(raw)) {
    setStatus(statusEl, "error", "Invalid wallet — use a 0x + 40 hex character address.");
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    return;
  }

  var url = apiUrl("/api/wallet?address=" + encodeURIComponent(raw));

  btn.disabled = true;
  setStatus(statusEl, "loading", "Loading…");
  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";

  try {
    var res = await fetch(url, { method: "GET" });
    var text = await res.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server returned non-JSON.");
    }
    if (!res.ok) {
      var errMsg = (data && data.error) || text || "Request failed.";
      if (data && data.detail) {
        errMsg = errMsg + " — " + data.detail;
      }
      throw new Error(errMsg);
    }
    setStatus(statusEl, "", "");
    renderWalletResults(resultsEl, data);
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    setStatus(statusEl, "error", msg);
    resultsEl.classList.add("hidden");
  } finally {
    btn.disabled = false;
  }
}

async function findTokenMatch() {
  var input = document.getElementById("token-input");
  var btn = document.getElementById("find-match-btn");
  var statusEl = document.getElementById("token-status");
  var resultsEl = document.getElementById("token-results");
  var walletResultsEl = document.getElementById("wallet-results");
  var walletStatusEl = document.getElementById("wallet-status");

  walletResultsEl.classList.add("hidden");
  walletResultsEl.innerHTML = "";
  setStatus(walletStatusEl, "", "");

  var raw = (input.value || "").trim();
  if (!raw) {
    setStatus(statusEl, "error", "Enter a token ID.");
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    return;
  }

  var url = apiUrl("/api/token?id=" + encodeURIComponent(raw));

  btn.disabled = true;
  setStatus(statusEl, "loading", "Loading…");
  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";

  try {
    var res = await fetch(url, { method: "GET" });
    var text = await res.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server returned non-JSON.");
    }
    if (!res.ok) {
      var err = (data && data.error) || "";
      if (res.status === 400 && /invalid id/i.test(err)) {
        throw new Error("Invalid token ID.");
      }
      throw new Error(err || text || "Request failed.");
    }
    setStatus(statusEl, "", "");
    renderTokenResults(resultsEl, data);
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    setStatus(statusEl, "error", msg);
    resultsEl.classList.add("hidden");
  } finally {
    btn.disabled = false;
  }
}

(function setupCounterpartSlotInteractions() {
  var walletResults = document.getElementById("wallet-results");
  if (!walletResults) return;
  walletResults.addEventListener("click", function (ev) {
    var slot = ev.target.closest("[data-counterpart-slot]");
    if (!slot || !walletResults.contains(slot)) return;
    if (ev.target.closest("a.nft-thumb__find")) return;
    slot.classList.toggle("is-revealed");
  });
  walletResults.addEventListener("keydown", function (ev) {
    var slot = ev.target.closest("[data-counterpart-slot]");
    if (!slot || !walletResults.contains(slot)) return;
    if (ev.target.closest && ev.target.closest("a.nft-thumb__find")) return;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      slot.classList.toggle("is-revealed");
    }
  });
})();

document.getElementById("check-wallet-btn").addEventListener("click", checkWallet);
document.getElementById("wallet-input").addEventListener("keydown", function (e) {
  if (e.key === "Enter") checkWallet();
});

document.getElementById("find-match-btn").addEventListener("click", findTokenMatch);
document.getElementById("token-input").addEventListener("keydown", function (e) {
  if (e.key === "Enter") findTokenMatch();
});
