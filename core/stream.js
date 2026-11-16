// Glue between a CSV parser that yields row arrays in chunks and the checker.
import { createChecker, looksBinary } from "./checker.js";

/**
 * @param {Parameters<typeof createChecker>[0]} ruleFiles
 */
export function createRowFeed(ruleFiles) {
  const checker = createChecker(ruleFiles);
  let gotHeader = false;
  /** @type {import("./checker.js").CheckError | null} */
  let error = null;
  return {
    /** First text of the file, before parsing. Returns an error for binary files. */
    sniff(text) {
      if (looksBinary(text)) error = { code: "not_csv" };
      return error;
    },
    /**
     * @param {string[][]} rows
     * @returns {import("./checker.js").CheckError | null} an error means: stop parsing
     */
    rows(rows) {
      if (error) return error;
      let i = 0;
      if (!gotHeader) {
        while (i < rows.length && rows[i].length === 1 && rows[i][0].trim() === "") i++;
        if (i === rows.length) return null;
        gotHeader = true;
        error = checker.header(rows[i++]);
        if (error) return error;
      }
      for (; i < rows.length; i++) checker.row(rows[i]);
      return null;
    },
    finish() {
      return error ?? checker.finish();
    },
  };
}

/** @param {object} x @returns {x is import("./checker.js").CheckError} */
export function isError(x) {
  return typeof x === "object" && x !== null && "code" in x;
}
