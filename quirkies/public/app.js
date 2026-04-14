/**
 * Quirks Set Checker — standalone app (Quirkies × Quirklings × QuirKid × INX).
 * GitHub Pages has no /api/*; static hosting must call the Worker origin (same pattern as OGTnew/public/app.js).
 */
var WORKER_ORIGIN = "https://quirks-set-checker.littleollienft.workers.dev";

function getApiBase() {
  var loc = window.location;
  if (!WORKER_ORIGIN) return "";
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

/** Split textarea / pasted list into unique valid0x addresses (max 12). */
function parseWalletAddressesFromInput(raw) {
  var s = String(raw || "").trim();
  if (!s) return [];
  var parts = s.split(/[\s,;]+/g);
  var out = [];
  var seen = {};
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (!p) continue;
    if (!isValidWallet(p)) continue;
    var low = p.toLowerCase();
    if (seen[low]) continue;
    seen[low] = true;
    out.push(p);
    if (out.length >= 12) break;
  }
  return out;
}

function walletPayloadCacheKey(data) {
  if (!data) return "";
  if (data.wallets && Array.isArray(data.wallets) && data.wallets.length) {
    return data.wallets
      .map(function (x) {
        return String(x).trim().toLowerCase();
      })
      .filter(function (x) {
        return WALLET_RE.test(x);
      })
      .sort()
      .join(",");
  }
  var w = data.wallet != null ? String(data.wallet).trim() : "";
  if (!w) return "";
  return w
    .split(",")
    .map(function (x) {
      return x.trim().toLowerCase();
    })
    .filter(function (x) {
      return WALLET_RE.test(x);
    })
    .sort()
    .join(",");
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

/** True if token lookup has at least one image the FLECKS grid can use. */
function tokenLookupHasGridableImages(data) {
  if (!data) return false;
  var q = data.quirkie;
  var ql = data.quirking;
  var ix = data.inx;
  return !!(
    (q && q.image) ||
    (q && q.kidImage) ||
    (ql && ql.image) ||
    (ix && ix.image)
  );
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

/** Resolve a file in `public/` (same origin as the page). */
function publicAssetHref(filename) {
  try {
    var base =
      typeof document !== "undefined" && document.baseURI
        ? document.baseURI
        : typeof window !== "undefined"
          ? window.location.href
          : "";
    return new URL(filename, base || "https://local.invalid/").href;
  } catch (e) {
    return filename;
  }
}

/** Empty INX tile: Quirkies mark top-left (no metadata fetch / INX placeholder art). */
function inxMissingThumbHtml(message) {
  var logoSrc = publicAssetHref("quirkieslogo.png");
  return (
    '<div class="nft-thumb nft-thumb--empty inx-missing-thumb">' +
    '<img src="' +
    escapeAttr(logoSrc) +
    '" alt="" class="inx-missing-thumb__logo" decoding="async" />' +
    '<span class="inx-missing-thumb__msg">' +
    escapeHtml(message || "No INX") +
    "</span></div>"
  );
}

function openSeaEthereumItem(contract, tokenId) {
  if (!contract || tokenId === undefined || tokenId === null) return null;
  return (
    "https://opensea.io/item/ethereum/" +
    String(contract).toLowerCase() +
    "/" +
    encodeURIComponent(String(tokenId))
  );
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
      a.href = "https://littleollielabs.com/links.html";
    }
  } catch (e) {
    /* keep default href */
  }
}

var THEME_STORAGE_KEY = "lo-labs-theme";

