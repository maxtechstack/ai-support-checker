// Turns a CheckResult into the sentences and table the page and the CLI print. Counts only, never ticket text.
import { SMALL_CATEGORY } from "./checker.js";

const nf = new Intl.NumberFormat("en-US");

/** @param {number} n */
export function fmt(n) {
  return nf.format(n);
}

/** "12%", "<1%", or null when the base is too small to show a percentage. */
export function percent(part, whole, minBase = SMALL_CATEGORY) {
  if (whole < minBase || whole === 0) return null;
  if (part === 0) return "0%";
  const p = (part / whole) * 100;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}

function plural(n, one, many) {
  return `${fmt(n)} ${n === 1 ? one : many}`;
}

/**
 * The headline as parts, so the page can bold the numbers.
 * @param {import("./checker.js").CheckResult} r
 * @returns {(string | { n: number })[][]} sentences
 */
export function headlineParts(r) {
  const { handled, closed, handedBack } = r.ai;
  const e = r.exceptionsClosedByAi;
  const sentences = [
    ["Your AI agent handled ", { n: handled }, handled === 1 ? " ticket." : " tickets."],
    ["It closed ", { n: closed }, " without a human and handed ", { n: handedBack }, " back to your team."],
    [
      { n: e },
      e === 1 ? " of the tickets it closed alone was a post-purchase exception" : " of the tickets it closed alone were post-purchase exceptions",
      " (claims, order changes, return exceptions) that need an action outside your helpdesk.",
    ],
  ];
  if (e > 0) sentences.push(actionSentence(e, r.exceptionActions.actionDone, r.exceptionActions.actionFailed));
  return sentences;
}

const NOT_FINISHED = "the export can't show whether refunds, reships or 3PL changes were finished.";

/**
 * What the AI recorded on the exceptions it closed alone.
 * @param {number} e exceptions closed by AI (> 0)
 * @param {number} d with a completed action
 * @param {number} f with a failed action
 * @returns {(string | { n: number })[]}
 */
function actionSentence(e, d, f) {
  if (d === 0 && f === 0) {
    return [`The export shows no action recorded by the AI on ${e === 1 ? "it" : "any of them"}, and can't show whether refunds, reships or 3PL changes were finished.`];
  }
  if (e === 1) {
    return [`The AI recorded ${d ? "a completed action" : "a failed action"} on it; ${NOT_FINISHED}`];
  }
  if (f === 0) return ["The AI recorded a completed action on ", { n: d }, " of them; ", NOT_FINISHED];
  if (d === 0) return ["The AI recorded a failed action on ", { n: f }, " of them; ", NOT_FINISHED];
  return ["The AI recorded a completed action on ", { n: d }, " of them and a failed action on ", { n: f }, `; ${NOT_FINISHED}`];
}

/** @param {import("./checker.js").CheckResult} r */
export function headlineText(r) {
  return headlineParts(r)
    .map((s) => s.map((p) => (typeof p === "string" ? p : fmt(p.n))).join(""))
    .join(" ");
}

/** Shown under the headline, in Copy summary, in print and in the CLI. */
export const ESTIMATE_LINE =
  "Checker v1.1 · AI Agent tags checked on real traffic; categories are estimates from AI Intent, tags and keywords, not a ticket-by-ticket review.";
export const CAME_BACK_NOTE =
  "Your export can't show customers who came back after an AI close: Gorgias removes the ai_close tag when a ticket reopens, so it looks like a handover. The audit reads the ticket history instead.";
export const NO_AI_TITLE = "We found no tickets handled by Gorgias AI Agent in this export.";
export const NO_AI_BODY =
  "The checker looks for the tags Gorgias AI Agent adds (ai_close, ai_handover, ai_snooze, ai_processing, ai_answered). " +
  "If AI Agent is on in your account, open Shared views › AI Agent › All in the Gorgias Inbox, export that view and drop the file here. " +
  "If you use a different AI agent, send us the header row of your export (never the data) and we'll add support.";
