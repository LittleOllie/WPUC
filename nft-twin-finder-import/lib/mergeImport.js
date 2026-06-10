function classifyUri(uri) {
  if (!uri || typeof uri !== "string") return "unknown";
  if (uri.startsWith("data:")) return "on-chain";
  if (uri.startsWith("ipfs://") || uri.includes("/ipfs/")) return "ipfs";
  if (uri.startsWith("ar://") || uri.includes("arweave.net")) return "arweave";
  if (uri.startsWith("http://") || uri.startsWith("https://")) return "https";
  return "unknown";
}

export function detectMetadataSource(records) {
  const uris = records
    .map((r) => r.tokenUri)
    .filter(Boolean)
    .slice(0, 12);

  if (!uris.length) {
    return {
      type: "alchemy-resolved",
      description: "Metadata resolved by Alchemy",
      sampleTokenUri: null,
      pattern: null,
    };
  }

  const types = [...new Set(uris.map(classifyUri))];
  let pattern = null;

  if (uris.length >= 2) {
    const a = uris[0];
    const b = uris[1];
    let prefix = "";
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) prefix += a[i];
      else break;
    }
    const lastSlash = prefix.lastIndexOf("/");
    if (lastSlash > 8) {
      pattern = `${prefix.slice(0, lastSlash + 1)}{id}`;
      if (a.endsWith(".json") || b.endsWith(".json")) pattern += ".json";
    }
  }

  return {
    type: types.length === 1 ? types[0] : "mixed",
    description: `Detected from ${uris.length} sample tokenURI(s)`,
    sampleTokenUri: uris[0],
    pattern,
  };
}

export function buildImportResult(meta, allRecords) {
  const metadata = {};
  const images = {};

  for (const rec of allRecords) {
    metadata[rec.tokenId] = { name: rec.name, traits: rec.traits || {} };
    if (rec.description) metadata[rec.tokenId].description = rec.description;
    if (rec.image) images[rec.tokenId] = rec.image;
  }

  const sampleIds = ["1", "0", allRecords[0]?.tokenId].filter(Boolean);
  const samples = [];
  for (const id of sampleIds) {
    const hit = allRecords.find((r) => r.tokenId === id);
    if (hit && !samples.some((s) => s.tokenId === hit.tokenId)) samples.push(hit);
  }
  for (const rec of allRecords) {
    if (samples.length >= 3) break;
    if (!samples.some((s) => s.tokenId === rec.tokenId)) samples.push(rec);
  }

  const importedCount = allRecords.length;
  const totalSupply = meta.totalSupply || importedCount;
  const importLimit = meta.importLimit || importedCount;

  return {
    ok: true,
    collectionName: meta.collectionName || "Unknown Collection",
    symbol: meta.symbol || "",
    totalSupply,
    tokenStandard: meta.tokenStandard || "ERC721",
    network: meta.network,
    contract: meta.contract,
    metadataSource: detectMetadataSource(allRecords),
    importedCount,
    importLimit,
    cappedAt:
      importedCount >= importLimit && importLimit < totalSupply ? importLimit : null,
    samples: samples.map((s) => ({
      tokenId: s.tokenId,
      name: s.name,
      image: s.image,
      traits: s.traits,
      tokenUri: s.tokenUri || null,
    })),
    metadata,
    images,
  };
}
