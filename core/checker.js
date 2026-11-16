// Streaming checker: feed the header row, then data rows, then finish() for counts only.
// The same object runs in the browser worker and in the CLI, so both give the same numbers.
import { classifyTicket, splitTags } from "./classify.js";
import { expectedHeaders, mapHeaders } from "./headers.js";
import { compileRules } from "./rules.js";

export const RESULT_VERSION = 1;

/**
 * @typedef {{ id: string, label: string, needsBackendAction: boolean, aiHandled: number, aiClosed: number,
 *   handedBack: number, aiOpen: number, humanOnly: number }} CategoryCounts
 * @typedef {{ resultVersion: number, rulesVersion: { gorgias: string, categories: string },
 *   rows: { read: number, counted: number, skipped: Record<string, number> },
 *   headers: { used: Record<string, string>, missingOptional: string[] },
 *   tickets: number, humanOnly: number,
 *   ai: { handled: number, closed: number, handedBack: number, open: number, bothCloseAndHandover: number,
 *         closeTagButOpen: number, fieldOnly: number },
 *   exceptionsClosedByAi: number, categories: CategoryCounts[],
 *   notes: { noAiTickets: boolean, smallSample: boolean, cameBackAvailable: boolean } }} CheckResult
 * @typedef {{ code: "missing_headers", found: string[], missing: string[], expected: string[] }
 *   | { code: "empty" } | { code: "not_csv" }} CheckError
 */

export const SMALL_SAMPLE = 100;
export const SMALL_CATEGORY = 20;

/**
 * @param {{ gorgias: import("./rules.js").GorgiasRules, categories: import("./rules.js").CategoryRules }} ruleFiles
 */
export function createChecker(ruleFiles) {
  const rules = compileRules(ruleFiles.gorgias, ruleFiles.categories);
  const sep = ruleFiles.gorgias.tagSeparator;
  /** @type {import("./headers.js").HeaderMap | null} */
  let map = null;
  const seen = new Set();
  const skipped = { empty_row: 0, column_count: 0, no_ticket_id: 0, duplicate_ticket_id: 0 };
  let read = 0;
  const ai = { handled: 0, closed: 0, handedBack: 0, open: 0, bothCloseAndHandover: 0, closeTagButOpen: 0, fieldOnly: 0 };
  let humanOnly = 0;
  let exceptionsClosedByAi = 0;
  /** @type {Map<string, CategoryCounts>} */
  const cats = new Map(
    ruleFiles.categories.priority.map((id) => [
      id,
      {
        id,
        label: ruleFiles.categories.labels[id] ?? id,
        needsBackendAction: ruleFiles.categories.needsBackendAction.includes(id),
        aiHandled: 0, aiClosed: 0, handedBack: 0, aiOpen: 0, humanOnly: 0,
      },
    ]),
  );

  return {
    /**
     * @param {string[]} headerRow
     * @returns {CheckError | null}
     */
    header(headerRow) {
      map = mapHeaders(headerRow, ruleFiles.gorgias);
      if (!map.ok) {
        return { code: "missing_headers", found: map.found, missing: map.missingRequired, expected: expectedHeaders(ruleFiles.gorgias) };
      }
      return null;
    },

    /** @param {string[]} row */
    row(row) {
      if (!map) throw new Error("header() must be called first");
      read++;
      if (row.length === 1 && row[0].trim() === "") return void skipped.empty_row++;
      if (row.length !== map.columnCount) return void skipped.column_count++;
      const idx = map.index;
      const cell = (key) => (idx[key] === undefined ? "" : row[idx[key]] ?? "");
      const id = cell("ticketId").trim();
      if (!id) return void skipped.no_ticket_id++;
      if (seen.has(id)) return void skipped.duplicate_ticket_id++;
      seen.add(id);

      const c = classifyTicket(
        {
          tags: splitTags(cell("tags"), sep),
          subject: cell("subject"),
          closed: idx.closedAt === undefined ? null : cell("closedAt").trim() !== "",
          aiField: cell("aiOutcomeField"),
          extraText: `${cell("contactReason")}\n${cell("firstMessage")}`,
        },
        rules,
      );
      const cat = /** @type {CategoryCounts} */ (cats.get(c.category));
      if (!c.aiInvolved) {
        humanOnly++;
        cat.humanOnly++;
        return;
      }
      ai.handled++;
      cat.aiHandled++;
      if (c.flags.bothCloseAndHandover) ai.bothCloseAndHandover++;
      if (c.flags.closeTagButOpen) ai.closeTagButOpen++;
      if (c.flags.fieldOnly) ai.fieldOnly++;
      if (c.outcome === "ai_closed") {
        ai.closed++;
        cat.aiClosed++;
        if (c.needsBackendAction) exceptionsClosedByAi++;
      } else if (c.outcome === "handed_back") {
        ai.handedBack++;
        cat.handedBack++;
      } else {
        ai.open++;
        cat.aiOpen++;
      }
    },

    /** @returns {CheckResult | CheckError} */
    finish() {
      if (!map) return { code: "empty" };
      const counted = seen.size;
      if (counted === 0) return { code: "empty" };
      return {
        resultVersion: RESULT_VERSION,
        rulesVersion: { gorgias: ruleFiles.gorgias.version, categories: ruleFiles.categories.version },
        rows: { read, counted, skipped: { ...skipped } },
        headers: { used: { ...map.used }, missingOptional: [...map.missingOptional] },
        tickets: counted,
        humanOnly,
        ai: { ...ai },
        exceptionsClosedByAi,
        categories: [...cats.values()].map((c) => ({ ...c })),
        notes: { noAiTickets: ai.handled === 0, smallSample: ai.handled > 0 && ai.handled < SMALL_SAMPLE, cameBackAvailable: false },
      };
    },
  };
}

/** Quick binary sniff on the first chunk of a file. */
export function looksBinary(text) {
  return text.slice(0, 4096).includes("\u0000");
}
