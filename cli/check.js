#!/usr/bin/env node
// node cli/check.js export.csv [--json]
// Prints the same counts as the page. Reads the file locally; makes no network calls.
import { createReadStream, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { isError, createRowFeed, summaryText, RULES, SKIP_REASONS, fmt } from "../core/index.js";

const require = createRequire(import.meta.url);
const Papa = require("../web/vendor/papaparse.min.js");

const MESSAGES = {
  empty: "The file is empty: no ticket rows found.",
  not_csv: "This doesn't look like a CSV file. Export the view from Gorgias as CSV and try again.",
};

/**
 * @param {string} path
 * @returns {Promise<import("../core/checker.js").CheckResult | import("../core/checker.js").CheckError>}
 */
export function checkFile(path) {
  return new Promise((resolve, reject) => {
    const feed = createRowFeed(RULES);
    Papa.parse(createReadStream(path, { encoding: "utf8" }), {
      header: false,
      skipEmptyLines: true,
      chunkSize: 1 << 20,
      beforeFirstChunk(chunk) {
        feed.sniff(chunk);
      },
      chunk(results, parser) {
        if (feed.rows(/** @type {string[][]} */ (results.data))) parser.abort();
      },
      complete() {
        resolve(feed.finish());
      },
      error: reject,
    });
  });
}

function errorText(err) {
  if (err.code === "missing_headers") {
    return [
      `This export is missing the column(s): ${err.missing.join(", ")}.`,
      `Headers found: ${err.found.join(", ") || "(none)"}`,
      `Headers the checker reads: ${err.expected.join(", ")}`,
      "You can send us the header row only (never the data) and we'll add support.",
    ].join("\n");
  }
  return MESSAGES[err.code] ?? `Error: ${err.code}`;
}

async function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--"));
  const json = argv.includes("--json");
  if (args.length !== 1 || argv.includes("--help")) {
    console.error("Usage: node cli/check.js <gorgias-export.csv> [--json]");
    return 2;
  }
  const [path] = args;
  try {
    if (statSync(path).size === 0) {
      const out = { code: "empty" };
      console.log(json ? JSON.stringify(out, null, 2) : errorText(out));
      return 1;
    }
  } catch {
    console.error(`Can't read ${path}`);
    return 2;
  }
  const res = await checkFile(path);
  if (json) {
    console.log(JSON.stringify(res, null, 2));
    return isError(res) ? 1 : 0;
  }
  if (isError(res)) {
    console.error(errorText(res));
    return 1;
  }
  console.log(summaryText(res));
  const skipped = Object.entries(res.rows.skipped).filter(([, n]) => n > 0);
  if (skipped.length) {
    console.log("\nRows skipped: " + skipped.map(([k, n]) => `${fmt(n)} ${SKIP_REASONS[k] ?? k}`).join("; "));
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
