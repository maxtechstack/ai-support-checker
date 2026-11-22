import assert from "node:assert/strict";
import { test } from "node:test";
import { RULES, categoryFromIntent, classifyTicket, compileRules, intentKey, keywordPattern, outcomeFromField, resolutionKind, splitTags } from "../core/index.js";
import { SUBJECTS } from "../samples/generate.js";

const rules = compileRules(RULES.gorgias, RULES.categories);
const t = (over = {}) => ({ tags: [], subject: "", closed: true, aiField: "", extraText: "", ...over });
const cls = (over) => classifyTicket(t(over), rules);

test("keyword patterns: whole words, wildcard endings, unicode letters", () => {
  const re = (k) => new RegExp(keywordPattern(k), "u");
  assert.ok(re("refund*").test("refunded please"));
  assert.ok(!re("refund*").test("prefund"));
  assert.ok(re("eta").test("what is the eta?"));
  assert.ok(!re("eta").test("metal box"));
  assert.ok(re("beschädigt").test("paket beschädigt angekommen"));
  assert.ok(!re("abo").test("über abonnement"), "abo must not match inside abonnement");
  assert.ok(re("where is my order").test("where   is my order?"));
  assert.ok(re("didn't receive").test("i didn't receive it"));
});

test("a bare cancellation tag doesn't decide the category; the subject does", () => {
  assert.equal(cls({ tags: ["ai_close", "cancellation"], subject: "Cancel my subscription" }).category, "subscription");
  assert.equal(cls({ tags: ["ai_close", "cancellation"], subject: "Please cancel my order" }).category, "order_change");
  assert.equal(cls({ tags: ["ai_close", "cancel_subscription"] }).category, "subscription");
});

test("AI outcome: close, handover, both, open, other, ignore", () => {
  assert.equal(cls({ tags: ["ai_close"] }).outcome, "ai_closed");
  assert.equal(cls({ tags: ["AI_Close"] }).outcome, "ai_closed", "tags are case-insensitive");
  assert.equal(cls({ tags: ["ai_handover"] }).outcome, "handed_back");
  const both = cls({ tags: ["ai_close", "ai_handover"] });
  assert.equal(both.outcome, "handed_back");
  assert.ok(both.flags.bothCloseAndHandover);
  const reopened = cls({ tags: ["ai_close"], closed: false });
  assert.equal(reopened.outcome, "ai_open");
  assert.ok(reopened.flags.closeTagButOpen);
  assert.equal(cls({ tags: ["ai_close"], closed: null }).outcome, "ai_closed", "no Closed date column: trust the tag");
  assert.equal(cls({ tags: ["ai_snooze"] }).outcome, "ai_open");
  assert.equal(cls({ tags: ["ai_answered", "ai_handover"] }).outcome, "handed_back");
  const ignored = cls({ tags: ["ai_ignore"] });
  assert.equal(ignored.aiInvolved, false);
  assert.equal(ignored.outcome, "human_only");
  assert.equal(cls({ tags: ["vip"] }).outcome, "human_only");
});

test("AI Agent Outcome field: exact prefixes for the five Gorgias values, used only when there is no AI tag", () => {
  const w = RULES.gorgias.ai.outcomeField;
  assert.equal(outcomeFromField("Close::With message", w), "close");
  assert.equal(outcomeFromField("Close::Without message", w), "close");
  assert.equal(outcomeFromField("Handover::With message", w), "handover");
  assert.equal(outcomeFromField("Handover::Without message", w), "handover");
  assert.equal(outcomeFromField("Snooze::With message", w), "snooze");
  assert.equal(outcomeFromField("close :: with message", w), "close", "case and spaces around :: don't matter");
  assert.equal(outcomeFromField("Closed by agent", w), "other", "no guessing on words: only the prefixes count");
  assert.equal(outcomeFromField("", w), null);
  const f = cls({ aiField: "Close::Without message" });
  assert.equal(f.outcome, "ai_closed");
  assert.ok(f.flags.fieldOnly);
  assert.equal(f.action, "no_action_recorded");
  assert.equal(cls({ aiField: "Handover::Without message" }).outcome, "handed_back");
  const snoozed = cls({ aiField: "Snooze::With message", closed: true });
  assert.equal(snoozed.outcome, "ai_open", "Snooze:: means waiting, even with a Closed date");
  assert.ok(snoozed.aiInvolved);
  assert.equal(cls({ tags: ["ai_handover"], aiField: "Close::With message" }).outcome, "handed_back");
});

test("snoozed ticket with a Closed date stays open (Gorgias closes tickets while they're snoozed)", () => {
  const s = cls({ tags: ["ai_answered", "ai_snooze"], closed: true, aiField: "Snooze::With message" });
  assert.equal(s.outcome, "ai_open");
  assert.equal(s.action, null);
  assert.equal(s.flags.closeTagButOpen, false);
});

test("ai_answered sits next to an outcome and is never an outcome by itself", () => {
  assert.equal(cls({ tags: ["ai_answered", "ai_close"] }).outcome, "ai_closed");
  assert.equal(cls({ tags: ["ai_answered", "ai_handover"] }).outcome, "handed_back");
  assert.equal(cls({ tags: ["ai_answered"] }).outcome, "ai_open");
});

