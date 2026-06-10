import {
  DEFAULT_WEIGHTS,
  TRAIT_CATEGORIES,
} from "../nft-twin-finder/lib/traitNormalizer.js";
import { buildCollectionPackage } from "./lib/buildPackage.js";
import {
  buildIndexSnippet,
  exportCollectionPackage,
} from "./lib/exportPackage.js";
import {
  parseMetadataFile,
  parseMetadataFolder,
} from "./lib/metadataParser.js";

const weightGrid = document.getElementById("weight-grid");
const jsonFileInput = document.getElementById("json-file");
const folderInput = document.getElementById("folder-files");
const jsonFileName = document.getElementById("json-file-name");
const folderFileName = document.getElementById("folder-file-name");
const buildBtn = document.getElementById("build-btn");
const exportBtn = document.getElementById("export-btn");
const exportBlock = document.getElementById("export-block");
const logEl = document.getElementById("log");
const statsEl = document.getElementById("stats");
const indexSnippet = document.getElementById("index-snippet");
const copyIndexBtn = document.getElementById("copy-index-btn");
const deploySlug = document.getElementById("deploy-slug");
const statusEl = document.getElementById("status");
const statusLabel = document.getElementById("status-label");
const statusSteps = document.getElementById("status-steps");

const fields = {
  name: document.getElementById("name"),
  slug: document.getElementById("slug"),
};

/** @type {ReturnType<typeof buildCollectionPackage> | null} */
let packageState = null;
let weights = { ...DEFAULT_WEIGHTS };

const BUILD_STEPS = [
  "Reading uploaded metadata",
  "Normalizing traits & images",
  "Calculating similarity scores",
  "Package ready",
];

function log(message) {
  logEl.hidden = false;
  logEl.textContent += `${message}\n`;
}

function clearLog() {
  logEl.textContent = "";
  logEl.hidden = true;
}

function setStatus(stepIndex, label) {
  statusEl.hidden = false;
  statusLabel.textContent = label;
  statusSteps.innerHTML = BUILD_STEPS.map((step, i) => {
    let state = "pending";
    if (i < stepIndex) state = "done";
    if (i === stepIndex) state = "active";
    return `<li class="ntf-status__step ntf-status__step--${state}">${step}</li>`;
  }).join("");
}

function renderWeightInputs() {
  weightGrid.innerHTML = TRAIT_CATEGORIES.map(
    (category) => `
      <div class="ntf-weight-row">
        <label class="ntf-field__label" for="weight-${category}">${category}</label>
        <input
          id="weight-${category}"
          class="ntf-input"
          type="number"
          min="0"
          max="100"
          value="${weights[category]}"
          data-category="${category}"
        />
      </div>
    `,
  ).join("");

  weightGrid.querySelectorAll("input[data-category]").forEach((input) => {
    input.addEventListener("change", () => {
      weights[input.dataset.category] = Number(input.value) || 0;
    });
  });
}

