#!/usr/bin/env node
/** Debug Alchemy connectivity — run: node scripts/test-alchemy.mjs [wallet] */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const key = env.ALCHEMY_API_KEY_WALLET_DNA || env.ALCHEMY_API_KEY;
const wallet = process.argv[2] || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

async function probe(label, url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let preview = text.slice(0, 400);
  try {
    const j = JSON.parse(text);
    if (j.error) preview = JSON.stringify(j.error);
    else if (j.result?.transfers) preview = `transfers=${j.result.transfers.length} pageKey=${Boolean(j.result.pageKey)}`;
    else {
      const keys = Object.keys(j);
      preview = `keys=[${keys.join(",")}] len=${text.length}`;
    }
  } catch {
    /* keep preview */
  }
  console.log(`${label}: HTTP ${res.status} ${preview}`);
  return res.ok;
}

if (!key) {
  console.error("No ALCHEMY_API_KEY in .env.local");
  process.exit(1);
}

console.log("Key loaded:", key.slice(0, 8) + "...");
console.log("Wallet:", wallet);

const rpc = (host, params) =>
  probe(
    params.toAddress ? `${host}-inbound` : `${host}-outbound`,
    `https://${host}/v2/${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [params],
      }),
    },
  );

const tests = [
  probe(
    "eth-owned",
    `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${wallet}&withMetadata=true&pageSize=5`,
  ),
  rpc("eth-mainnet.g.alchemy.com", {
    fromBlock: "0x0",
    toBlock: "latest",
    toAddress: wallet,
    category: ["erc721", "erc1155"],
    maxCount: "0x5",
    withMetadata: true,
  }),
  rpc("eth-mainnet.g.alchemy.com", {
    fromBlock: "0x0",
    toBlock: "latest",
    fromAddress: wallet,
    category: ["erc721", "erc1155"],
    maxCount: "0x5",
    withMetadata: true,
  }),
  probe(
    "base-owned",
    `https://base-mainnet.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${wallet}&withMetadata=true&pageSize=5`,
  ),
  rpc("base-mainnet.g.alchemy.com", {
    fromBlock: "0x0",
    toBlock: "latest",
    toAddress: wallet,
    category: ["erc721", "erc1155"],
    maxCount: "0x5",
    withMetadata: true,
  }),
];

let ok = 0;
for (const t of tests) {
  if (await t) ok++;
}

console.log(`\n${ok}/${tests.length} endpoints OK`);
process.exit(ok === tests.length ? 0 : 1);
