/**
 * Collection Overlap — frontend only.
 * Calls Worker GET /api/collection-overlap (Alchemy key stays on server).
 *
 * Config: set window.COLLECTION_OVERLAP_API_BASE to your Worker origin if this HTML
 * is hosted separately (empty string = same origin as this page).
 */

function $(id) {
  return document.getElementById(id);
}

let coInputA = null;
let coInputB = null;
/** @type {string|null} saved `document.body.style.overflow` while logo-battle overlay is open */
let coLogoBattleSavedOverflow = null;

function apiBase() {
  const b = typeof window.COLLECTION_OVERLAP_API_BASE === "string" ? window.COLLECTION_OVERLAP_API_BASE.trim() : "";
  return b.replace(/\/+$/, "");
}

function buildOverlapUrl(contractA, contractB) {
  const root = apiBase();
  const path = `/api/collection-overlap?contractA=${encodeURIComponent(contractA)}&contractB=${encodeURIComponent(contractB)}`;
  return root ? `${root}${path}` : path;
}

/** Wrangler / Worker not running, blocked port, or offline — fetch() throws (Safari: "Load failed"). */
function messageForNetworkFailure(err, apiUrl) {
  const name = err?.name || "";
  const msg = String(err?.message || err || "").toLowerCase();
  const looksNetwork =
    name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("networkerror") ||
    msg.includes("could not connect") ||
    msg.includes("network request failed");
  if (!looksNetwork) return null;
  const host = (() => {
    try {
      return new URL(apiUrl).host;
    } catch {
      return "the API server";
    }
  })();
  return (
    `Cannot reach the API at ${host} (is the Worker running?).\n\n` +
    `Start it: open a terminal, cd into collection-overlap-api/, run npm run dev, then try Compare again.\n` +
    `(Production: set COLLECTION_OVERLAP_API_BASE to your workers.dev URL in index.html.)`
  );
}

/** Live Server / static hosts have no /api — explain 404 instead of a bare status. */
function messageForOverlapHttpError(res, data) {
  const base = apiBase();
  let msg = data?.error || `Request failed (${res.status})`;
  if (res.status === 404 && !base) {
    msg =
      "No /api/collection-overlap on this host (404). Static preview (e.g. Live Server) only serves HTML — the Worker must be called by URL.\n\n" +
      'In index.html, before app.js, set e.g.:\nwindow.COLLECTION_OVERLAP_API_BASE = "http://127.0.0.1:8787";\n' +
      "(Port 8787 is the default for wrangler dev — use your deployed workers.dev URL in production.)";
  }
  return msg;
}

function setLoading(isLoading, msg) {
  const btn = $("co-compare-btn");
  const st = $("co-status");
  const loader = $("co-global-loader");
  if (btn) btn.disabled = isLoading;
  if (st) st.textContent = msg || "";
  if (loader) {
    loader.hidden = !isLoading;
    loader.setAttribute("aria-hidden", isLoading ? "false" : "true");
  }
}

function fmtPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x.toFixed(2);
}