export const SMALL_SAMPLE_NOTE = "Fewer than 100 AI-handled tickets: a small sample, so read the shares with care.";

/**
 * Table rows: count always, percentage only when the category has 20+ AI-handled tickets.
 * @param {import("./checker.js").CheckResult} r
 */
export function categoryRows(r) {
  return r.categories.map((c) => ({
    id: c.id,
    label: c.label,
    needsBackendAction: c.needsBackendAction,
    aiHandled: c.aiHandled,
    aiClosed: c.aiClosed,
    aiActionDone: c.aiActionDone,
    handedBack: c.handedBack,
    aiOpen: c.aiOpen,
    // A category under 20 AI-handled tickets shows its count but no percentage.
    share: c.aiHandled < SMALL_CATEGORY ? null : percent(c.aiHandled, r.ai.handled, 1),
    closedShare: percent(c.aiClosed, c.aiHandled),
  }));
}

/**
 * One line on the Resolution field for the exceptions the AI closed alone, or null when the export doesn't fill it.
 * Values are the rules' own spellings (Gorgias's fixed list), never text from the file.
 * @param {import("./checker.js").CheckResult} r
 * @returns {string | null}
 */
export function resolutionLine(r) {
  const res = r.exceptionResolution;
  if (!res || !res.columnPresent || res.filled === 0 || r.exceptionsClosedByAi === 0) return null;
  const values = Object.entries(res.actionValues).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  let action = plural(res.action, "action", "actions");
  if (values.length === 1) action += ` (${values[0][0]})`;
  else if (values.length > 1) action += ` (${values.map(([v, n]) => `${fmt(n)} ${v}`).join(", ")})`;
  const parts = [action, `${fmt(res.informationOnly)} information only`];
  if (res.other) parts.push(`${fmt(res.other)} other`);
  return `Resolution field on these closes: ${parts.join(", ")}.`;
}

/**
 * Plain-text summary for "Copy summary" and the CLI. Numbers only.
 * @param {import("./checker.js").CheckResult} r
 */
export function summaryText(r) {
  const lines = ["AI support checker: answered vs. completed (Gorgias export)", ""];
  if (r.notes.noAiTickets) {
    lines.push(`Tickets in the export: ${fmt(r.tickets)}`, NO_AI_TITLE);
    return lines.join("\n");
  }
  lines.push(headlineText(r), ESTIMATE_LINE, CAME_BACK_NOTE);
  if (r.notes.smallSample) lines.push(SMALL_SAMPLE_NOTE);
  lines.push("", "By category (AI-handled / closed by AI / AI action recorded / handed back / still open or snoozed / share of AI-handled):");
  for (const row of categoryRows(r)) {
    const mark = row.needsBackendAction ? "*" : " ";
    lines.push(
      `${mark} ${row.label}: ${fmt(row.aiHandled)} / ${fmt(row.aiClosed)} / ${fmt(row.aiActionDone)} / ${fmt(row.handedBack)} / ${fmt(row.aiOpen)} / ${row.share ?? "n/a"}`,
    );
  }
  lines.push("* needs an action outside the helpdesk");
  const resolution = resolutionLine(r);
  if (resolution) lines.push(resolution);
  lines.push(
    "",
    `Tickets in the export: ${fmt(r.tickets)}. AI-handled but not closed or handed back yet: ${fmt(r.ai.open)}.`,
    "Categories are an estimate from AI Intent, tags and keywords. Whether the refund, reship or 3PL change happened lives in Shopify, your 3PL and your carrier, not in the ticket.",
  );
  return lines.join("\n");
}

export const SKIP_REASONS = {
  empty_row: "empty line",
  column_count: "wrong number of columns (often a broken line in the file)",
  no_ticket_id: "no ticket id",
  duplicate_ticket_id: "same ticket id twice (counted once)",
};

export { plural };
