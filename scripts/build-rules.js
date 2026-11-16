#!/usr/bin/env node
// Writes core/rules-data.js from rules/*.json. The page can't fetch JSON (its CSP has connect-src 'none'),
// so the rules ship as a module. `--check` fails if the module is out of date.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(readFileSync(join(root, "rules", name), "utf8"));

export function render() {
  const gorgias = read("gorgias.json");
  const categories = read("categories.json");
  return (
    "// Generated from rules/gorgias.json and rules/categories.json by `npm run rules`. Do not edit.\n" +
    `export const GORGIAS = ${JSON.stringify(gorgias, null, 2)};\n\n` +
    `export const CATEGORIES = ${JSON.stringify(categories, null, 2)};\n\n` +
    "export const RULES = { gorgias: GORGIAS, categories: CATEGORIES };\n"
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(root, "core", "rules-data.js");
  const text = render();
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(out, "utf8"); } catch {}
    if (current !== text) {
      console.error("core/rules-data.js is out of date: run `npm run rules`.");
      process.exit(1);
    }
  } else {
    writeFileSync(out, text);
    console.log("wrote core/rules-data.js");
  }
}