function truncLabel(s, max) {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}...`;
}

/** Human label for a collection from API metadata (fallback: Collection A/B). */
function collectionDisplayLabel(data, which) {
  const name = which === "A" ? data.collectionNameA : data.collectionNameB;
  const sym = which === "A" ? data.collectionSymbolA : data.collectionSymbolB;
  const fallback = which === "A" ? "Collection A" : "Collection B";
  if (name && sym) return `${name} (${sym})`;
  if (name) return String(name);
  if (sym) return String(sym);
  return fallback;
}

/** Short name for overlap lines (symbol if compact, else truncated name). */
function collectionShortTag(data, which) {
  const sym = which === "A" ? data.collectionSymbolA : data.collectionSymbolB;
  const name = which === "A" ? data.collectionNameA : data.collectionNameB;
  const s = sym && String(sym).trim() ? String(sym).trim() : "";
  if (s && s.length <= 10) return s;
  if (name && String(name).trim()) return truncLabel(String(name).trim(), 18);
  return which === "A" ? "A" : "B";
}

const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function setBlobBackground(which, url) {
  const el = $(`co-blob-bg-${which}`);
  if (!el) return;
  const u = url && String(url).trim();
  if (u) {
    el.style.backgroundImage = `url(${JSON.stringify(u)})`;
    el.classList.add("co-blob-bg--on");
  } else {
    el.style.backgroundImage = "";
    el.classList.remove("co-blob-bg--on");
  }
}

function setCollectionLogo(which, url, altText) {
  const img = $(`co-logo-${which}`);
  if (!img) return;
  const u = url && String(url).trim();
  if (u) {
    img.src = u;
    img.alt = altText || "Collection logo";
    img.hidden = false;
    img.classList.remove("co-blob-logo--hidden");
  } else {
    img.src = BLANK_PIXEL;
    img.alt = "";
    img.hidden = true;
    img.classList.add("co-blob-logo--hidden");
  }
  setBlobBackground(which, u || "");
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function resetLogoBattleUI() {
  const root = $("co-logo-battle");
  document.body.classList.remove("co-logo-battle-active");
  if (coLogoBattleSavedOverflow !== null) {
    document.body.style.overflow = coLogoBattleSavedOverflow;
    coLogoBattleSavedOverflow = null;
  }
  if (!root) return;
  ["co-lb--impact", "co-lb--flash", "co-lb--merge", "co-lb--merge-hold"].forEach((c) => root.classList.remove(c));
  root.classList.remove("is-open");
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  root.querySelector(".co-logo-battle__bolts")?.setAttribute("hidden", "");
  const imgA = $("logoA");
  const imgB = $("logoB");
  const merged = $("mergedLogo");
  if (imgA) {
    imgA.removeAttribute("src");
    imgA.alt = "";
    imgA.style.cssText = "";
  }
  if (imgB) {
    imgB.removeAttribute("src");
    imgB.alt = "";
    imgB.style.cssText = "";
  }
  if (merged) {
    merged.hidden = true;
    merged.style.opacity = "";
  }
  merged?.querySelectorAll(".co-logo-battle__merged-half").forEach((el) => {
    el.style.backgroundImage = "";
  });
}

/** @returns {{ left: number, top: number, width: number, height: number } | null} */
function getSlotLogoRect(slotId) {
  const slot = $(slotId);
  if (!slot) return null;
  const img = slot.querySelector(".co-ci-banner__logo");
  if (img && !img.hidden && img.getAttribute("src")) {
    const r = img.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) {
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
  }
  const banner = slot.querySelector(".co-ci-banner");
  if (banner) {
    const r = banner.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) {
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
  }
  return null;
}

/** Fallback start positions when banner logo rect is unavailable */
function fallbackLogoRect(side) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(130, w * 0.2);
  if (side === "a") {
    return { left: cx - s * 2.15, top: cy - s / 2, width: s, height: s };
  }
  return { left: cx + s * 1.05, top: cy - s / 2, width: s, height: s };
}

/**
 * Logo “crash” intro: fly from on-page squares → impact → flash → merged + ~2s lightning ring.
 * Caller runs overlap fetch in parallel; await this with fetch before showing UI (~3s).
 * @param {string} urlA
 * @param {string} urlB
 * @param {string|null} [nameA]
 * @param {string|null} [nameB]
 */
function runLogoBattleAnimation(urlA, urlB, nameA, nameB) {
  return new Promise((resolve) => {
    const root = $("co-logo-battle");
    const container = root?.querySelector(".logo-battle-container");
    const bolts = root?.querySelector(".co-logo-battle__bolts");
    const imgA = $("logoA");
    const imgB = $("logoB");
    const merged = $("mergedLogo");
    const halfA = merged?.querySelector(".co-logo-battle__merged-half--a");
    const halfB = merged?.querySelector(".co-logo-battle__merged-half--b");

    if (!root || !container || !imgA || !imgB || !merged || !halfA || !halfB) {
      resolve();
      return;
    }

    const ua = urlA && String(urlA).trim();
    const ub = urlB && String(urlB).trim();
    if (!ua || !ub) {
      resolve();
      return;
    }

    const toBgUrl = (u) => `url(${JSON.stringify(u)})`;
    halfA.style.backgroundImage = toBgUrl(ua);
    halfB.style.backgroundImage = toBgUrl(ub);

    imgA.alt = nameA ? `${nameA} logo` : "Collection A logo";
    imgB.alt = nameB ? `${nameB} logo` : "Collection B logo";
    imgA.src = ua;
    imgB.src = ub;

    merged.hidden = true;
    bolts?.setAttribute("hidden", "");
    imgA.style.cssText = "";
    imgB.style.cssText = "";

    const LB_FINAL = Math.min(320, Math.max(200, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.46)));
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const lastLeft = Math.round(cx - LB_FINAL / 2);
    const lastTop = Math.round(cy - LB_FINAL / 2);

    let rectA = getSlotLogoRect("co-slot-a");
    let rectB = getSlotLogoRect("co-slot-b");
    if (!rectA) rectA = fallbackLogoRect("a");
    if (!rectB) rectB = fallbackLogoRect("b");

    function prepFly(img, first) {
      img.style.position = "fixed";
      img.style.left = `${Math.round(first.left)}px`;
      img.style.top = `${Math.round(first.top)}px`;
      img.style.width = `${Math.round(first.width)}px`;
      img.style.height = `${Math.round(first.height)}px`;
      img.style.zIndex = "802";
      img.style.objectFit = "contain";
      img.style.margin = "0";
      img.style.padding = "0";
      img.style.border = "none";
      img.style.transition = "none";
      img.style.transform = "none";
      img.style.opacity = "1";
    }

    prepFly(imgA, rectA);
    prepFly(imgB, rectB);

    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.classList.add("is-open");
    document.body.classList.add("co-logo-battle-active");
    if (coLogoBattleSavedOverflow === null) {
      coLogoBattleSavedOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = "hidden";

    const flyMs = 560;
    const ease = "cubic-bezier(0.34, 1.28, 0.52, 1)";
    const tr = `left ${flyMs}ms ${ease}, top ${flyMs}ms ${ease}, width ${flyMs}ms ${ease}, height ${flyMs}ms ${ease}`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        imgA.style.transition = tr;
        imgB.style.transition = tr;
        imgA.style.left = `${lastLeft}px`;
        imgA.style.top = `${lastTop}px`;
        imgA.style.width = `${LB_FINAL}px`;
        imgA.style.height = `${LB_FINAL}px`;
        imgB.style.left = `${lastLeft}px`;
        imgB.style.top = `${lastTop}px`;
        imgB.style.width = `${LB_FINAL}px`;
        imgB.style.height = `${LB_FINAL}px`;
      });
    });

    const T_IMPACT = flyMs;
    const T_FLASH = T_IMPACT + 200;
    const T_MERGE = T_FLASH + 280;
    const holdMs = 2000;
    const T_DONE = T_MERGE + holdMs;

    window.setTimeout(() => {
      imgA.style.transition = "";
      imgB.style.transition = "";
      root.classList.add("co-lb--impact");
    }, T_IMPACT);

    window.setTimeout(() => {
      root.classList.remove("co-lb--impact");
      root.classList.add("co-lb--flash");
    }, T_FLASH);

    window.setTimeout(() => {
      root.classList.remove("co-lb--flash");
      imgA.style.opacity = "0";
      imgB.style.opacity = "0";
      root.classList.add("co-lb--merge");
      root.classList.add("co-lb--merge-hold");
      merged.hidden = false;
      bolts?.removeAttribute("hidden");
    }, T_MERGE);

    window.setTimeout(() => {
      resetLogoBattleUI();
      resolve();
    }, T_DONE);
  });
}

function renderResults(data) {
  const sec = $("co-results");
  if (!sec) return;
  sec.classList.remove("hidden");
  sec.setAttribute("aria-hidden", "false");

  $("co-count-a").textContent = String(data.holderCountA ?? 0);
  $("co-count-b").textContent = String(data.holderCountB ?? 0);
  $("co-count-shared").textContent = String(data.sharedHolderCount ?? 0);

  const labelA = collectionDisplayLabel(data, "A");
  const labelB = collectionDisplayLabel(data, "B");
  $("co-name-a").textContent = labelA;
  $("co-name-b").textContent = labelB;
  setCollectionLogo("a", data.collectionLogoUrlA, labelA);
  setCollectionLogo("b", data.collectionLogoUrlB, labelB);

  const tagA = collectionShortTag(data, "A");
  const tagB = collectionShortTag(data, "B");
  const pa = Number(data.percentOfAHoldingB);
  const pb = Number(data.percentOfBHoldingA);

  const pctA = $("co-hold-pct-a");
  const pctB = $("co-hold-pct-b");
  if (pctA) pctA.textContent = `${fmtPct(pa)}%`;
  if (pctB) pctB.textContent = `${fmtPct(pb)}%`;

  const descA = $("co-hold-desc-a");
  const descB = $("co-hold-desc-b");
  if (descA) descA.textContent = `${tagA} holders also hold ${tagB}`;
  if (descB) descB.textContent = `${tagB} holders also hold ${tagA}`;

  const match = Number(data.matchScore);
  $("co-match").textContent = `${fmtPct(match)}%`;

  const shared = Number(data.sharedHolderCount);
  const sharedEl = $("co-match-shared");
  if (sharedEl) {
    sharedEl.textContent = Number.isFinite(shared) ? `${shared.toLocaleString()} shared wallets` : "—";
  }

  const q = $("co-quality");
  q.classList.remove("co-quality--full", "co-quality--capped");
  if (data.dataQuality === "capped") {
    q.classList.add("co-quality--capped");
    q.textContent = "Partial scan — holder cap hit (OVERLAP_MAX_HOLDERS on Worker)";
  } else {
    q.classList.add("co-quality--full");
    q.textContent = "Full holder scan";
  }
}

async function onCompare() {
  if (!coInputA || !coInputB) {
    setLoading(false, "Inputs are not ready. Refresh the page.");
    return;
  }

  coInputA.clearInlineError();
  coInputB.clearInlineError();

  const va = coInputA.getValue();
  const vb = coInputB.getValue();
  const a = va.contractAddress;
  const b = vb.contractAddress;

  let blocked = false;
  if (!a) {
    coInputA.setCompareEmptyError("Please select a valid collection");
    blocked = true;
  }
  if (!b) {
    coInputB.setCompareEmptyError("Please select a valid collection");
    blocked = true;
  }
  if (blocked) {
    coInputA.revalidateDraft();
    coInputB.revalidateDraft();
    setLoading(false, "");
    return;
  }

  if (a === b) {
    coInputA.setCompareEmptyError("Choose two different collections.");
    coInputB.setCompareEmptyError("Choose two different collections.");
    setLoading(false, "");
    return;
  }

  setLoading(true, "Scanning holder overlap…");
  $("co-results")?.classList.add("hidden");

  const apiUrl = buildOverlapUrl(a, b);
  const logoA = typeof coInputA.getLogoUrl === "function" ? coInputA.getLogoUrl() : null;
  const logoB = typeof coInputB.getLogoUrl === "function" ? coInputB.getLogoUrl() : null;
  const useBattleAnim = Boolean(logoA && logoB) && !prefersReducedMotion();

  const fetchResultP = fetch(apiUrl, { method: "GET" })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, err: new Error(messageForOverlapHttpError(res, data)) };
      }
      if (!data?.success) {
        return { ok: false, err: new Error(data?.error || "Unexpected response") };
      }
      return { ok: true, data };
    })
    .catch((e) => {
      const net = messageForNetworkFailure(e, apiUrl);
      return { ok: false, err: net ? new Error(net) : e };
    });

  const animPromise = useBattleAnim ? runLogoBattleAnimation(logoA, logoB, va.name, vb.name) : Promise.resolve();

  const [, fr] = await Promise.all([animPromise, fetchResultP]);

  if (!fr.ok) {
    console.error("[CollectionOverlap]", fr.err);
    setLoading(false, fr.err?.message || "Something went wrong. Try again.");
    return;
  }
  setLoading(false, "");
  renderResults(fr.data);
}

document.addEventListener("DOMContentLoaded", () => {
  const slotA = $("co-slot-a");
  const slotB = $("co-slot-b");
  if (slotA && slotB && typeof window.CollectionInput === "function") {
    coInputA = new window.CollectionInput(slotA);
    coInputB = new window.CollectionInput(slotB);
  }
  $("co-compare-btn")?.addEventListener("click", () => void onCompare());

  const contactDlg = $("co-contact-dialog");
  const contactBtn = $("co-contact-info-btn");
  const contactClose = $("co-contact-dialog-close");
  contactBtn?.addEventListener("click", () => contactDlg?.showModal());
  contactClose?.addEventListener("click", () => contactDlg?.close());
  contactDlg?.addEventListener("click", (e) => {
    if (e.target === contactDlg) contactDlg.close();
  });
});
