#!/usr/bin/env node
/**
 * Little Ollie World — PDF to book page importer
 *
 * Usage:
 *   npm run import:book -- --slug the-spark-inside --pdf "./book-imports/the-spark-inside.pdf" --cover-separate --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pdf } from "pdf-to-img";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    slug: "",
    pdf: "",
    force: false,
    coverSeparate: false,
    quality: 86,
    desktopMax: 2200,
    mobileMax: 1200,
    title: "Little Ollie and the Spark Inside",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--slug") args.slug = argv[++i] || "";
    else if (arg === "--pdf") args.pdf = argv[++i] || "";
    else if (arg === "--title") args.title = argv[++i] || args.title;
    else if (arg === "--force") args.force = true;
    else if (arg === "--cover-separate") args.coverSeparate = true;
    else if (arg === "--quality") args.quality = Number(argv[++i] || 86);
    else if (arg === "--desktop-max") args.desktopMax = Number(argv[++i] || 2200);
    else if (arg === "--mobile-max") args.mobileMax = Number(argv[++i] || 1200);
  }
  return args;
}

function pad(n) {
  return String(n).padStart(3, "0");
}

function ensureEmptyDir(dir, force) {
  if (fs.existsSync(dir)) {
    if (!force) {
      throw new Error(
        `Output folder already exists: ${dir}\nRe-run with --force to overwrite generated pages.`
      );
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

async function writeSizedWebp(pngBuffer, outPath, maxEdge, quality) {
  const image = sharp(pngBuffer);
  const meta = await image.metadata();
  const longest = Math.max(meta.width || 1, meta.height || 1);
  const pipeline =
    longest > maxEdge
      ? image.resize({
          width: meta.width >= meta.height ? maxEdge : undefined,
          height: meta.height > meta.width ? maxEdge : undefined,
          fit: "inside",
          withoutEnlargement: false,
        })
      : image;
  const buffer = await pipeline.webp({ quality }).toBuffer();
  fs.writeFileSync(outPath, buffer);
  const info = await sharp(buffer).metadata();
  return { width: info.width, height: info.height, bytes: buffer.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug || !args.pdf) {
    console.error("Missing required arguments.");
    console.error(
      'Example: npm run import:book -- --slug the-spark-inside --pdf "./book-imports/the-spark-inside.pdf" --cover-separate --force'
    );
    process.exit(1);
  }

  const pdfPath = path.resolve(ROOT, args.pdf);
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  const bookDir = path.join(ROOT, "books", args.slug);
  const pagesDir = path.join(bookDir, "pages");
  const mobileDir = path.join(bookDir, "pages-mobile");
  ensureEmptyDir(pagesDir, args.force);
  ensureEmptyDir(mobileDir, args.force);

  const pages = [];
  let pageNum = 0;

  console.log(`Importing from ${path.basename(pdfPath)}...`);
  if (args.coverSeparate) {
    console.log("Cover is separate — reader uses BookCover.jpg + first-right spread layout.");
  }

  const doc = await pdf(pdfPath, { scale: 3 });
  for await (const pngBuffer of doc) {
    pageNum += 1;
    const filename = `page-${pad(pageNum)}.webp`;
    const desktopOut = path.join(pagesDir, filename);
    const mobileOut = path.join(mobileDir, filename);
    const desktopMeta = await writeSizedWebp(pngBuffer, desktopOut, args.desktopMax, args.quality);
    await writeSizedWebp(pngBuffer, mobileOut, args.mobileMax, args.quality);

    pages.push({
      number: pageNum,
      role: "interior",
      side: pageNum === 1 ? "right-first" : pageNum % 2 === 0 ? "text" : "image",
      src: `pages/${filename}`,
      mobileSrc: `pages-mobile/${filename}`,
      alt: `Page ${pageNum} of ${args.title}`,
    });

    console.log(
      `  ✓ page ${pageNum} → ${filename} (${desktopMeta.width}x${desktopMeta.height}, ${Math.round(desktopMeta.bytes / 1024)} KB desktop)`
    );
  }

  if (pages.length) {
    pages[pages.length - 1].role = "back-cover";
  }

  const manifest = {
    slug: args.slug,
    title: args.title,
    author: "Little Ollie World",
    pageCount: pages.length,
    coverPage: 0,
    coverSrc: "../../webpageassets/BookCover.jpg",
    coverSeparate: args.coverSeparate,
    spreadLayout: args.coverSeparate ? "first-right" : "standard",
    readingDirection: "ltr",
    desktopDisplay: "spread",
    mobileDisplay: "single",
    placeholder: false,
    pages,
  };

  const manifestPath = path.join(bookDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log("\nImport complete.");
  console.log(`Pages created: ${pages.length}`);
  console.log(`Spread layout: ${manifest.spreadLayout}`);
  console.log(`Desktop images: ${pagesDir}`);
  console.log(`Mobile images:  ${mobileDir}`);
  console.log(`Manifest:       ${manifestPath}`);
}

main().catch(function (err) {
  console.error("\nImport failed:");
  console.error(err.message || err);
  process.exit(1);
});
