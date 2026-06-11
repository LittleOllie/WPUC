/**
 * Add weightProfile fields to all collection.json files.
 * Usage: node nft-twin-finder/scripts/migrate-weight-profiles.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DROP_DED_GORGEZ_WEIGHTS,
  WEIGHT_PROFILE_CUSTOM,
  WEIGHT_PROFILE_DEFAULT,
} from "../lib/weightProfiles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const collectionsRoot = join(__dirname, "../collections");
const index = JSON.parse(readFileSync(join(collectionsRoot, "index.json"), "utf8"));

for (const entry of index) {
  const path = join(collectionsRoot, entry.slug, "collection.json");
  const collection = JSON.parse(readFileSync(path, "utf8"));
  const isCustom = entry.slug === "dropded-gorgez";

  collection.weightProfile = isCustom ? WEIGHT_PROFILE_CUSTOM : WEIGHT_PROFILE_DEFAULT;

  if (isCustom) {
    collection.traitWeights = { ...DROP_DED_GORGEZ_WEIGHTS };
  } else {
    delete collection.traitWeights;
  }

  if (!collection.similarityCalculatedAt) {
    collection.similarityCalculatedAt = null;
  }

  writeFileSync(path, `${JSON.stringify(collection, null, 2)}\n`);
  console.log(`Updated ${entry.slug} → ${collection.weightProfile}`);
}

console.log("Done.");
