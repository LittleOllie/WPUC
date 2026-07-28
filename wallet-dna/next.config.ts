import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const isStaticExport = process.env.NEXT_OUTPUT_EXPORT === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  // Allow phone/other devices on your LAN to load dev server (e.g. http://10.0.0.8:3001)
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "10.0.0.8",
    "10.0.0.*",
    "192.168.*",
  ],
  ...(isStaticExport ? { output: "export" as const } : {}),
};

export default nextConfig;
