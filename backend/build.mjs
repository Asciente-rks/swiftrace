// Bundle the entire backend into a single CJS file for AWS Lambda.
// We bundle aws-sdk v2 too (Node 20 runtime no longer ships v2 by default).
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [path.join(root, "src", "router.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: path.join(dist, "index.js"),
  sourcemap: false,
  minify: true,
  legalComments: "none",
  treeShaking: true,
  logLevel: "info",
});

const sizeKb = (fs.statSync(path.join(dist, "index.js")).size / 1024).toFixed(1);
console.log(`✓ Bundled ${dist}/index.js (${sizeKb} KB)`);

if (result.warnings.length) {
  console.log("Warnings:", result.warnings);
}
