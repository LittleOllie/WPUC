import { normalizeTraits } from "../../nft-twin-finder/lib/traitNormalizer.js";

function tokenIdFromName(name, fallbackIndex) {
  if (!name) return String(fallbackIndex);
  const hash = String(name).match(/#(\d+)/);
  if (hash) return hash[1];
  const num = String(name).match(/(\d+)\s*$/);
  if (num) return num[1];
  return String(fallbackIndex);
}

function imageFromRecord(record, baseUrl, imageOverride) {
  if (imageOverride) {
    return imageOverride.replace("{id}", record.id).replace("{tokenId}", record.id);
  }

  let image =
    record.image ||
    record.image_url ||
    record.imageUrl ||
    record.metadata?.image ||
    "";

  if (typeof image === "string" && image.includes("{id}")) {
    image = image.replace("{id}", record.id);
  }

  if (image && (image.startsWith("ipfs://") || image.startsWith("ar://"))) {
    if (image.startsWith("ipfs://")) {
      image = `https://cloudflare-ipfs.com/ipfs/${image.slice(7)}`;
    } else {
      image = `https://arweave.net/${image.slice(5)}`;
    }
  }

  if (!image && baseUrl) {
    const base = baseUrl.replace(/\/?$/, "/");
    image = `${base}${record.id}.png`;
  }

  return image || "";
}

/**
 * Parse uploaded metadata into normalized maps.
 * @param {unknown[]} items
 * @param {{ metadataBaseUrl?: string, imageUrlTemplate?: string }} options
 */
export function parseMetadataRecords(items, options = {}) {
  const metadata = {};
  const images = {};
  let index = 0;

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    index += 1;

    const id = String(
      item.tokenId ??
        item.token_id ??
        item.id ??
        tokenIdFromName(item.name, index),
    ).replace(/^#/, "");

    const traits = normalizeTraits(item);
    const name = item.name || `Token #${id}`;

    metadata[id] = { name, traits };
    images[id] = imageFromRecord(
      { ...item, id },
      options.metadataBaseUrl || "",
      options.imageUrlTemplate || "",
    );
  }

  return { metadata, images, tokenIds: Object.keys(metadata).sort((a, b) => Number(a) - Number(b)) };
}

/**
 * @param {FileList|File[]} files
 */
export async function parseMetadataFolder(files) {
  const items = [];
  const list = Array.from(files);

  for (const file of list) {
    if (!file.name.endsWith(".json")) continue;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      items.push(...metadataJsonToItems(json));
    } catch {
      /* skip invalid */
    }
  }

  return items;
}

/**
 * Convert keyed metadata.json ({ "1": { name, traits } }) to record array.
 * @param {unknown} json
 */
export function metadataJsonToItems(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const keys = Object.keys(json);
    if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
      return keys.map((id) => {
        const entry = json[id];
        if (!entry || typeof entry !== "object") return { tokenId: id };
        return {
          tokenId: id,
          name: entry.name,
          description: entry.description,
          traits: entry.traits,
          attributes: entry.traits
            ? Object.entries(entry.traits).map(([trait_type, value]) => ({
                trait_type,
                value,
              }))
            : undefined,
        };
      });
    }
  }
  return json ? [json] : [];
}

/**
 * @param {File} file
 */
export async function parseMetadataFile(file) {
  const text = await file.text();
  const json = JSON.parse(text);
  return metadataJsonToItems(json);
}