test("action status on AI-closed tickets: done wins over failed, then no action recorded", () => {
  assert.equal(cls({ tags: ["ai_answered", "ai_close", "ai_executed_action"] }).action, "action_done");
  assert.equal(cls({ tags: ["ai_answered", "ai_close", "ai_failed_action"] }).action, "action_failed");
  assert.equal(cls({ tags: ["ai_close", "ai_executed_action", "ai_failed_action"] }).action, "action_done");
  assert.equal(cls({ tags: ["ai_answered", "ai_close"] }).action, "no_action_recorded");
  assert.equal(cls({ tags: ["ai_handover", "ai_executed_action"] }).action, null, "only AI-closed tickets get an action status");
  assert.equal(cls({ tags: ["ai_close", "ai_executed_action"], closed: false }).action, null, "reopened: not AI-closed");
  assert.ok(cls({ tags: ["ai_executed_action"] }).aiInvolved, "an action tag alone still means the AI was involved");
});

test("AI Intent wins over tags and keywords; unknown intents fall back", () => {
  assert.equal(intentKey("Order::Cancel::Other"), "order::cancel");
  assert.equal(intentKey(" Order :: Missing  item :: Other "), "order::missing item");
  assert.equal(categoryFromIntent("Order::Damaged::Other", rules), "damage_missing_wrong");
  assert.equal(categoryFromIntent("Pre-sale::Website questions::Other", rules), "other", "level::* matches any second level");
  assert.equal(categoryFromIntent("Order::Payment::Other", rules), null);
  assert.equal(categoryFromIntent("", rules), null);
  // The trial's ticket 900005: ORDER-STATUS tag, but the intent is a shipping question.
  const row = { tags: ["ai_answered", "ai_close", "ORDER-STATUS"], subject: "Ship to another country" };
  assert.equal(cls(row).category, "wismo", "without AI Intent the tag decides");
  const withIntent = cls({ ...row, aiIntent: "Shipping::Information::Other" });
  assert.equal(withIntent.category, "other");
  assert.ok(withIntent.flags.categoryFromIntent);
  assert.equal(cls({ subject: "Where is my order?", aiIntent: "Order::Damaged::Other" }).category, "damage_missing_wrong");
  assert.equal(cls({ subject: "My mug arrived damaged", aiIntent: "Order::Payment::Other" }).category, "damage_missing_wrong", "unknown intent: keywords decide");
});

test("Resolution field kinds: action values keep the rules' spelling, never file text", () => {
  assert.deepEqual(resolutionKind("Order::Cancelled", rules), { kind: "action", value: "Order::Cancelled" });
  assert.deepEqual(resolutionKind(" replacement SENT ", rules), { kind: "action", value: "Replacement sent" });
  assert.deepEqual(resolutionKind("Information Given", rules), { kind: "info", value: null });
  assert.deepEqual(resolutionKind("No action", rules), { kind: "info", value: null });
  assert.deepEqual(resolutionKind("Discount", rules), { kind: "other", value: null });
  assert.deepEqual(resolutionKind("", rules), { kind: "empty", value: null });
});

test("categories: priority order and tags", () => {
  assert.equal(cls({ subject: "Where is my order? It arrived damaged" }).category, "damage_missing_wrong");
  assert.equal(cls({ subject: "Refund for the broken lamp" }).category, "damage_missing_wrong");
  assert.equal(cls({ subject: "Cancel my order and refund" }).category, "order_change");
  assert.equal(cls({ subject: "Hello", tags: ["Order-Status"] }).category, "wismo");
  assert.equal(cls({ subject: "Hello", tags: ["return"] }).category, "return_exchange");
  assert.equal(cls({ subject: "Hello", extraText: "warranty" }).category, "warranty");
  assert.equal(cls({ subject: "Do you ship to Canada?" }).category, "other");
  assert.equal(cls({ subject: "Lid cracked" }).needsBackendAction, true);
  assert.equal(cls({ subject: "Tracking number please" }).needsBackendAction, false, "WISMO is not an exception");
});

test("every synthetic subject lands in the category it was written for", () => {
  for (const [category, subjects] of Object.entries(SUBJECTS)) {
    for (const s of subjects) {
      assert.equal(cls({ subject: s.replace("{o}", "NW12345") }).category, category, s);
    }
  }
});

test("tags cell splits on the separator and trims", () => {
  assert.deepEqual(splitTags(" ai_close, vip ,,", ","), ["ai_close", "vip"]);
  assert.deepEqual(splitTags("", ","), []);
});

test("rules files are consistent", () => {
  const c = RULES.categories;
  assert.equal(c.priority.at(-1), "other");
  assert.deepEqual(c.needsBackendAction, c.priority.slice(0, 5));
  for (const id of c.priority) assert.ok(c.labels[id], `label for ${id}`);
  for (const lang of Object.values(c.keywords)) {
    for (const k of Object.keys(lang)) if (k !== "basic") assert.ok(c.priority.includes(k), k);
  }
  for (const k of Object.keys(c.intents)) if (k !== "$comment") assert.ok(c.priority.includes(k), `intents: ${k}`);
  const seen = new Set();
  for (const [k, list] of Object.entries(c.intents)) {
    if (k === "$comment") continue;
    for (const i of list) {
      assert.equal(i, i.toLowerCase(), `intents are lowercase: ${i}`);
      assert.ok(!seen.has(i), `intent listed twice: ${i}`);
      seen.add(i);
    }
  }
});
