#!/usr/bin/env node
/** Bundle worker handler from wallet-dna analysis code. */
import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist-worker");
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src/worker/handler.ts")],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: join(outdir, "handler.mjs"),
  alias: {
    "@": join(root, "src"),
  },
  logLevel: "info",
});

console.log("Built dist-worker/handler.mjs");