function setupThemeToggle() {
  var html = document.documentElement;
  var btn = document.getElementById("theme-toggle");
  function syncButton() {
    if (!btn) return;
    var t = html.getAttribute("data-theme") || "dark";
    var isLight = t === "light";
    btn.setAttribute("aria-checked", isLight ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      isLight ? "Switch to dark theme" : "Switch to light theme"
    );
  }
  function applyTheme(next) {
    if (next !== "light" && next !== "dark") next = "dark";
    html.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (e) {
      /* ignore */
    }
    syncButton();
  }
  if (btn) {
    btn.addEventListener("click", function () {
      var cur = html.getAttribute("data-theme") || "dark";
      applyTheme(cur === "dark" ? "light" : "dark");
    });
  }
  syncButton();
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

/** Delegates to modules/nftImageLoader.js (multi-gateway, cache, metadata fallback). */
function thumbHtml(url, alt, meta) {
  var NL = typeof window !== "undefined" && window.NftImageLoader;
  if (NL && typeof NL.thumbHtml === "function") {
    return NL.thumbHtml(url, alt, meta || {});
  }
  if (url) {
    return (
      '<div class="nft-thumb is-loaded">' +
      '<img src="' +
      escapeAttr(String(url)) +
      '" alt="' +
      escapeAttr(alt || "NFT") +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer" />' +
      '<div class="nft-thumb-fallback" aria-hidden="true">No image</div>' +
      "</div>"
    );
  }
  return (
    '<div class="nft-thumb nft-thumb--empty"><span class="nft-thumb-fallback">No image</span></div>'
  );
}

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

/** Full-width OpenSea link under a wallet thumbnail (matches column width). */
function osBtnFull(href, label) {
  if (!href) {
    return (
      '<span class="btn-secondary btn-secondary--wallet-col btn-secondary--disabled">' +
      escapeHtml(label) +
      "</span>"
    );
  }
  return (
    '<a class="btn-secondary btn-secondary--wallet-col" href="' +
    escapeHtml(href) +
    '" target="_blank" rel="noopener noreferrer">' +
    escapeHtml(label) +
    "</a>"
  );
}

function walletCol(thumbInnerHtml, osActionHtml) {
  return (
    '<div class="wallet-col">' +
    '<div class="wallet-col__thumb">' +
    thumbInnerHtml +
    "</div>" +
    '<div class="wallet-col__os">' +
    (osActionHtml || "") +
    "</div>" +
    "</div>"
  );
}

function renderCounterpartSlot(missingLabel, openseaNft, counterpartImageUrl, altForImage, meta) {
  var findBlock = osBtnFull(openseaNft, "Open on OpenSea");
  meta = Object.assign({}, meta || {});
  if (altForImage) meta.alt = altForImage;
  meta.isExternalMatch = true;

  var visual = "";
  var NL = typeof window !== "undefined" && window.NftImageLoader;
  var hasCounterUrl =
    counterpartImageUrl && String(counterpartImageUrl).trim() !== "";
  if (hasCounterUrl) {
    if (NL && typeof NL.counterpartThumbHtml === "function") {
      visual = NL.counterpartThumbHtml(
        counterpartImageUrl,
        altForImage || "NFT",
        meta || {}
      );
    } else {
      visual =
        '<div class="nft-thumb__counterpart-visual is-loaded">' +
        '<img class="nft-thumb__counterpart-img" src="' +
        escapeAttr(String(counterpartImageUrl)) +
        '" alt="' +
        escapeAttr(altForImage || "NFT") +
        '" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
        ' onload="window.__nftImgLoad(this)" onerror="window.__nftImgErr(this)" />' +
        '<div class="nft-thumb-fallback" aria-hidden="true">' +
        '<span class="nft-thumb-fallback__msg">No image</span>' +
        '<button type="button" class="nft-thumb__retry">Retry</button>' +
        "</div>" +
        "</div>";
    }
  }
  if (!visual) {
    if (NL && typeof NL.counterpartFetchShellHtml === "function") {
      visual = NL.counterpartFetchShellHtml(meta);
    } else {
      visual =
        '<div class="nft-thumb__counterpart-visual nft-thumb__counterpart-visual--empty">' +
        '<span class="nft-thumb-fallback">No preview</span></div>';
    }
  }

  var dbgCol = meta.collection ? escapeAttr(String(meta.collection)) : "";
  var dbgTid =
    meta.tokenId != null ? escapeAttr(String(meta.tokenId)) : "";
  var dbgData =
    (dbgCol ? ' data-debug-counterpart-collection="' + dbgCol + '"' : "") +
    (dbgTid ? ' data-debug-counterpart-token-id="' + dbgTid + '"' : "");

  return (
    '<div class="wallet-col wallet-col--counterpart">' +
    '<div class="wallet-col__thumb">' +
    '<div class="nft-thumb nft-thumb--counterpart nft-thumb--counterpartExternal" data-counterpart-slot data-counterpart-owned="0"' +
    dbgData +
    ' tabindex="0" role="group" aria-label="' +
    escapeAttr(missingLabel) +
    '">' +
    visual +
    '<span class="nft-thumb__counterpart-label">' +
    escapeHtml(missingLabel) +
    "</span>" +
    '<button type="button" class="nft-thumb__retry nft-thumb__retry--slot-action" aria-label="Retry loading this preview">Retry</button>' +
    "</div>" +
    "</div>" +
    '<div class="wallet-col__os">' +
    findBlock +
    "</div>" +
    "</div>"
  );
}

function renderMatchedCard(item, ctx) {
  var tid = formatTokenId(item.tokenId);
  var c = (ctx && ctx.contracts) || {};
  var qCol = walletCol(
    thumbHtml(item.quirkie && item.quirkie.image, "Quirkie " + tid, {
      contract: c.quirkies,
      tokenId: tid,
      imageIndex: ctx.nextImg(),
    }),
    osBtnFull(item.openseaQuirkie, "Quirkie")
  );
  var qlCol = walletCol(
    thumbHtml(item.quirking && item.quirking.image, "Quirkling " + tid, {
      contract: c.quirklings,
      tokenId: tid,
      imageIndex: ctx.nextImg(),
    }),
    osBtnFull(item.openseaQuirkling, "Quirkling")
  );
  var inxCol = "";
  if (item.inx && c.inx) {
    inxCol = walletCol(
      thumbHtml(item.inx.image ? item.inx.image : null, "INX " + tid, {
        contract: c.inx,
        tokenId: tid,
        imageIndex: ctx.nextImg(),
      }),
      osBtnFull(item.openseaInx, "INX")
    );
  }
  var visualsClass =
    "wallet-card__visuals" + (inxCol ? " wallet-card__visuals--triple" : "");
  return (
    '<article class="wallet-card wallet-card--ok">' +
    '<div class="' +
    visualsClass +
    '">' +
    qCol +
    qlCol +
    inxCol +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--ok">\u2705 Matched pair</p>' +
    "</div>" +
    "</article>"
  );
}

function renderMissingQuirkieCard(item, ctx) {
  var tid = formatTokenId(item.tokenId);
  var c = (ctx && ctx.contracts) || {};
  return (
    '<article class="wallet-card wallet-card--info">' +
    '<div class="wallet-card__visuals">' +
    walletCol(
      thumbHtml(item.quirking && item.quirking.image, "Quirkling " + tid, {
        contract: c.quirklings,
        tokenId: tid,
        imageIndex: ctx.nextImg(),
      }),
      osBtnFull(item.openseaQuirkling, "Quirkling")
    ) +
    renderCounterpartSlot(
      "Quirkie #" + tid + " (not in wallet)",
      item.openseaNft || item.openseaQuirkie,
      item.counterpartImage,
      "Quirkie " + tid,
      {
        contract: item.counterpartContract || c.quirkies,
        tokenId: tid,
        collection: item.counterpartCollection || "quirkies",
        imageIndex: ctx.nextImg(),
      }
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--extra">Quirkling without Quirkie</p>' +
    "</div>" +
    "</article>"
  );
}

function renderLoneQuirkieCard(item, ctx) {
  var tid = formatTokenId(item.tokenId);
  var c = (ctx && ctx.contracts) || {};
  return (
    '<article class="wallet-card wallet-card--warn">' +
    '<div class="wallet-card__visuals">' +
    walletCol(
      thumbHtml(item.quirkie && item.quirkie.image, "Quirkie " + tid, {
        contract: c.quirkies,
        tokenId: tid,
        imageIndex: ctx.nextImg(),
      }),
      osBtnFull(item.openseaQuirkie, "Quirkie")
    ) +
    renderCounterpartSlot(
      "Quirkling #" + tid + " (not in wallet)",
      item.openseaNft || item.openseaQuirkling,
      item.counterpartImage,
      "Quirkling " + tid,
      {
        contract: item.counterpartContract || c.quirklings,
        tokenId: tid,
        collection: item.counterpartCollection || "quirklings",
        imageIndex: ctx.nextImg(),
      }
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--bad">Quirkie without Quirkling</p>' +
    "</div>" +
    "</article>"
  );
}

function renderHighQuirklingCard(item, ctx) {
  var tid = formatTokenId(item.tokenId);
  var c = (ctx && ctx.contracts) || {};
  return (
    '<article class="wallet-card wallet-card--nocert">' +
    '<div class="wallet-card__visuals wallet-card__visuals--single">' +
    walletCol(
      thumbHtml(item.quirking && item.quirking.image, "Quirkling " + tid, {
        contract: c.quirklings,
        tokenId: tid,
        imageIndex: ctx.nextImg(),
      }),
      osBtnFull(item.openseaQuirkling, "Quirkling")
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--nocert">Unpaired range</p>' +
    '<p class="wallet-card__meta">Quirklings with ID above 5000 are not paired with Quirkies by ID.</p>' +
    "</div>" +
    "</article>"
  );
}

function renderInxOnlyCard(item, ctx) {
  var tid = formatTokenId(item.tokenId);
  var c = (ctx && ctx.contracts) || {};
  return (
    '<article class="wallet-card wallet-card--info">' +
    '<div class="wallet-card__visuals wallet-card__visuals--single">' +
    walletCol(
      thumbHtml(
        item.inx && item.inx.image ? item.inx.image : null,
        "INX " + tid,
        {
          contract: c.inx,
          tokenId: tid,
          imageIndex: ctx.nextImg(),
        }
      ),
      osBtnFull(item.openseaInx, "INX")
    ) +
    "</div>" +
    '<div class="wallet-card__body">' +
    '<p class="wallet-card__id">#' +
    escapeHtml(tid) +
    "</p>" +
    '<p class="wallet-card__badge wallet-card__badge--extra">INX (no matched pair in wallet)</p>' +
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
  var nWallets = 1;
  if (data && data.wallets && Array.isArray(data.wallets) && data.wallets.length) {
    nWallets = data.wallets.length;
  } else if (data && data.wallet && String(data.wallet).indexOf(",") !== -1) {
    nWallets = String(data.wallet)
      .split(",")
      .map(function (x) {
        return x.trim();
      })
      .filter(function (x) {
        return isValidWallet(x);
      }).length;
    if (nWallets < 1) nWallets = 1;
  }
  var prefix = nWallets > 1 ? " · " + nWallets + " wallets" : "";
  meta.textContent =
    prefix +
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
  var imgSeq = 0;
  var thumbCtx = {
    contracts: data.contracts || {},
    nextImg: function () {
      return imgSeq++;
    },
  };

  if (!hasAny) {
    container.removeAttribute("data-last-wallet");
    container.removeAttribute("data-wallets");
    try {
      window.__quirksWalletPayload = null;
      window.__quirksWalletPayloadAddress = null;
      window.__quirksWalletContracts = {};
    } catch (e) {
      /* ignore */
    }
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
    '<div class="wallet-results-toolbar">' +
    '<div id="quirks-grid-actions" class="quirks-grid-actions"></div>' +
    '<button type="button" class="btn-secondary wallet-retry-missing-btn" id="wallet-retry-missing-btn">Retry missing images</button>' +
    "</div>";

  html += '<div class="wallet-section-wrap" data-wallet-section="matched">';
  html += '<h3 class="section-title">Matched pairs (ID ≤ ' + escapeHtml(String(data.pairMaxTokenId != null ? data.pairMaxTokenId : 5000)) + ")</h3>";
  html += '<div class="wallet-grid">';
  if (matched.length === 0) {
    html += '<p class="empty-hint">No overlapping Quirkie + Quirkling IDs in the paired range.</p>';
  } else {
    for (var i = 0; i < matched.length; i++) {
      html += renderMatchedCard(matched[i], thumbCtx);
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
      html += renderLoneQuirkieCard(loneQuirkies[j], thumbCtx);
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
      html += renderMissingQuirkieCard(missingQuirkie[k], thumbCtx);
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
      html += renderHighQuirklingCard(quirklingsHigh[h], thumbCtx);
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
      html += renderInxOnlyCard(inxOnly[x], thumbCtx);
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
  var cacheKey = walletPayloadCacheKey(data);
  if (cacheKey) {
    container.setAttribute("data-wallets", cacheKey);
    container.setAttribute("data-last-wallet", cacheKey);
  } else {
    container.removeAttribute("data-wallets");
    container.removeAttribute("data-last-wallet");
  }

  if (typeof window.__quirksInjectGridButton === "function") {
    window.__quirksInjectGridButton();
  }

  try {
    window.__quirksWalletPayload = data;
    window.__quirksWalletPayloadAddress = cacheKey;
    window.__quirksWalletContracts = data.contracts || {};
  } catch (e) {
    /* ignore */
  }

  var NL = typeof window !== "undefined" && window.NftImageLoader;
  if (NL) {
    window.requestAnimationFrame(function () {
      if (typeof NL.preflightWalletThumbs === "function") {
        void NL.preflightWalletThumbs(container);
      }
      if (typeof NL.retryAllMissingNftImages === "function") {
        NL.retryAllMissingNftImages(container);
      }
    });
  }
}

function renderTokenResults(container, data) {
  var tid = formatTokenId(data.tokenId);
  var cap = data.pairMaxTokenId != null ? String(data.pairMaxTokenId) : "5000";

  var q = data.quirkie || {};
  var ql = data.quirking;
  var ix = data.inx;
  var contracts = data.contracts || {};
  var tokenImgSeq = 0;

  function quirkKidCard(quirkieObj) {
    if (!quirkieObj || !quirkieObj.kidImage) {
      return (
        '<article class="token-side token-side--quirkkid">' +
        '<p class="token-side__label">QuirkKid</p>' +
        '<p class="empty-hint">—</p></article>'
      );
    }
    var owner = quirkieObj.owner;
    return (
      '<article class="token-side token-side--quirkkid">' +
      thumbHtml(quirkieObj.kidImage, "QuirkKid " + tid, {
        collection: "quirkkids",
        tokenId: tid,
        imageIndex: tokenImgSeq++,
      }) +
      '<h4 class="token-side__label">QuirkKid</h4>' +
      '<p class="token-side__owner mono" title="' +
      escapeAttr(owner || "") +
      '">' +
      escapeHtml(owner ? shortAddress(owner) : "—") +
      "</p>" +
      (quirkieObj.opensea
        ? '<a class="btn-secondary" href="' +
          escapeHtml(quirkieObj.opensea) +
          '" target="_blank" rel="noopener noreferrer">Owner</a> '
        : "") +
      "</article>"
    );
  }

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
    var contractAddr = null;
    if (kind === "quirkie") contractAddr = contracts.quirkies;
    else if (kind === "quirking") contractAddr = contracts.quirklings;
    else if (kind === "inx") contractAddr = contracts.inx;
    if (kind === "inx" && !item.image) {
      var ownerIx = item.owner;
      var seaIx = item.opensea;
      var nftIx = item.openseaNft;
      return (
        '<article class="token-side token-side--inx token-side--inx-missing">' +
        inxMissingThumbHtml("No INX for this ID") +
        '<h4 class="token-side__label">' +
        escapeHtml(label) +
        "</h4>" +
        '<p class="token-side__owner mono" title="' +
        escapeAttr(ownerIx || "") +
        '">' +
        escapeHtml(ownerIx ? shortAddress(ownerIx) : "—") +
        "</p>" +
        (seaIx
          ? '<a class="btn-secondary" href="' +
            escapeHtml(seaIx) +
            '" target="_blank" rel="noopener noreferrer">Owner</a> '
          : "") +
        (nftIx
          ? '<a class="btn-secondary" href="' +
            escapeHtml(nftIx) +
            '" target="_blank" rel="noopener noreferrer">OpenSea item</a>'
          : "") +
        "</article>"
      );
    }
    return (
      '<article class="token-side token-side--' +
      kind +
      '">' +
      thumbHtml(item.image, label + " " + tid, {
        contract: contractAddr,
        tokenId: tid,
        imageIndex: tokenImgSeq++,
      }) +
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

  var flecksToolbar = "";
  if (tokenLookupHasGridableImages(data)) {
    flecksToolbar =
      '<div class="token-results-toolbar">' +
      '<button type="button" class="btn-primary token-flecks-grid-btn" data-action="token-flecks-grid">Create FLECKS grid · this ID only</button>' +
      '<p class="token-results-toolbar__hint">Opens the builder with only the art found for this token.</p>' +
      "</div>";
  }

  container.innerHTML =
    pairNote +
    flecksToolbar +
    '<div class="token-pair">' +
    card("Quirkie", q, "quirkie") +
    quirkKidCard(q) +
    (data.inPairRange ? card("Quirkling", ql || null, "quirking") : "") +
    inxCard +
    "</div>" +
    verdict;
  container.classList.remove("hidden");
  var NLtok = typeof window !== "undefined" && window.NftImageLoader;
  if (NLtok) {
    window.requestAnimationFrame(function () {
      if (typeof NLtok.preflightWalletThumbs === "function") {
        void NLtok.preflightWalletThumbs(container);
      }
    });
  }
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

  var addrs = parseWalletAddressesFromInput(input ? input.value : "");
  if (!addrs.length) {
    setStatus(
      statusEl,
      "error",
      "Enter at least one wallet — 0x + 40 hex characters. Separate multiple with a comma, space, or new line (max 12)."
    );
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
    clearLookupShellMeta();
    setLookupShellCollapsed(false);
    return;
  }

  var params = new URLSearchParams();
  for (var ai = 0; ai < addrs.length; ai++) {
    params.append("address", addrs[ai]);
  }
  var url = apiUrl("/api/wallet?" + params.toString());

  btn.disabled = true;
  setStatus(statusEl, "loading", "Loading…");
  setGlobalLoading(true);
  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";
  resultsEl.removeAttribute("data-last-wallet");
  resultsEl.removeAttribute("data-wallets");

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
  walletResultsEl.removeAttribute("data-wallets");
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
    window.__lastTokenLookupData = null;
  } catch (e0) {
    /* ignore */
  }

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
    try {
      window.__lastTokenLookupData = data;
    } catch (e2) {
      /* ignore */
    }
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
    if (ev.target.closest(".nft-thumb__retry")) return;
    if (ev.target.closest(".nft-thumb__reload")) return;
    if (ev.target.closest(".wallet-col__os a")) return;
    slot.classList.toggle("is-revealed");
  });
})();

document.getElementById("check-wallet-btn").addEventListener("click", checkWallet);
var walletInputEl = document.getElementById("wallet-input");
if (walletInputEl) {
  walletInputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      checkWallet();
    }
  });
}

document.getElementById("find-match-btn").addEventListener("click", findTokenMatch);
document.getElementById("token-input").addEventListener("keydown", function (e) {
  if (e.key === "Enter") findTokenMatch();
});

function setupRetryMissingImagesGlobal() {
  document.addEventListener("click", function (ev) {
    var wbtn = ev.target.closest("#wallet-retry-missing-btn");
    if (wbtn) {
      ev.preventDefault();
      var wr = document.getElementById("wallet-results");
      var NL = typeof window !== "undefined" && window.NftImageLoader;
      if (NL && typeof NL.retryAllMissingNftImages === "function") {
        NL.retryAllMissingNftImages(wr || document);
      }
      return;
    }
  });
}

function setupTokenFlecksGridFromSearch() {
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-action='token-flecks-grid']");
    if (!btn) return;
    var host = document.getElementById("token-results");
    if (!host || !host.contains(btn)) return;
    var d = window.__lastTokenLookupData;
    if (!d) return;
    var fn = window.__quirksOpenFlecksFromTokenSearch;
    if (typeof fn === "function") {
      fn(d);
    } else {
      var st = document.getElementById("token-status");
      if (st) {
        setStatus(st, "error", "FLECKS grid is still loading — try again in a moment.");
      }
    }
  });
}

setupBackToMenu();
setupThemeToggle();
setupWelcomeModal();
setupLookupShell();
setupRetryMissingImagesGlobal();
setupTokenFlecksGridFromSearch();
