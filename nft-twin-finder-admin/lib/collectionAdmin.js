import {
  loadCollectionIndex,
  loadCollectionMeta,
  loadFullCollectionFile,
} from "../../nft-twin-finder/lib/collections.js";
import {
  DEFAULT_WEIGHTS,
  WEIGHT_PROFILE_CUSTOM,
  WEIGHT_PROFILE_DEFAULT,
  describeWeightProfile,
  resolveWeights,
  sumWeights,
  validateWeights,
  weightsForProfile,
} from "../../nft-twin-finder/lib/weightProfiles.js";
import { TRAIT_CATEGORIES } from "../../nft-twin-finder/lib/traitCategories.js";
import { buildSimilarityIndexAsync } from "./similarityEngine.js";
import { exportCollectionPackage } from "./exportPackage.js";

function formatDate(iso) {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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

/**
 * @param {HTMLElement} root
 */
export function initCollectionAdmin(root) {
  const listEl = root.querySelector("#collections-list");
  const modalEl = root.querySelector("#collection-modal");
  const modalTitle = root.querySelector("#collection-modal-title");
  const modalBody = root.querySelector("#collection-modal-body");
  const modalClose = root.querySelector("#collection-modal-close");
  const progressEl = root.querySelector("#collection-progress");
  const progressLabel = root.querySelector("#collection-progress-label");
  const progressBar = root.querySelector("#collection-progress-bar");

  /** @type {Array<{ slug: string, name: string }>} */
  let indexEntries = [];
  /** @type {Map<string, Record<string, unknown>>} */
  const metaCache = new Map();

  function setProgress(visible, label = "", pct = 0) {
    progressEl.hidden = !visible;
    progressLabel.textContent = label;
    progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  function openModal(title, bodyHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalEl.hidden = false;
  }

  function closeModal() {
    modalEl.hidden = true;
    modalBody.innerHTML = "";
  }

  modalClose?.addEventListener("click", closeModal);
  modalEl?.addEventListener("click", (event) => {
    if (event.target === modalEl) closeModal();
  });

  async function getMeta(slug) {
    if (metaCache.has(slug)) return metaCache.get(slug);
    const meta = await loadCollectionMeta(slug);
    metaCache.set(slug, meta);
    return meta;
  }

  async function countTokens(slug, meta) {
    if (meta?.supply) return Number(meta.supply);
    try {
      const metadata = await loadFullCollectionFile(slug, "metadata");
      return Object.keys(metadata).length;
    } catch {
      return 0;
    }
  }

  function importStatus(meta, tokenCount) {
    if (!tokenCount) return { label: "Missing data", tone: "warn" };
    if (meta?.similarityCalculatedAt) return { label: "Imported", tone: "ok" };
    return { label: "Needs recalc", tone: "warn" };
  }

  async function renderList() {
    listEl.innerHTML = `<p class="ntf-admin-lead">Loading collections…</p>`;
    indexEntries = await loadCollectionIndex();

    const rows = await Promise.all(
      indexEntries.map(async (entry) => {
        const meta = await getMeta(entry.slug);
        const tokenCount = await countTokens(entry.slug, meta);
        const status = importStatus(meta, tokenCount);
        return { entry, meta, tokenCount, status };
      }),
    );

    listEl.innerHTML = `
      <div class="ntf-collections-table-wrap">
        <table class="ntf-collections-table">
          <thead>
            <tr>
              <th>Collection</th>
              <th>NFTs</th>
              <th>Status</th>
              <th>Weights</th>
              <th>Last calculated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                ({ entry, meta, tokenCount, status }) => `
              <tr data-slug="${entry.slug}">
                <td><strong>${meta.name || entry.name}</strong><br><code>${entry.slug}</code></td>
                <td>${tokenCount.toLocaleString()}</td>
                <td><span class="ntf-collections-status ntf-collections-status--${status.tone}">${status.label}</span></td>
                <td>${describeWeightProfile(meta)}</td>
                <td>${formatDate(meta.similarityCalculatedAt)}</td>
                <td class="ntf-collections-actions">
                  <button type="button" class="ntf-btn ntf-btn--ghost ntf-btn--sm" data-action="details" data-slug="${entry.slug}">Details</button>
                  <button type="button" class="ntf-btn ntf-btn--ghost ntf-btn--sm" data-action="weights" data-slug="${entry.slug}">Weights</button>
                  <button type="button" class="ntf-btn ntf-btn--primary ntf-btn--sm" data-action="recalc" data-slug="${entry.slug}">Recalculate</button>
                  <button type="button" class="ntf-btn ntf-btn--ghost ntf-btn--sm" data-action="export" data-slug="${entry.slug}">Export</button>
                  <button type="button" class="ntf-btn ntf-btn--ghost ntf-btn--sm ntf-btn--danger" data-action="delete" data-slug="${entry.slug}">Delete</button>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderWeightEditor(meta) {
    const profile = meta.weightProfile || WEIGHT_PROFILE_DEFAULT;
    const weights = profile === WEIGHT_PROFILE_CUSTOM ? resolveWeights(meta) : { ...DEFAULT_WEIGHTS };

    return `
      <div class="ntf-weight-profile">
        <fieldset class="ntf-weight-profile__toggle">
          <label>
            <input type="radio" name="weight-profile" value="${WEIGHT_PROFILE_DEFAULT}" ${profile === WEIGHT_PROFILE_DEFAULT ? "checked" : ""} />
            Default Profile
          </label>
          <label>
            <input type="radio" name="weight-profile" value="${WEIGHT_PROFILE_CUSTOM}" ${profile === WEIGHT_PROFILE_CUSTOM ? "checked" : ""} />
            Custom Profile
          </label>
        </fieldset>
        <div id="weight-editor-grid" class="ntf-weight-grid ${profile === WEIGHT_PROFILE_DEFAULT ? "ntf-weight-grid--readonly" : ""}"></div>
        <p id="weight-editor-total" class="ntf-weight-total"></p>
        <p id="weight-editor-warning" class="ntf-weight-warning" hidden></p>
        <div class="ntf-btn-row">
          <button type="button" id="weight-editor-save" class="ntf-btn ntf-btn--accent">Save profile &amp; download collection.json</button>
          <button type="button" id="weight-editor-recalc" class="ntf-btn ntf-btn--primary">Save &amp; recalculate similarities</button>
        </div>
        <p class="ntf-admin-lead">Replace <code>collection.json</code> in the collection folder, then recalculate if you only saved the profile.</p>
      </div>
    `;
  }

  function bindWeightEditor(slug, meta) {
    const grid = modalBody.querySelector("#weight-editor-grid");
    const totalEl = modalBody.querySelector("#weight-editor-total");
    const warningEl = modalBody.querySelector("#weight-editor-warning");
    const saveBtn = modalBody.querySelector("#weight-editor-save");
    const recalcBtn = modalBody.querySelector("#weight-editor-recalc");
    const radios = modalBody.querySelectorAll('input[name="weight-profile"]');

    let profile = meta.weightProfile || WEIGHT_PROFILE_DEFAULT;
    let weights = { ...resolveWeights(meta) };

    function currentProfile() {
      return modalBody.querySelector('input[name="weight-profile"]:checked')?.value || WEIGHT_PROFILE_DEFAULT;
    }

    function paintGrid() {
      profile = currentProfile();
      const editable = profile === WEIGHT_PROFILE_CUSTOM;
      grid.classList.toggle("ntf-weight-grid--readonly", !editable);

      if (profile === WEIGHT_PROFILE_DEFAULT) {
        weights = { ...DEFAULT_WEIGHTS };
      }

      grid.innerHTML = TRAIT_CATEGORIES.map(
        (category) => `
        <div class="ntf-weight-row">
          <label class="ntf-field__label" for="cm-weight-${category}">${category}</label>
          <input
            id="cm-weight-${category}"
            class="ntf-input"
            type="number"
            min="0"
            max="100"
            value="${weights[category]}"
            data-category="${category}"
            ${editable ? "" : "readonly"}
          />
        </div>
      `,
      ).join("");

      if (editable) {
        grid.querySelectorAll("input[data-category]").forEach((input) => {
          input.addEventListener("input", () => {
            weights[input.dataset.category] = Number(input.value) || 0;
            updateTotal();
          });
        });
      }

      updateTotal();
    }

    function updateTotal() {
      const activeProfile = currentProfile();
      const activeWeights =
        activeProfile === WEIGHT_PROFILE_CUSTOM
          ? weights
          : weightsForProfile(WEIGHT_PROFILE_DEFAULT);
      const total = sumWeights(activeWeights);
      const check = validateWeights(activeWeights);
      totalEl.textContent = `Total: ${total}%`;
      totalEl.classList.toggle("ntf-weight-total--invalid", !check.valid && activeProfile === WEIGHT_PROFILE_CUSTOM);
      warningEl.hidden = check.valid || activeProfile === WEIGHT_PROFILE_DEFAULT;
      warningEl.textContent = check.errors[0] || "";
      const disabled = activeProfile === WEIGHT_PROFILE_CUSTOM && !check.valid;
      saveBtn.disabled = disabled;
      recalcBtn.disabled = disabled;
    }

    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (currentProfile() === WEIGHT_PROFILE_DEFAULT) {
          weights = { ...DEFAULT_WEIGHTS };
        }
        paintGrid();
      });
    });

    paintGrid();

    function buildUpdatedCollection() {
      const activeProfile = currentProfile();
      const updated = { ...meta, weightProfile: activeProfile };
      if (activeProfile === WEIGHT_PROFILE_CUSTOM) {
        updated.traitWeights = { ...weights };
      } else {
        delete updated.traitWeights;
      }
      return updated;
    }

    saveBtn.addEventListener("click", () => {
      const updated = buildUpdatedCollection();
      downloadJson("collection.json", updated);
      metaCache.set(slug, updated);
      closeModal();
      renderList();
    });

    recalcBtn.addEventListener("click", async () => {
      const updated = buildUpdatedCollection();
      closeModal();
      await runRecalculate(slug, updated);
    });
  }

  async function showDetails(slug) {
    const meta = await getMeta(slug);
    const tokenCount = await countTokens(slug, meta);
    const weights = resolveWeights(meta);

    openModal(
      meta.name || slug,
      `
      <dl class="ntf-details-list">
        <dt>Slug</dt><dd><code>${slug}</code></dd>
        <dt>Total NFTs</dt><dd>${tokenCount.toLocaleString()}</dd>
        <dt>Weight profile</dt><dd>${describeWeightProfile(meta)}</dd>
        <dt>Last calculated</dt><dd>${formatDate(meta.similarityCalculatedAt)}</dd>
        ${meta.contract ? `<dt>Contract</dt><dd><code>${meta.contract}</code></dd>` : ""}
        ${meta.network ? `<dt>Network</dt><dd>${meta.network}</dd>` : ""}
      </dl>
      <h3 class="ntf-section-head">Active weights</h3>
      <ul class="ntf-weight-summary">
        ${TRAIT_CATEGORIES.map((c) => `<li>${c}: <strong>${weights[c]}%</strong></li>`).join("")}
      </ul>
    `,
    );
  }

  async function showWeightEditor(slug) {
    const meta = await getMeta(slug);
    openModal(`Edit weights — ${meta.name || slug}`, renderWeightEditor(meta));
    bindWeightEditor(slug, meta);
  }

  async function runRecalculate(slug, collectionOverride = null) {
    const meta = collectionOverride || (await getMeta(slug));
    const weights = resolveWeights(meta);

    setProgress(true, `Loading metadata for ${slug}…`, 5);
    const metadata = await loadFullCollectionFile(slug, "metadata");
    const tokenCount = Object.keys(metadata).length;

    setProgress(true, `Calculating similarities (0/${tokenCount})…`, 10);
    const similarity = await buildSimilarityIndexAsync(metadata, weights, 5, {
      onProgress: (done, total) => {
        const pct = 10 + Math.round((done / total) * 85);
        setProgress(true, `Calculating similarities (${done}/${total})…`, pct);
      },
    });

    const updatedCollection = {
      ...meta,
      similarityCalculatedAt: new Date().toISOString(),
    };

    setProgress(true, "Downloading updated files…", 98);
    downloadJson("similarity.json", similarity);
    await new Promise((r) => setTimeout(r, 400));
    downloadJson("collection.json", updatedCollection);

    metaCache.set(slug, updatedCollection);
    setProgress(true, "Complete — replace files in collection folder", 100);
    await renderList();
    window.setTimeout(() => setProgress(false), 2500);
  }

  async function runExport(slug) {
    const meta = await getMeta(slug);
    setProgress(true, `Loading ${slug} package…`, 10);
    const [metadata, images, similarity] = await Promise.all([
      loadFullCollectionFile(slug, "metadata"),
      loadFullCollectionFile(slug, "images"),
      loadFullCollectionFile(slug, "similarity"),
    ]);
    setProgress(true, "Exporting files…", 80);
    await exportCollectionPackage(slug, meta, metadata, images, similarity);
    setProgress(true, "Export complete", 100);
    window.setTimeout(() => setProgress(false), 2000);
  }

  function showDelete(slug) {
    const entry = indexEntries.find((e) => e.slug === slug);
    openModal(
      `Delete ${entry?.name || slug}`,
      `
      <p class="ntf-admin-lead">
        Static admin cannot delete files on disk. Remove the folder manually:
      </p>
      <pre class="ntf-log">rm -rf nft-twin-finder/collections/${slug}/</pre>
      <p class="ntf-admin-lead">Then remove this entry from <code>nft-twin-finder/collections/index.json</code>:</p>
      <pre class="ntf-log">${JSON.stringify({ slug }, null, 2)}</pre>
      <button type="button" class="ntf-btn ntf-btn--ghost" id="copy-delete-cmd">Copy rm command</button>
    `,
    );

    modalBody.querySelector("#copy-delete-cmd")?.addEventListener("click", async () => {
      const cmd = `rm -rf nft-twin-finder/collections/${slug}/`;
      try {
        await navigator.clipboard.writeText(cmd);
      } catch {
        /* ignore */
      }
    });
  }

  listEl.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, slug } = button.dataset;
    if (!slug) return;

    button.disabled = true;
    try {
      if (action === "details") await showDetails(slug);
      else if (action === "weights") await showWeightEditor(slug);
      else if (action === "recalc") await runRecalculate(slug);
      else if (action === "export") await runExport(slug);
      else if (action === "delete") showDelete(slug);
    } catch (error) {
      openModal("Error", `<p class="ntf-admin-lead">${error?.message || "Action failed"}</p>`);
    } finally {
      button.disabled = false;
    }
  });

  renderList().catch((error) => {
    listEl.innerHTML = `<p class="ntf-admin-lead">Failed to load collections: ${error?.message || error}</p>`;
  });
}
