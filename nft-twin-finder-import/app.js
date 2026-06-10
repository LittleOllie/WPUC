import { buildImportResult } from "./lib/mergeImport.js?v=3";

const networkSelect = document.getElementById("network");
const contractInput = document.getElementById("contract");
const importBtn = document.getElementById("import-btn");
const statusEl = document.getElementById("status");
const statusLabel = document.getElementById("status-label");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");

const outName = document.getElementById("out-name");
const outSupply = document.getElementById("out-supply");
const outCount = document.getElementById("out-count");
const outSource = document.getElementById("out-source");
const outUri = document.getElementById("out-uri");
const outPattern = document.getElementById("out-pattern");
const samplesEl = document.getElementById("samples");
const dlMetadata = document.getElementById("dl-metadata");
const dlImages = document.getElementById("dl-images");
const apiStatusEl = document.getElementById("api-status");

/** @type {Record<string, unknown> | null} */
let lastResult = null;

function apiBase() {
  return String(window.NTF_IMPORT_API_BASE || "").replace(/\/$/, "");
}

function setStatus(message) {
  statusEl.hidden = false;
  statusLabel.textContent = message;
}

function setError(message) {
  if (!message) {
    errorEl.hidden = true;
    errorEl.textContent = "";
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderSamples(samples) {
  samplesEl.innerHTML = samples
    .map((s) => {
      const traitLine = Object.entries(s.traits || {})
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
      return `
        <article class="ntf-sample-card">
          <div class="ntf-sample-thumb">
            ${s.image ? `<img src="${escapeAttr(s.image)}" alt="" loading="lazy" />` : ""}
          </div>
          <div>
            <div class="ntf-sample-title">${escapeHtml(s.name)}</div>
            <div class="ntf-sample-id">#${escapeHtml(s.tokenId)}</div>
            <div class="ntf-sample-traits">${escapeHtml(traitLine || "No traits")}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderResults(data) {
  outName.textContent = data.collectionName || "—";
  outSupply.textContent = String(data.totalSupply ?? "—");
  outCount.textContent = data.cappedAt
    ? `${data.importedCount} (capped at ${data.cappedAt})`
    : String(data.importedCount ?? "—");

  const src = data.metadataSource || {};
  outSource.textContent = `${src.type || "unknown"} — ${src.description || ""}`;
  outUri.textContent = src.sampleTokenUri || "—";
  outPattern.textContent = src.pattern || "—";

  renderSamples(data.samples || []);
  resultsEl.hidden = false;
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(v) {
  return escapeHtml(v).replace(/"/g, "&quot;");
}

async function fetchImportChunk(network, contract, pageKey, importLimit, imported) {
  const params = new URLSearchParams({ network, contract });
  if (pageKey) params.set("pageKey", pageKey);
  if (importLimit) params.set("importLimit", String(importLimit));
  if (imported) params.set("imported", String(imported));

  const res = await fetch(`${apiBase()}/api/import-collection?${params}`);
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Import failed (${res.status})`);
  }
  return data;
}

function isLegacyImportResponse(data) {
  return Boolean(
    data?.metadata &&
      data?.images &&
      typeof data.metadata === "object" &&
      !data.chunkRecords,
  );
}

async function importCollectionChunked(network, contract) {
  const allRecords = [];
  let pageKey = null;
  let importLimit = 0;
  let meta = { network, contract };

  while (true) {
    const chunk = await fetchImportChunk(
      network,
      contract,
      pageKey,
      importLimit,
      allRecords.length,
    );

    /* Older worker returned everything in one response */
    if (isLegacyImportResponse(chunk)) {
      return chunk;
    }

    if (chunk.collectionName) {
      meta = {
        ...meta,
        collectionName: chunk.collectionName,
        symbol: chunk.symbol,
        totalSupply: chunk.totalSupply,
        tokenStandard: chunk.tokenStandard,
      };
    }

    importLimit = chunk.importLimit || importLimit;

    const records = Array.isArray(chunk.chunkRecords) ? chunk.chunkRecords : [];
    allRecords.push(...records);

    const target = meta.totalSupply || importLimit || "?";
    setStatus(`Downloading metadata… ${allRecords.length} / ${target}`);

    if (chunk.complete) break;
    if (!chunk.nextPageKey) break;
    pageKey = chunk.nextPageKey;
  }

  if (!allRecords.length) {
    throw new Error(
      "No tokens imported. Push the latest nft-twin-finder-import/ files and redeploy the worker.",
    );
  }

  return buildImportResult({ ...meta, importLimit }, allRecords);
}

async function checkApiConnection() {
  const base = apiBase();
  if (!base) {
    apiStatusEl.textContent = "API URL not configured.";
    apiStatusEl.className = "ntf-api-status is-bad";
    return false;
  }

  try {
    const res = await fetch(`${base}/api/health`);
    const data = await res.json();
    if (res.ok && data.ok) {
      const mode = data.chunked ? "chunked import" : "legacy import";
      apiStatusEl.textContent = `Connected to ${base} (${mode})`;
      apiStatusEl.className = "ntf-api-status is-ok";
      importBtn.disabled = false;
      return true;
    }
    throw new Error("Health check failed");
  } catch {
    apiStatusEl.textContent = `Cannot reach ${base} — push latest site files or run wrangler dev locally`;
    apiStatusEl.className = "ntf-api-status is-bad";
    importBtn.disabled = true;
    return false;
  }
}

void checkApiConnection();

importBtn.addEventListener("click", async () => {
  setError("");
  resultsEl.hidden = true;
  lastResult = null;

  const network = networkSelect.value;
  const contract = contractInput.value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
    setError("Enter a valid contract address (0x + 40 hex chars).");
    return;
  }

  importBtn.disabled = true;

  try {
    if (!apiBase()) throw new Error("Import API base URL is not configured.");

    setStatus("Reading contract…");
    lastResult = await importCollectionChunked(network, contract);
    setStatus("Import complete");
    renderResults(lastResult);
  } catch (e) {
    setStatus("Import failed");
    const msg = e?.message || "";
    if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
      setError(
        `Cannot reach the import API at ${apiBase()}. Redeploy the worker after pulling latest code.`,
      );
    } else {
      setError(msg || "Import failed.");
    }
  } finally {
    importBtn.disabled = false;
  }
});

function downloadOrWarn(filename, data) {
  if (!data || !Object.keys(data).length) {
    setError(`No ${filename} data — re-import after pushing latest importer files.`);
    return;
  }
  setError("");
  downloadJson(filename, data);
}

dlMetadata.addEventListener("click", () => {
  downloadOrWarn("metadata.json", lastResult?.metadata);
});

dlImages.addEventListener("click", () => {
  downloadOrWarn("images.json", lastResult?.images);
});
