#!/usr/bin/env node
/**
 * Warm Worker edge cache by fetching /api/img for each token.
 * Uses /api/nft-metadata to resolve image URL, then requests the proxied image
 * (contract + tokenId query params are passed through for client cache keys; worker does not persist storage).
 *
 * Usage:
 *   node scripts/warm-nft-r2.mjs --base https://quirks-set-checker.xxx.workers.dev \
 *     --contract 0x... --from 1 --to 5000 --concurrency 8
 *
 * Optional env: WARM_BASE, WARM_CONTRACT, WARM_FROM, WARM_TO, WARM_CONCURRENCY, WARM_VERBOSE=1
 */

const raw = process.argv.slice(2);
const args = {};
for (let i = 0; i < raw.length; i++) {
  if (raw[i].startsWith("--")) {
    const k = raw[i].slice(2);
    const v =
      raw[i + 1] && !raw[i + 1].startsWith("--") ? raw[++i] : "1";
    args[k] = v;
  }
}

function arg(name, envKey, fallback) {
  const v = args[name] ?? process.env[envKey];
  if (v !== undefined && v !== "") return v;
  return fallback;
}

const base = String(arg("base", "WARM_BASE", "")).replace(/\/$/, "");
const contract = String(arg("contract", "WARM_CONTRACT", "")).trim();
const fromId = parseInt(String(arg("from", "WARM_FROM", "1")), 10);
const toId = parseInt(String(arg("to", "WARM_TO", "100")), 10);
const concurrency = Math.max(
  1,
  parseInt(String(arg("concurrency", "WARM_CONCURRENCY", "6")), 10)
);

if (!base || !contract) {
  console.error(
    "Usage: node scripts/warm-nft-r2.mjs --base https://worker.dev --contract 0x... [--from 1] [--to 5000] [--concurrency 8]"
  );
  process.exit(1);
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function warmOne(id) {
  const metaUrl = `${base}/api/nft-metadata?contract=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(String(id))}`;
  let j;
  try {
    j = await fetchJson(metaUrl);
  } catch (e) {
    return { id, ok: false, err: String(e.message || e) };
  }
  const img = j.image || j.rawImage;
  if (!img) return { id, ok: false, err: "no image in metadata" };

  let imgUrl = String(img);
  try {
    const u = new URL(imgUrl, base);
    if (!u.searchParams.get("contract")) {
      u.searchParams.set("contract", contract);
    }
    if (!u.searchParams.get("tokenId")) {
      u.searchParams.set("tokenId", String(id));
    }
    imgUrl = u.href;
  } catch {
    imgUrl =
      base +
      `/api/img?url=${encodeURIComponent(imgUrl)}&contract=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(String(id))}`;
  }

  try {
    const ir = await fetch(imgUrl);
    if (!ir.ok) return { id, ok: false, err: `img ${ir.status}` };
    return { id, ok: true, bytes: (await ir.arrayBuffer()).byteLength };
  } catch (e) {
    return { id, ok: false, err: String(e.message || e) };
  }
}

async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    for (;;) {
      const cur = next++;
      if (cur >= items.length) break;
      out[cur] = await worker(items[cur]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

const ids = [];
for (let n = fromId; n <= toId; n++) ids.push(n);

console.error(
  `Warming ${ids.length} tokens (concurrency ${concurrency}) on ${base} …`
);

const results = await pool(ids, concurrency, warmOne);
const ok = results.filter((r) => r.ok).length;
const fail = results.length - ok;
console.error(`Done: ${ok} ok, ${fail} failed`);
if (fail && process.env.WARM_VERBOSE === "1") {
  for (const r of results) {
    if (!r.ok) console.error(`  #${r.id}: ${r.err}`);
  }
}
process.exit(fail > 0 ? 2 : 0);
