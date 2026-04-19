/**
 * Quirks Set Checker — standalone app (Quirkies × Quirklings × QuirKid × INX).
 */
function getApiBase() {
  return "";
}

function apiUrl(pathAndQuery) {
  var base = getApiBase().replace(/\/$/, "");
  if (base) return base + pathAndQuery;
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin.replace(/\/$/, "") + pathAndQuery;
  }
  return pathAndQuery;
}

var WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

var WELCOME_SEEN_KEY = "quirks-set-checker-welcome-v1";

function isValidWallet(s) {
  return typeof s === "string" && WALLET_RE.test(s.trim());
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

function setGlobalLoading(on) {
  var el = document.getElementById("global-loading");
  if (!el) return;
  if (on) {
    el.classList.add("is-active");
    el.setAttribute("aria-busy", "true");
    el.removeAttribute("aria-hidden");
  } else {
    el.classList.remove("is-active");
    el.removeAttribute("aria-busy");
    el.setAttribute("aria-hidden", "true");
  }
}

window.setGlobalLoading = setGlobalLoading;

function welcomeModalHasBeenSeen() {
  try {
    if (localStorage.getItem(WELCOME_SEEN_KEY) === "1") return true;
  } catch (e) {
    /* ignore */
  }
  try {
    if (sessionStorage.getItem(WELCOME_SEEN_KEY) === "1") return true;
  } catch (e2) {
    /* ignore */
  }
  return false;
}

function markWelcomeModalSeen() {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch (e) {
    /* ignore */
  }
  try {
    sessionStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch (e2) {
    /* ignore */
  }
}

function setWelcomeModalOpen(on) {
  var modal = document.getElementById("welcome-modal");
  if (!modal) return;
  if (on) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("welcome-modal-active");
    var cta = document.getElementById("welcome-modal-got-it");
    if (cta) cta.focus();
  } else {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("welcome-modal-active");
  }
}

function dismissWelcomeModal() {
  markWelcomeModalSeen();
  setWelcomeModalOpen(false);
}

function maybeShowWelcomeModal() {
  if (welcomeModalHasBeenSeen()) return;
  setWelcomeModalOpen(true);
}

function setupBackToMenu() {
  var a = document.querySelector(".back-to-menu");
  if (!a) return;
  try {
    var h = window.location.hostname || "";
    if (/\.workers\.dev$/i.test(h)) {
      a.href = "https://littleollielabs.com/links/";
    }
  } catch (e) {
    /* keep default href */
  }
}

function setupWelcomeModal() {
  var modal = document.getElementById("welcome-modal");
  if (!modal) return;
  var closeBtn = document.getElementById("welcome-modal-close");
  var backdrop = document.getElementById("welcome-modal-backdrop");
  var gotIt = document.getElementById("welcome-modal-got-it");
  if (closeBtn) closeBtn.addEventListener("click", dismissWelcomeModal);
  if (backdrop) backdrop.addEventListener("click", dismissWelcomeModal);
  if (gotIt) gotIt.addEventListener("click", dismissWelcomeModal);
  var infoBtn = document.getElementById("welcome-info-btn");
  if (infoBtn) {
    infoBtn.addEventListener("click", function () {
      setWelcomeModalOpen(true);
    });
  }
  document.addEventListener(
    "keydown",
    function (ev) {
      if (ev.key !== "Escape") return;
      if (!modal.classList.contains("is-open")) return;
      ev.preventDefault();
      dismissWelcomeModal();
    },
    true
  );
  maybeShowWelcomeModal();
}

function normalizeMediaUrl(u) {
  if (!u || typeof u !== "string") return null;
  var s = u.trim();
  if (!s) return null;
  if (s.indexOf("/api/img") === 0) return s;
  if (s.indexOf("ipfs://") === 0) {
    var path = s.slice(7).replace(/^ipfs\//, "").replace(/^\/+/, "");
    return "https://nftstorage.link/ipfs/" + path;
  }
  if (s.indexOf("ar://") === 0) {
    return "https://arweave.net/" + s.slice(5);
  }
  return s;
}

function buildImageCandidates(raw) {
  var primary = normalizeMediaUrl(raw);
  if (!primary) return { primary: null, fallbacks: [] };
  if (primary.indexOf("/api/img") === 0) {
    return { primary: primary, fallbacks: [] };
  }
  var list = [primary];
  var pos = primary.indexOf("/ipfs/");
  if (pos !== -1) {
    var after = primary.slice(pos + 6);
    list.push("https://w3s.link/ipfs/" + after);
    list.push("https://cloudflare-ipfs.com/ipfs/" + after);
    list.push("https://dweb.link/ipfs/" + after);
    list.push("https://ipfs.io/ipfs/" + after);
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

function osBtn(href, label) {
  if (!href) {
    return '<span class="btn-secondary btn-secondary--disabled">' + escapeHtml(label) + "</span>";
  }
  return (
    '<a class="btn-secondary" href="' +
    escapeHtml(href) +
    '" target="_blank" rel="noopener noreferrer">' +
    escapeHtml(label) +
    "</a>"
  );
}

function renderCounterpartSlot(missingLabel, openseaNft, counterpartImageUrl, altForImage) {
  var findBtn = openseaNft
    ? '<a class="nft-thumb__find" href="' +
      escapeHtml(openseaNft) +
      '" target="_blank" rel="noopener noreferrer">Open on OpenSea</a>'
    : '<span class="nft-thumb__find nft-thumb__find--disabled">OpenSea</span>';

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
        escapeAttr(altForImage || "NFT") +
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

function renderMatchedCard(item) {
  var tid = formatTokenId(item.tokenId);
  var inxBlock = "";
  if (item.inx && item.inx.image) {
    inxBlock = thumbHtml(item.inx.image, "INX " + tid);
  } else if (item.openseaInx) {
    inxBlock =
      '<div class="nft-thumb nft-thumb--empty"><a class="nft-thumb__find" href="' +
      escapeHtml(item.openseaInx) +
      '" target="_blank" rel="noopener">INX on OpenSea</a></div>';
  }
  var links =
    '<p class="wallet-card__links">' +
    osBtn(item.openseaQuirkie, "Quirkie") +
    " " +
    osBtn(item.openseaQuirkling, "Quirkling") +
    (item.openseaInx ? " " + osBtn(item.openseaInx, "INX") : "") +
    "</p>";
  return (
    '<article class="wallet-card wallet-card--ok">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.quirkie && item.quirkie.image, "Quirkie " + tid) +
    thumbHtml(item.quirking && item.quirking.image, "Quirkling " + tid) +
    (inxBlock || "") +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--ok">✅ Matched pair</p>' +
    links +
    "</div>" +
    "</article>"
  );
}

function renderMissingQuirkieCard(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--info">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.quirking && item.quirking.image, "Quirkling " + tid) +
    renderCounterpartSlot(
      "Quirkie #" + tid + " (missing)",
      item.openseaNft || item.openseaQuirkie,
      item.counterpartImage,
      "Quirkie " + tid
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--extra">Quirkling without Quirkie</p>' +
    '<p class="wallet-card__links">' + osBtn(item.openseaQuirkling, "Your Quirkling") + "</p>" +
    "</div>" +
    "</article>"
  );
}

function renderLoneQuirkieCard(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--warn">' +
    '<div class="wallet-card__visuals">' +
    thumbHtml(item.quirkie && item.quirkie.image, "Quirkie " + tid) +
    renderCounterpartSlot(
      "Quirkling #" + tid + " (missing)",
      item.openseaNft || item.openseaQuirkling,
      item.counterpartImage,
      "Quirkling " + tid
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--bad">Quirkie without Quirkling</p>' +
    '<p class="wallet-card__links">' + osBtn(item.openseaQuirkie, "Your Quirkie") + "</p>" +
    "</div>" +
    "</article>"
  );
}

function renderHighQuirklingCard(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--nocert">' +
    '<div class="wallet-card__visuals wallet-card__visuals--single">' +
    thumbHtml(item.quirking && item.quirking.image, "Quirkling " + tid) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--nocert">Unpaired range</p>' +
    '<p class="wallet-card__meta">Quirklings with ID above 5000 are not paired with Quirkies by ID.</p>' +
    '<p class="wallet-card__links">' + osBtn(item.openseaQuirkling, "OpenSea") + "</p>" +
    "</div>" +
    "</article>"
  );
}

function renderInxOnlyCard(item) {
  var tid = formatTokenId(item.tokenId);
  return (
    '<article class="wallet-card wallet-card--info">' +
    '<div class="wallet-card__visuals wallet-card__visuals--single">' +
    thumbHtml(item.inx && item.inx.image, "INX " + tid) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--extra">INX (no matched pair in wallet)</p>' +
    '<p class="wallet-card__links">' + osBtn(item.openseaInx, "INX on OpenSea") + "</p>" +
    "</div>" +
    "</article>"
  );
}

function statsHtml(matchedLen, qLen, qlLen, ixLen) {
  return (
    '<div class="wallet-stats" role="status" aria-live="polite">' +
    '<span class="wallet-stats__line">' +
    '<span class="wallet-stats__ogenies"><strong>' +
    String(matchedLen) +
    "</strong> Matched pairs</span>" +
    '<span class="wallet-stats__sep" aria-hidden="true">·</span>' +
    '<span class="wallet-stats__ogenies"><strong>' +
    String(qLen) +
    "</strong> Quirkies</span>" +
    '<span class="wallet-stats__sep" aria-hidden="true">·</span>' +
    '<span class="wallet-stats__certs"><strong>' +
    String(qlLen) +
    "</strong> Quirklings</span>" +
    '<span class="wallet-stats__sep" aria-hidden="true">·</span>' +
    '<span class="wallet-stats__matched"><strong>' +
    String(ixLen) +
    "</strong> INX</span>" +
    "</span></div>"
  );
}

function applyWalletFilterShowSubs(subs, showKeys) {
  var si;
  var sub;
  var key;
  for (si = 0; si < subs.length; si++) {
    sub = subs[si];
    key = sub.getAttribute("data-unmatched-sub");
    if (showKeys.indexOf(key) !== -1) {
      sub.classList.remove("hidden");
    } else {
      sub.classList.add("hidden");
    }
  }
}

function applyWalletFilter(container, filter) {
  var m = container.querySelector('[data-wallet-section="matched"]');
  var u = container.querySelector('[data-wallet-section="unmatched"]');
  var buttons = container.querySelectorAll(".filter-btn");
  for (var b = 0; b < buttons.length; b++) {
    var btn = buttons[b];
    var f = btn.getAttribute("data-filter");
    var on = f === filter;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (!m || !u) return;

  var subs = u.querySelectorAll("[data-unmatched-sub]");
  if (filter === "all") {
    m.classList.remove("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, [
      "lone-quirkie",
      "missing-quirkie",
      "high-quirkling",
      "inx-only",
    ]);
  } else if (filter === "matched") {
    m.classList.remove("hidden");
    u.classList.add("hidden");
  } else if (filter === "missing-quirkie") {
    m.classList.add("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, ["missing-quirkie"]);
  } else if (filter === "lone-quirkie") {
    m.classList.add("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, ["lone-quirkie"]);
  } else if (filter === "high-quirkling") {
    m.classList.add("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, ["high-quirkling"]);
  } else if (filter === "inx-only") {
    m.classList.add("hidden");
    u.classList.remove("hidden");
    applyWalletFilterShowSubs(subs, ["inx-only"]);
  }
}

function updateLookupShellMeta(data) {
  var meta = document.getElementById("lookup-shell-meta");
  if (!meta) return;
  var matched = (data && data.matched) || [];
  var q = (data && data.quirkies) || [];
  var ql = (data && data.quirklings) || [];
  meta.textContent =
    " · " +
    matched.length +
    " matched · " +
    q.length +
    " Quirkies · " +
    ql.length +
    " Quirklings";
  meta.hidden = false;
}

function clearLookupShellMeta() {
  var meta = document.getElementById("lookup-shell-meta");
  if (!meta) return;
  meta.textContent = "";
  meta.hidden = true;
}

function setLookupShellCollapsed(collapsed) {
  var shell = document.getElementById("lookup-shell");
  var btn = document.getElementById("lookup-shell-toggle");
  if (!shell || !btn) return;
  shell.classList.toggle("is-collapsed", !!collapsed);
  btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function collapseLookupShellAfterWalletCheck() {
  var results = document.getElementById("wallet-results");
  setLookupShellCollapsed(true);
  if (results && !results.classList.contains("hidden")) {
    window.requestAnimationFrame(function () {
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function setupLookupShell() {
  var shell = document.getElementById("lookup-shell");
  var toggle = document.getElementById("lookup-shell-toggle");
  if (!shell || !toggle) return;
  toggle.addEventListener("click", function () {
    setLookupShellCollapsed(!shell.classList.contains("is-collapsed"));
  });
}

function renderWalletResults(container, data) {
  var matched = data.matched || [];
  var missingQuirkie = data.missingQuirkie || [];
  var loneQuirkies = data.loneQuirkies || [];
  var quirklingsHigh = data.quirklingsHigh || [];
  var inxOnly = data.inxOnly || [];
  var quirkies = data.quirkies || [];
  var quirklings = data.quirklings || [];
  var inx = data.inx || [];

  var hasAny = quirkies.length > 0 || quirklings.length > 0 || inx.length > 0;
  var html = "";

  if (!hasAny) {
    container.removeAttribute("data-last-wallet");
    html +=
      statsHtml(0, 0, 0, 0) +
      '<p class="empty-hint prominent">No Quirkies, Quirklings, or INX found for this wallet on Ethereum mainnet.</p>';
    container.innerHTML = html;
    container.classList.remove("hidden");
    updateLookupShellMeta({ matched: [], quirkies: [], quirklings: [] });
    return;
  }

  html +=
    statsHtml(matched.length, quirkies.length, quirklings.length, inx.length) +
    '<div class="wallet-filter" role="tablist" aria-label="Filter wallet results">' +
    '<span class="wallet-filter-label">View:</span>' +
    '<button type="button" class="filter-btn is-active" data-filter="all" role="tab" aria-pressed="true">All</button>' +
    '<button type="button" class="filter-btn" data-filter="matched" role="tab" aria-pressed="false">Matched</button>' +
    '<button type="button" class="filter-btn" data-filter="lone-quirkie" role="tab" aria-pressed="false">Missing Quirkling</button>' +
    '<button type="button" class="filter-btn" data-filter="missing-quirkie" role="tab" aria-pressed="false">Missing Quirkie</button>' +
    '<button type="button" class="filter-btn" data-filter="high-quirkling" role="tab" aria-pressed="false">High ID</button>' +
    '<button type="button" class="filter-btn" data-filter="inx-only" role="tab" aria-pressed="false">INX only</button>' +
    "</div>" +
    '<div id="quirks-grid-actions" class="quirks-grid-actions"></div>';

  html += '<div class="wallet-section-wrap" data-wallet-section="matched">';
  html += '<h3 class="section-title">Matched pairs (ID ≤ ' + escapeHtml(String(data.pairMaxTokenId != null ? data.pairMaxTokenId : 5000)) + ")</h3>";
  html += '<div class="wallet-grid">';
  if (matched.length === 0) {
    html += '<p class="empty-hint">No overlapping Quirkie + Quirkling IDs in the paired range.</p>';
  } else {
    for (var i = 0; i < matched.length; i++) {
      html += renderMatchedCard(matched[i]);
    }
  }
  html += "</div></div>";

  html += '<div class="wallet-section-wrap" data-wallet-section="unmatched">';
  html +=
    '<div class="unmatched-sub" data-unmatched-sub="lone-quirkie">' +
    '<h3 class="section-title">Quirkie without Quirkling</h3><div class="wallet-grid">';
  if (loneQuirkies.length === 0) {
    html += '<p class="empty-hint">None.</p>';
  } else {
    for (var j = 0; j < loneQuirkies.length; j++) {
      html += renderLoneQuirkieCard(loneQuirkies[j]);
    }
  }
  html += "</div></div>";

  html +=
    '<div class="unmatched-sub" data-unmatched-sub="missing-quirkie">' +
    '<h3 class="section-title">Quirkling without Quirkie</h3><p class="section-blurb">You hold a Quirkling in the 1–' +
    escapeHtml(String(data.pairMaxTokenId != null ? data.pairMaxTokenId : 5000)) +
    " range but not the matching Quirkie. Use OpenSea to find the Quirkie with the same ID.</p>";
  html += '<div class="wallet-grid">';
  if (missingQuirkie.length === 0) {
    html += '<p class="empty-hint">None.</p>';
  } else {
    for (var k = 0; k < missingQuirkie.length; k++) {
      html += renderMissingQuirkieCard(missingQuirkie[k]);
    }
  }
  html += "</div></div>";

  html +=
    '<div class="unmatched-sub" data-unmatched-sub="high-quirkling">' +
    '<h3 class="section-title">Quirklings above ID 5000</h3><p class="section-blurb">These are not ID-matched to Quirkies.</p><div class="wallet-grid">';
  if (quirklingsHigh.length === 0) {
    html += '<p class="empty-hint">None.</p>';
  } else {
    for (var h = 0; h < quirklingsHigh.length; h++) {
      html += renderHighQuirklingCard(quirklingsHigh[h]);
    }
  }
  html += "</div></div>";

  html +=
    '<div class="unmatched-sub" data-unmatched-sub="inx-only">' +
    '<h3 class="section-title">INX (no full pair in wallet)</h3><p class="section-blurb">INX you hold where this wallet does not also show the matched Quirkie + Quirkling pair.</p><div class="wallet-grid">';
  if (inxOnly.length === 0) {
    html += '<p class="empty-hint">None.</p>';
  } else {
    for (var x = 0; x < inxOnly.length; x++) {
      html += renderInxOnlyCard(inxOnly[x]);
    }
  }
  html += "</div></div></div>";

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

  updateLookupShellMeta(data);
  if (data.wallet) {
    container.setAttribute("data-last-wallet", String(data.wallet));
  } else {
    container.removeAttribute("data-last-wallet");
  }

  if (typeof window.__quirksInjectGridButton === "function") {
    window.__quirksInjectGridButton();
  }
}

function renderTokenResults(container, data) {
  var tid = formatTokenId(data.tokenId);
  var cap = data.pairMaxTokenId != null ? String(data.pairMaxTokenId) : "5000";

  var q = data.quirkie || {};
  var ql = data.quirking;
  var ix = data.inx;

  function card(label, item, kind) {
    if (!item) {
      return (
        '<article class="token-side token-side--' +
        kind +
        '">' +
        '<p class="token-side__label">' +
        escapeHtml(label) +
        "</p>" +
        '<p class="empty-hint">—</p></article>'
      );
    }
    var owner = item.owner;
    var sea = item.opensea;
    var nft = item.openseaNft;
    return (
      '<article class="token-side token-side--' +
      kind +
      '">' +
      thumbHtml(item.image, label + " " + tid) +
      '<h4 class="token-side__label">' +
      escapeHtml(label) +
      "</h4>" +
      '<p class="token-side__owner mono" title="' +
      escapeAttr(owner || "") +
      '">' +
      escapeHtml(owner ? shortAddress(owner) : "—") +
      "</p>" +
      (sea
        ? '<a class="btn-secondary" href="' +
          escapeHtml(sea) +
          '" target="_blank" rel="noopener noreferrer">Owner</a> '
        : "") +
      (nft
        ? '<a class="btn-secondary" href="' +
          escapeHtml(nft) +
          '" target="_blank" rel="noopener noreferrer">OpenSea item</a>'
        : "") +
      "</article>"
    );
  }

  var pairNote = "";
  if (!data.inPairRange) {
    pairNote =
      '<p class="section-blurb">Token ID is above the ' +
      escapeHtml(cap) +
      " pairing range — Quirkling pairing by ID does not apply.</p>";
  }

  var verdict = "";
  if (data.inPairRange && ql) {
    verdict = data.pairOwnersMatch
      ? '<p class="verdict verdict--ok">✅ Same owner for Quirkie &amp; Quirkling.</p>'
      : '<p class="verdict verdict--bad">❌ Different owners (or one side missing).</p>';
  } else if (data.inPairRange && !ql) {
    verdict =
      '<p class="verdict verdict--nocert">No Quirkling metadata for this ID (may be unminted).</p>';
  }

  var inxCard = ix ? card("INX", ix, "inx") : "";

  container.innerHTML =
    pairNote +
    '<div class="token-pair">' +
    card("Quirkie", q, "quirkie") +
    (data.inPairRange && ql ? card("Quirkling", ql, "quirking") : "") +
    inxCard +
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
    clearLookupShellMeta();
    setLookupShellCollapsed(false);
    return;
  }
  if (!isValidWallet(raw)) {
    setStatus(statusEl, "error", "Invalid wallet — use 0x + 40 hex characters.");
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    clearLookupShellMeta();
    setLookupShellCollapsed(false);
    return;
  }

  var url = apiUrl("/api/wallet?address=" + encodeURIComponent(raw));

  btn.disabled = true;
  setStatus(statusEl, "loading", "Loading…");
  setGlobalLoading(true);
  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";
  resultsEl.removeAttribute("data-last-wallet");

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
      if (data && data.hint) {
        errMsg = errMsg + " " + data.hint;
      }
      throw new Error(errMsg);
    }
    setStatus(statusEl, "", "");
    renderWalletResults(resultsEl, data);
    collapseLookupShellAfterWalletCheck();
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    setStatus(statusEl, "error", msg);
    resultsEl.classList.add("hidden");
    clearLookupShellMeta();
    setLookupShellCollapsed(false);
  } finally {
    setGlobalLoading(false);
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
  walletResultsEl.removeAttribute("data-last-wallet");
  setStatus(walletStatusEl, "", "");
  clearLookupShellMeta();

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
  setGlobalLoading(true);
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
      if (data && data.hint) {
        errMsg = errMsg + " " + data.hint;
      }
      throw new Error(errMsg);
    }
    setStatus(statusEl, "", "");
    renderTokenResults(resultsEl, data);
  } catch (e) {
    var msg = e instanceof Error ? e.message : String(e);
    setStatus(statusEl, "error", msg);
    resultsEl.classList.add("hidden");
  } finally {
    setGlobalLoading(false);
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
})();

document.getElementById("check-wallet-btn").addEventListener("click", checkWallet);
document.getElementById("wallet-input").addEventListener("keydown", function (e) {
  if (e.key === "Enter") checkWallet();
});

document.getElementById("find-match-btn").addEventListener("click", findTokenMatch);
document.getElementById("token-input").addEventListener("keydown", function (e) {
  if (e.key === "Enter") findTokenMatch();
});

setupBackToMenu();
setupWelcomeModal();
setupLookupShell();
