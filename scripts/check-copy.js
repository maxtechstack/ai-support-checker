#!/usr/bin/env node
// Words-to-avoid check (Closewell site rule) on every user-facing text: page, result copy, CLI copy, README, docs.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { root } from "../test/helpers.js";

const AVOID = [
  [/verified resolution/i, "verified resolution"],
  [/deflect/i, "deflected / deflection"],
  [/warehouse/i, "warehouse (say 3PL)"],
  [/chargeback/i, "chargebacks as an offer"],
  // "a failed action" is Gorgias's own ai_failed_action tag (an action that couldn't complete), not a verdict on the AI.
  [/\bfail(s|ed|ure|ing)?\b(?!\s+action)/i, "the AI 'failed' (say handed back / closed without a human)"],
  [/every vendor bills|vendors? bills? (every|all) give-?ups?/i, "claim that every vendor bills give-ups"],
];
const FILES = [
  "web/index.html", "web/app.js", "core/report.js", "cli/check.js", "README.md",
  ...readdirSync(join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`),
];

let hits = 0;
for (const f of FILES) {
  readFileSync(join(root, f), "utf8").split("\n").forEach((line, i) => {
    for (const [re, label] of AVOID) {
      if (re.test(line)) {
        hits++;
        console.log(`${f}:${i + 1}: ${label}\n    ${line.trim()}`);
      }
    }
  });
}
if (hits) process.exit(1);
console.log(`OK: no words to avoid in ${FILES.length} files.`);
