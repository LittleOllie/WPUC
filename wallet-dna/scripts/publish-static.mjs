/**
 * Static export for littleollielabs.com/wallet-dna/
 */
import { cpSync, existsSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "src/app/api");
const apiBackup = join(root, ".publish-api-backup");
const outDir = join(root, "out");

function copyExport() {
  if (!existsSync(outDir)) {
    console.error("out/ missing");
    process.exit(1);
  }
  cpSync(join(outDir, "index.html"), join(root, "index.html"));
  const outNext = join(outDir, "_next");
  if (existsSync(outNext)) {
    rmSync(join(root, "_next"), { recursive: true, force: true });
    cpSync(outNext, join(root, "_next"), { recursive: true });
  }
  const meth = join(outDir, "methodology");
  if (existsSync(meth)) {
    rmSync(join(root, "methodology"), { recursive: true, force: true });
    cpSync(meth, join(root, "methodology"), { recursive: true });
  }
  const pub = join(outDir, "ollie");
  if (existsSync(pub)) {
    rmSync(join(root, "ollie"), { recursive: true, force: true });
    cpSync(pub, join(root, "ollie"), { recursive: true });
  }
  rmSync(outDir, { recursive: true, force: true });
}

try {
  if (existsSync(apiDir)) {
    renameSync(apiDir, apiBackup);
  }
  execSync("npm run build:export", {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_OUTPUT_EXPORT: "true",
      NEXT_PUBLIC_BASE_PATH: "/wallet-dna",
      NEXT_PUBLIC_WALLET_DNA_API_BASE: "https://lowalletdna.littleollienft.workers.dev",
    },
  });
  copyExport();
  console.log("Published wallet-dna static site.");
} finally {
  if (existsSync(apiBackup)) {
    if (existsSync(apiDir)) rmSync(apiDir, { recursive: true, force: true });
    renameSync(apiBackup, apiDir);
  }
}
