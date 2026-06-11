const OPENSEA_CHAIN_SLUGS = {
  ethereum: "ethereum",
  base: "base",
  apechain: "ape_chain",
  polygon: "matic",
  arbitrum: "arbitrum",
};

/**
 * @param {{ contract?: string, network?: string }} collection
 * @param {string|number} tokenId
 */
export function openseaTokenUrl(collection, tokenId) {
  const contract = collection?.contract;
  if (!contract || tokenId == null || tokenId === "") return null;

  const network = String(collection?.network || "ethereum").toLowerCase();
  const chain = OPENSEA_CHAIN_SLUGS[network] || network;
  const tid = String(tokenId).trim().replace(/^#/, "");
  if (!/^\d+$/.test(tid)) return null;

  const addr = String(contract).trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) return null;

  return `https://opensea.io/item/${chain}/${addr}/${tid}`;
}