function readWeightsFromUI() {
  weightGrid.querySelectorAll("input[data-category]").forEach((input) => {
    weights[input.dataset.category] = Number(input.value) || 0;
  });
  return { ...weights };
}

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function guessNameFromItems(items) {
  const first = items.find((item) => item && typeof item === "object");
  if (!first) return "";
  if (typeof first.collection === "string") return first.collection;
  if (first.name) {
    return String(first.name).replace(/\s*#\d+.*$/i, "").trim();
  }
  return "";
}

fields.name.addEventListener("input", () => {
  if (!fields.slug.dataset.touched) {
    fields.slug.value = slugify(fields.name.value);
  }
});

fields.slug.addEventListener("input", () => {
  fields.slug.dataset.touched = "1";
});

jsonFileInput.addEventListener("change", () => {
  folderInput.value = "";
  folderFileName.hidden = true;
  const file = jsonFileInput.files?.[0];
  if (!file) {
    jsonFileName.hidden = true;
    return;
  }
  jsonFileName.hidden = false;
  jsonFileName.textContent = file.name;
});

folderInput.addEventListener("change", () => {
  jsonFileInput.value = "";
  jsonFileName.hidden = true;
  const count = folderInput.files?.length || 0;
  if (!count) {
    folderFileName.hidden = true;
    return;
  }
  folderFileName.hidden = false;
  folderFileName.textContent = `${count} file(s) selected`;
});

async function loadUploadedMetadata() {
  if (jsonFileInput.files?.[0]) {
    return parseMetadataFile(jsonFileInput.files[0]);
  }
  if (folderInput.files?.length) {
    return parseMetadataFolder(folderInput.files);
  }
  return null;
}

function renderStats(tokenCount, missingImages) {
  statsEl.hidden = false;
  statsEl.innerHTML = `
    <span class="ntf-stat-pill">${tokenCount} tokens</span>
    <span class="ntf-stat-pill">Top 5 twins each</span>
    ${missingImages > 0 ? `<span class="ntf-stat-pill ntf-stat-pill--warn">${missingImages} missing images</span>` : ""}
  `;
}

buildBtn.addEventListener("click", async () => {
  clearLog();
  packageState = null;
  exportBlock.hidden = true;
  buildBtn.disabled = true;

  try {
    if (!fields.name.value.trim()) {
      log("Enter a collection name.");
      setStatus(0, "Missing collection name");
      return;
    }

    setStatus(0, "Reading uploaded metadata…");
    const items = await loadUploadedMetadata();
    if (!items?.length) {
      log("Upload a metadata JSON file or folder first.");
      setStatus(0, "No metadata uploaded");
      return;
    }

    if (!fields.name.value.trim()) {
      const guessed = guessNameFromItems(items);
      if (guessed) fields.name.value = guessed;
    }
    if (!fields.slug.value.trim()) {
      fields.slug.value = slugify(fields.name.value);
    }

    setStatus(1, "Normalizing traits & images…");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    readWeightsFromUI();
    packageState = buildCollectionPackage({
      items,
      name: fields.name.value,
      slug: fields.slug.value,
      weights,
      optional: {},
    });

    setStatus(2, "Calculating similarity scores…");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    setStatus(3, "Import complete");
    renderStats(packageState.tokenIds.length, packageState.missingImages);

    if (packageState.missingImages > 0) {
      log(
        `Warning: ${packageState.missingImages} token(s) have no image URL. Add image fields to metadata or use Advanced → image template.`,
      );
    }

    log(`Built package for "${packageState.collection.name}" (${packageState.tokenIds.length} tokens).`);
    log("Click Export to download the 4 JSON files.");

    deploySlug.textContent = packageState.collection.slug;
    indexSnippet.value = buildIndexSnippet({
      slug: packageState.collection.slug,
      name: packageState.collection.name,
    });
    exportBlock.hidden = false;
  } catch (error) {
    setStatus(0, "Build failed");
    log(`Error: ${error?.message || "Build failed"}`);
  } finally {
    buildBtn.disabled = false;
  }
});

exportBtn.addEventListener("click", async () => {
  if (!packageState) return;

  const { collection, metadata, images, similarity } = packageState;
  exportBtn.disabled = true;

  try {
    const info = await exportCollectionPackage(
      collection.slug,
      collection,
      metadata,
      images,
      similarity,
    );
    log(`Exported 4 files for "${collection.name}".`);
    log(`Place them in: ${info.folder}`);
  } finally {
    exportBtn.disabled = false;
  }
});

copyIndexBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(indexSnippet.value);
    copyIndexBtn.textContent = "Copied!";
    window.setTimeout(() => {
      copyIndexBtn.textContent = "Copy index entry";
    }, 2000);
  } catch {
    indexSnippet.select();
    document.execCommand("copy");
  }
});

renderWeightInputs();
