#!/usr/bin/env node
// Builds the page into dist/check/ (what gets copied to closewellhq.com/check/).
// Same files as web/, with the shared core next to them: "../core/" becomes "./core/".
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "./build-rules.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist", "check");

if (readFileSync(join(root, "core", "rules-data.js"), "utf8") !== render()) {
  console.error("core/rules-data.js is out of date: run `npm run rules` first.");
  process.exit(1);
}
rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "web"), out, { recursive: true, filter: (src) => !src.endsWith("package.json") });
mkdirSync(join(out, "core"));
for (const f of readdirSync(join(root, "core")).filter((f) => f.endsWith(".js"))) {
  cpSync(join(root, "core", f), join(out, "core", f));
}
for (const f of ["app.js", "worker.js"]) {
  const p = join(out, f);
  const text = readFileSync(p, "utf8").replaceAll('"../core/', '"./core/');
  if (text.includes("../core/")) throw new Error(`${f}: unexpected ../core/ reference`);
  writeFileSync(p, text);
}
// The synthetic sample the page links to ("No export handy?"). A plain download link, never fetched by page code.
mkdirSync(join(out, "sample"));
cpSync(join(root, "samples", "gorgias-3000.csv"), join(out, "sample", "gorgias-3000.csv"));
console.log("built dist/check/");
