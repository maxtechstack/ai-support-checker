// Shared by the tests and test/update-golden.js.
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../samples/generate.js";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every sample with a golden output. The 50,000-row file is generated when missing (it isn't committed). */
export function sampleFiles() {
  const big = join(root, "samples", "gorgias-50000.csv");
  if (!existsSync(big)) writeFileSync(big, generate({ rows: 50000, seed: 2 }));
  return {
    "gorgias-3000": join(root, "samples", "gorgias-3000.csv"),
    "gorgias-50000": big,
    ...Object.fromEntries(
      ["gorgias-small", "gorgias-no-ai", "messy", "missing-headers", "empty", "header-only", "not-a-csv"].map((n) => [
        n,
        join(root, "samples", "edge", `${n}.csv`),
      ]),
    ),
  };
}
