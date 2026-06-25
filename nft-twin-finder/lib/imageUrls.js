const IPFS_GATEWAYS = [
  "https://alchemy.mypinata.cloud/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
];

/** @param {string} url */
export function extractIpfsPath(url) {
  const match = String(url).match(/\/ipfs\/(.+)$/i);
  return match ? match[1] : null;
}

/** @param {string} url */
function isDirectHttpsImage(url) {
  return /^https?:\/\//i.test(url) && !extractIpfsPath(url);
}

/** @param {string} template @param {string|number} tokenId */
export function resolveImageUrlTemplate(template, tokenId) {
  if (!template || tokenId == null || tokenId === "") return "";
  return template.replaceAll("{id}", String(tokenId));
}

function addIpfsGatewayVariants(add, ipfsPath) {
  for (const gateway of IPFS_GATEWAYS) {
    add(`${gateway}${ipfsPath}`);
  }
}

/**
 * @param {string} url
 * @param {{ tokenId?: string|number, imageUrlTemplate?: string, imageIpfsCid?: string }} [options]
 */
export function imageUrlCandidates(url, options = {}) {
  const trimmed = typeof url === "string" ? url.trim() : "";
  const { tokenId, imageUrlTemplate, imageIpfsCid } = options;
  const seen = new Set();
  /** @type {string[]} */
  const candidates = [];

  const add = (candidate) => {
    const next = String(candidate || "").trim();
    if (!next || seen.has(next)) return;
    seen.add(next);
    candidates.push(next);
  };

  if (imageUrlTemplate && tokenId != null) {
    add(resolveImageUrlTemplate(imageUrlTemplate, tokenId));
  }

  if (trimmed) {
    const ipfsPath = extractIpfsPath(trimmed);
    if (ipfsPath) {
      add(trimmed);
      addIpfsGatewayVariants(add, ipfsPath);
    } else {
      add(trimmed);
    }
  }

  if (imageIpfsCid && tokenId != null) {
    const cidPath = `${imageIpfsCid}/${tokenId}.png`;
    addIpfsGatewayVariants(add, cidPath);
  }

  return candidates;
}

/** @param {Record<string, unknown>} collection */
export function imageOptionsForToken(collection, tokenId) {
  return {
    tokenId,
    imageUrlTemplate:
      typeof collection?.imageUrlTemplate === "string" ? collection.imageUrlTemplate : undefined,
    imageIpfsCid:
      typeof collection?.imageIpfsCid === "string" ? collection.imageIpfsCid : undefined,
  };
}

/**
 * @param {string} url
 * @param {{ tokenId?: string|number, imageUrlTemplate?: string, imageIpfsCid?: string }} [options]
 */
export function preferredImageUrl(url, options = {}) {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (isDirectHttpsImage(trimmed)) return trimmed;
  return imageUrlCandidates(url, options)[0] || trimmed || "";
}
