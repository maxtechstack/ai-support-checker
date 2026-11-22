// Per-ticket classification: AI involvement, outcome, category. Pure functions.
import { intentKey, normalizeTag, normalizeText } from "./rules.js";

/**
 * @typedef {"ai_closed" | "handed_back" | "ai_open" | "human_only"} Outcome
 * @typedef {"action_done" | "action_failed" | "no_action_recorded"} ActionStatus
 * @typedef {"action" | "info" | "other" | "empty"} ResolutionKind
 * @typedef {{ tags: string[], subject: string, closed: boolean | null, aiField: string, extraText: string,
 *   aiIntent?: string, resolution?: string }} TicketInput
 * @typedef {{ aiInvolved: boolean, outcome: Outcome, category: string, needsBackendAction: boolean,
 *   action: ActionStatus | null, resolution: { kind: ResolutionKind, value: string | null },
 *   flags: { bothCloseAndHandover: boolean, closeTagButOpen: boolean, fieldOnly: boolean, categoryFromIntent: boolean } }} Classification
 */

/** Split the Tags cell. */
export function splitTags(cell, separator) {
  if (!cell) return [];
  return cell.split(separator).map((t) => t.trim()).filter(Boolean);
}

/**
 * @param {string} value AI Agent Outcome field, e.g. "Close::With message"
 * @param {import("./rules.js").GorgiasRules["ai"]["outcomeField"]} prefixes
 * @returns {"close" | "handover" | "snooze" | "other" | null}
 */
export function outcomeFromField(value, prefixes) {
  const v = normalizeText(value).trim().replace(/\s*::\s*/g, "::");
  if (!v) return null;
  const starts = (list) => (list || []).some((p) => v.startsWith(normalizeText(p).trim()));
  if (starts(prefixes.handoverPrefixes)) return "handover";
  if (starts(prefixes.closePrefixes)) return "close";
  if (starts(prefixes.snoozePrefixes)) return "snooze";
  return "other";
}

/**
 * Category from the AI Intent field, or null when the intent is empty or not in the rules.
 * @param {string} value
 * @param {import("./rules.js").CompiledRules} rules
 * @returns {string | null}
 */
export function categoryFromIntent(value, rules) {
  const key = intentKey(value);
  if (!key) return null;
  return rules.intentCategory.get(key) ?? rules.intentCategory.get(`${key.split("::")[0]}::*`) ?? null;
}

/**
 * The Resolution field as a kind, plus the rules' spelling of the value for action values (never file text).
 * @param {string} value
 * @param {import("./rules.js").CompiledRules} rules
 * @returns {{ kind: ResolutionKind, value: string | null }}
 */
export function resolutionKind(value, rules) {
  const v = normalizeText(value).trim();
  if (!v) return { kind: "empty", value: null };
  if (rules.resolutionAction.has(v)) {
    const canonical = rules.gorgias.resolution.actionValues.find((a) => normalizeText(a).trim() === v) ?? null;
    return { kind: "action", value: canonical };
  }
  if (rules.resolutionInfo.has(v)) return { kind: "info", value: null };
  return { kind: "other", value: null };
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
  let actionDone = false;
  let actionFailed = false;
  for (const tag of normTags) {
    if (rules.closeTags.has(tag)) close = true;
    else if (rules.handoverTags.has(tag)) handover = true;
    else if (rules.otherTags.has(tag)) other = true;
    else if (rules.actionDoneTags.has(tag)) (actionDone = true), (other = true);
    else if (rules.actionFailedTags.has(tag)) (actionFailed = true), (other = true);
  }
  const flags = { bothCloseAndHandover: close && handover, closeTagButOpen: false, fieldOnly: false, categoryFromIntent: false };
  if (!close && !handover && !other) {
    const fromField = outcomeFromField(t.aiField, rules.gorgias.ai.outcomeField);
    if (fromField) {
      flags.fieldOnly = true;
      close = fromField === "close";
      handover = fromField === "handover";
      other = fromField === "snooze" || fromField === "other"; // a snoozed ticket is waiting: ai_open
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
  else outcome = "ai_open"; // includes ai_snooze, even though Gorgias exports snoozed tickets with a Closed date

  // AI Intent first (Gorgias fills it automatically); tags and keywords only when it's empty or not in the rules.
  let category = categoryFromIntent(t.aiIntent ?? "", rules);
  if (category) flags.categoryFromIntent = true;
  else {
    const text = normalizeText(`${t.subject}\n${normTags.join(" ").replace(/_/g, " ")}\n${t.extraText}`);
    category = categorize(text, normTags, rules);
  }

  /** @type {ActionStatus | null} */
  let action = null;
  if (outcome === "ai_closed") action = actionDone ? "action_done" : actionFailed ? "action_failed" : "no_action_recorded";
  return {
    aiInvolved,
    outcome,
    category,
    needsBackendAction: rules.categories.needsBackendAction.includes(category),
    action,
    resolution: resolutionKind(t.resolution ?? "", rules),
    flags,
  };
}
