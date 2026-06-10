function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Download all four collection package files with standard names.
 */
export async function exportCollectionPackage(slug, collection, metadata, images, similarity) {
  const files = [
    ["collection.json", collection],
    ["metadata.json", metadata],
    ["images.json", images],
    ["similarity.json", similarity],
  ];

  for (const [filename, data] of files) {
    downloadJson(filename, data);
    await delay(350);
  }

  const indexEntry = { slug, name: collection.name };
  if (collection.logo) indexEntry.logo = collection.logo;

  return {
    folder: `nft-twin-finder/collections/${slug}/`,
    indexEntry,
  };
}

export function buildIndexSnippet(entry) {
  return JSON.stringify([entry], null, 2);
}

export function buildFullIndexSnippet(entries) {
  return JSON.stringify(entries, null, 2);
}
