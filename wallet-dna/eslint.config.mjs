import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  { ignores: [".next/**", "_next/**", "out/**", "node_modules/**", "dist-worker/**", "next-env.d.ts", "*.html", "methodology/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
