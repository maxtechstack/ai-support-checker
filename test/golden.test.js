import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkFile } from "../cli/check.js";
import { root, sampleFiles } from "./helpers.js";

for (const [name, path] of Object.entries(sampleFiles())) {
  test(`golden output: ${name}`, async () => {
    const expected = JSON.parse(readFileSync(join(root, "test", "golden", `${name}.json`), "utf8"));
    assert.deepEqual(await checkFile(path), expected);
  });
}
