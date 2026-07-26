#!/usr/bin/env node
import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outdir = join(root, "site/dist");
const watch = process.argv.includes("--watch");

mkdirSync(outdir, { recursive: true });

const ctx = await esbuild.context({
  entryPoints: [join(root, "site/src/js/app.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  outfile: join(outdir, "app.js"),
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
  console.log("Watching site/src/js → site/dist/app.js");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("Built site/dist/app.js");
}
