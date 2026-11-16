import assert from "node:assert/strict";
import { test } from "node:test";
import { RULES, classifyTicket, compileRules, keywordPattern, outcomeFromField, splitTags } from "../core/index.js";
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

test("AI Agent Outcome field is used only when there is no AI tag", () => {
  const w = RULES.gorgias.ai.outcomeField;
  assert.equal(outcomeFromField("Close", w), "close");
  assert.equal(outcomeFromField("Handover", w), "handover");
  assert.equal(outcomeFromField("", w), null);
  const f = cls({ aiField: "Close" });
  assert.equal(f.outcome, "ai_closed");
  assert.ok(f.flags.fieldOnly);
  assert.equal(cls({ tags: ["ai_handover"], aiField: "Close" }).outcome, "handed_back");
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
});
