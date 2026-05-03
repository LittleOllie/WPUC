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
  if (btn) btn.disabled = isLoading;
  if (st) st.textContent = msg || "";
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

function setMatchFace(which, url, altText) {
  const img = $(`co-match-logo-${which}`);
  if (!img) return;
  const u = url && String(url).trim();
  if (u) {
    img.src = u;
    img.alt = altText || "";
    img.hidden = false;
    img.classList.remove("co-match-face--hidden");
  } else {
    img.src = BLANK_PIXEL;
    img.alt = "";
    img.hidden = true;
    img.classList.add("co-match-face--hidden");
  }
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

  const match = Number(data.matchScore);
  $("co-match").textContent = `${fmtPct(match)}%`;

  const shared = Number(data.sharedHolderCount);
  const sub = $("co-match-sub");
  if (sub) {
    sub.textContent = Number.isFinite(shared)
      ? `${shared.toLocaleString()} shared wallets`
      : "—";
  }

  $("co-match-name-a").textContent = truncLabel(labelA, 32);
  $("co-match-name-b").textContent = truncLabel(labelB, 32);
  setMatchFace("a", data.collectionLogoUrlA, labelA);
  setMatchFace("b", data.collectionLogoUrlB, labelB);

  const pa = Number(data.percentOfAHoldingB);
  const pb = Number(data.percentOfBHoldingA);
  const shortA = truncLabel(labelA, 28);
  const shortB = truncLabel(labelB, 28);
  const foot = $("co-match-foot");
  if (foot) {
    foot.textContent = `${fmtPct(pa)}% of ${shortA} holders also hold ${shortB} · ${fmtPct(pb)}% of ${shortB} holders also hold ${shortA}`;
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

  const times = $("co-times");
  if (times) {
    times.textContent = `Last scanned — A: ${data.fetchedAtA || "—"} · B: ${data.fetchedAtB || "—"}`;
  }

  window.__CO_LAST__ = data;
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

  const url = buildOverlapUrl(a, b);
  try {
    const res = await fetch(url, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(messageForOverlapHttpError(res, data));
    }
    if (!data?.success) {
      throw new Error(data?.error || "Unexpected response");
    }
    setLoading(false, "");
    renderResults(data);
  } catch (e) {
    console.error("[CollectionOverlap]", e);
    const net = messageForNetworkFailure(e, url);
    setLoading(false, net || e?.message || "Something went wrong. Try again.");
  }
}

function copyText(text) {
  const t = String(text || "");
  if (!t) return;
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(t);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = t;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    ta.remove();
  }
}

function onCopyTweet() {
  const d = window.__CO_LAST__;
  if (!d) return;
  const pageUrl = window.location.href.split("#")[0];
  const la = collectionDisplayLabel(d, "A");
  const lb = collectionDisplayLabel(d, "B");
  const msg =
    `I just compared two NFT communities on Little Ollie Labs 🧬\n` +
    `${la}: ${d.holderCountA} holders\n` +
    `${lb}: ${d.holderCountB} holders\n` +
    `Shared holders: ${d.sharedHolderCount}\n` +
    `Match score: ${fmtPct(d.matchScore)}%\n` +
    `Try it here: ${pageUrl}`;
  copyText(msg);
  setLoading(false, "Copied summary to clipboard.");
}

document.addEventListener("DOMContentLoaded", () => {
  const slotA = $("co-slot-a");
  const slotB = $("co-slot-b");
  if (slotA && slotB && typeof window.CollectionInput === "function") {
    coInputA = new window.CollectionInput(slotA);
    coInputB = new window.CollectionInput(slotB);
  }
  $("co-compare-btn")?.addEventListener("click", () => void onCompare());
  $("co-copy-tweet")?.addEventListener("click", onCopyTweet);
});
