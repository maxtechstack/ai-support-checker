// Per-ticket classification: AI involvement, outcome, category. Pure functions.
import { normalizeTag, normalizeText } from "./rules.js";

/**
 * @typedef {"ai_closed" | "handed_back" | "ai_open" | "human_only"} Outcome
 * @typedef {{ tags: string[], subject: string, closed: boolean | null, aiField: string, extraText: string }} TicketInput
 * @typedef {{ aiInvolved: boolean, outcome: Outcome, category: string, needsBackendAction: boolean,
 *   flags: { bothCloseAndHandover: boolean, closeTagButOpen: boolean, fieldOnly: boolean } }} Classification
 */

/** Split the Tags cell. */
export function splitTags(cell, separator) {
  if (!cell) return [];
  return cell.split(separator).map((t) => t.trim()).filter(Boolean);
}

/**
 * @param {string} value AI Agent Outcome field
 * @param {import("./rules.js").GorgiasRules["ai"]["outcomeField"]} words
 * @returns {"close" | "handover" | "other" | null}
 */
export function outcomeFromField(value, words) {
  const v = normalizeText(value).trim();
  if (!v) return null;
  if (words.handoverWords.some((w) => v.includes(w))) return "handover";
  if (words.closeWords.some((w) => v.includes(w))) return "close";
  return "other";
}

/**
 * @param {string} text already normalized
 * @param {string[]} normTags
 * @param {import("./rules.js").CompiledRules} rules
 */
export function categorize(text, normTags, rules) {
  const { priority } = rules.categories;
  let best = priority.length - 1; // "other"
  for (const tag of normTags) {
    const c = rules.tagCategory.get(tag);
    if (c !== undefined) best = Math.min(best, priority.indexOf(c));
  }
  for (const { category, re } of rules.matchers) {
    const at = priority.indexOf(category);
    if (at >= best) break; // matchers are in priority order
    if (re.test(text)) {
      best = at;
      break;
    }
  }
  return priority[best];
}

/**
 * @param {TicketInput} t
 * @param {import("./rules.js").CompiledRules} rules
 * @returns {Classification}
 */
export function classifyTicket(t, rules) {
  const normTags = t.tags.map(normalizeTag);
  let close = false;
  let handover = false;
  let other = false;
  for (const tag of normTags) {
    if (rules.closeTags.has(tag)) close = true;
    else if (rules.handoverTags.has(tag)) handover = true;
    else if (rules.otherTags.has(tag)) other = true;
  }
  const flags = { bothCloseAndHandover: close && handover, closeTagButOpen: false, fieldOnly: false };
  if (!close && !handover && !other) {
    const fromField = outcomeFromField(t.aiField, rules.gorgias.ai.outcomeField);
    if (fromField) {
      flags.fieldOnly = true;
      close = fromField === "close";
      handover = fromField === "handover";
      other = fromField === "other";
    }
  }
  const aiInvolved = close || handover || other;

  /** @type {Outcome} */
  let outcome;
  if (!aiInvolved) outcome = "human_only";
  else if (handover) outcome = "handed_back"; // a handover means a human got the ticket, even if ai_close is also there
  else if (close && t.closed === false) {
    outcome = "ai_open"; // AI closed it once, but the ticket is open now: can't tell why from the export
    flags.closeTagButOpen = true;
  } else if (close) outcome = "ai_closed";
  else outcome = "ai_open";

  const text = normalizeText(`${t.subject}\n${normTags.join(" ").replace(/_/g, " ")}\n${t.extraText}`);
  const category = categorize(text, normTags, rules);
  return {
    aiInvolved,
    outcome,
    category,
    needsBackendAction: rules.categories.needsBackendAction.includes(category),
    flags,
  };
}
