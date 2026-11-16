#!/usr/bin/env node
// Rewrites test/golden/*.json from the current rules. Review the diff before committing.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkFile } from "../cli/check.js";
import { root, sampleFiles } from "./helpers.js";

for (const [name, path] of Object.entries(sampleFiles())) {
  const res = await checkFile(path);
  writeFileSync(join(root, "test", "golden", `${name}.json`), JSON.stringify(res, null, 2) + "\n");
  console.log(`golden/${name}.json`);
}
