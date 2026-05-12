/**
 * Alchemy network identifiers (FlexGrid Worker maps these to *.g.alchemy.com hosts).
 * Browser bundle does not include the Alchemy SDK or API keys — calls go through the Worker.
 *
 * ApeChain is loaded via Moralis on the Worker (`MORALIS_API_KEY`), not Alchemy — kept here only
 * as a stable display label for logs.
 */

export const ALCHEMY_NETWORKS = {
  eth: "eth-mainnet",
  base: "base-mainnet",
  polygon: "polygon-mainnet",
};

/**
 * @param {string} chain — UI value: eth | base | polygon | apechain
 * @returns {string} Alchemy network id (e.g. eth-mainnet), or a Moralis label for apechain
 */
export function getAlchemyNetworkId(chain) {
  const c = String(chain || "eth").toLowerCase();
  if (c === "apechain") {
    return "moralis-apechain (Worker)";
  }
  const network = ALCHEMY_NETWORKS[c];
  if (!network) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  return network;
}

/**
 * Alchemy SDK is not bundled in the FlexGrid browser (API keys must stay on the Worker via `env.ALCHEMY_API_KEY`).
 * Use `fetchNFTsFromWorker` in `./api.js` for NFT loading.
 */
export function getAlchemyInstance() {
  throw new Error(
    "[FlexGrid] getAlchemyInstance() is not available in the browser. Use fetchNFTsFromWorker({ wallet, chain }); the Worker calls Alchemy using server-side configuration."
  );
}
