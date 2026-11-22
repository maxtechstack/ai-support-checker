import assert from "node:assert/strict";
import { test } from "node:test";
import { CAME_BACK_NOTE, createChecker, createRowFeed, ESTIMATE_LINE, RULES, categoryRows, headlineText, mapHeaders, percent, resolutionLine, summaryText } from "../core/index.js";

const H = ["Ticket id", "Tags", "Subject", "Closed date"];

function run(rows, header = H) {
  const feed = createRowFeed(RULES);
  assert.equal(feed.rows([header, ...rows]), null);
  return feed.finish();
}

test("headers: case-insensitive, trimmed, BOM removed", () => {
  const m = mapHeaders(["﻿ticket ID ", " TAGS", "subject"], RULES.gorgias);
  assert.ok(m.ok);
  assert.equal(m.index.ticketId, 0);
  assert.equal(m.index.tags, 1);
  assert.ok(m.missingOptional.includes("Closed date"));
});

test("missing required headers give the error with found and expected lists", () => {
  const c = createChecker(RULES);
  const err = c.header(["Ticket ID", "Subject"]);
  assert.equal(err.code, "missing_headers");
  assert.deepEqual(err.missing, ["Tags"]);
  assert.deepEqual(err.found, ["Ticket ID", "Subject"]);
  assert.ok(err.expected.includes("Tags"));
});

test("counts: outcomes, exceptions closed by AI, skipped rows", () => {
  const r = run([
    ["1", "ai_close", "My mug arrived damaged", "2026-10-01 10:00:00"],
    ["2", "ai_close", "Where is my order?", "2026-10-01 10:00:00"],
    ["3", "ai_handover", "Refund please", "2026-10-01 10:00:00"],
    ["4", "ai_close", "Change my address", ""],
    ["5", "", "Hello", "2026-10-01 10:00:00"],
    ["5", "ai_close", "dupe", "2026-10-01 10:00:00"],
    ["", "ai_close", "no id", "x"],
    ["6", "ai_close"],
  ]);
  assert.equal(r.tickets, 5);
  assert.deepEqual(r.ai, {
    handled: 4, closed: 2, handedBack: 1, open: 1, bothCloseAndHandover: 0, closeTagButOpen: 1, fieldOnly: 0,
    categoryFromIntent: 0, actionDone: 0, actionFailed: 0, noActionRecorded: 2,
  });
  assert.equal(r.exceptionsClosedByAi, 1);
  assert.equal(r.humanOnly, 1);
  assert.deepEqual(r.rows.skipped, { empty_row: 0, column_count: 1, no_ticket_id: 1, duplicate_ticket_id: 1 });
  assert.ok(r.notes.smallSample);
  assert.equal(r.notes.cameBackAvailable, false);
  assert.match(headlineText(r), /^Your AI agent handled 4 tickets\. It closed 2 without a human and handed 1 back to your team\. 1 of the tickets it closed alone was a post-purchase exception/);
});

test("no AI tags at all: noAiTickets, and the summary says so instead of zeros", () => {
  const r = run([["1", "vip", "Hello", "x"], ["2", "", "Where is my order", "x"]]);
  assert.ok(r.notes.noAiTickets);
  assert.equal(r.notes.smallSample, false);
  assert.match(summaryText(r), /found no tickets handled by Gorgias AI Agent/);
});

test("percentages: none under 20 tickets in a category; <1% for tiny shares", () => {
  assert.equal(percent(5, 19), null);
  assert.equal(percent(5, 20), "25%");
  assert.equal(percent(1, 300), "<1%");
  assert.equal(percent(0, 50), "0%");
  const rows = [];
  for (let i = 0; i < 25; i++) rows.push([`d${i}`, "ai_close", "It arrived damaged", "x"]);
  for (let i = 0; i < 5; i++) rows.push([`w${i}`, "ai_close", "Warranty claim", "x"]);
  const r = run(rows);
  const byId = Object.fromEntries(categoryRows(r).map((c) => [c.id, c]));
  assert.equal(byId.damage_missing_wrong.share, "83%");
  assert.equal(byId.warranty.share, null);
  assert.equal(byId.warranty.aiHandled, 5);
});

test("empty input and header-only input are 'empty'", () => {
  assert.deepEqual(createRowFeed(RULES).finish(), { code: "empty" });
  const feed = createRowFeed(RULES);
  feed.rows([H]);
  assert.deepEqual(feed.finish(), { code: "empty" });
});

test("binary content is rejected", () => {
  const feed = createRowFeed(RULES);
  assert.deepEqual(feed.sniff("PK\u0003\u0004\u0000\u0000"), { code: "not_csv" });
  assert.deepEqual(feed.finish(), { code: "not_csv" });
});

test("the result holds counts only: no strings from the file except header names", () => {
  const r = run([["123456", "ai_close", "Secret subject jane@example.com", "x"]]);
  const json = JSON.stringify(r);
  assert.ok(!json.includes("Secret"));
  assert.ok(!json.includes("jane@example.com"));
  assert.ok(!json.includes("123456"));
});

test("summary carries the v1 estimates line right after the headline", async () => {
  const { readFileSync } = await import("node:fs");
  const { checkFile } = await import("../cli/check.js");
  const r = await checkFile(new URL("../samples/edge/gorgias-small.csv", import.meta.url).pathname);
  const lines = summaryText(/** @type {any} */ (r)).split("\n");
  assert.equal(lines[2], headlineText(/** @type {any} */ (r)));
  assert.equal(lines[3], ESTIMATE_LINE);
  assert.match(readFileSync(new URL("../web/index.html", import.meta.url), "utf8"), /id="headline"[^>]*><\/div>\s*<p class="small muted estimate" id="estimate"/);
});

const HX = ["Ticket id", "Tags", "Subject", "Closed date", "Ticket Field: AI Intent", "Ticket Field: Resolution", "Ticket Field: AI Agent Outcome"];

test("action counts and Resolution line on AI-closed exceptions, including a synthetic ai_failed_action row", () => {
  const r = run(
    [
      ["1", "ai_answered,ai_close,ai_executed_action", "Cancel", "x", "Order::Cancel::Other", "Order::Cancelled", "Close::With message"],
      ["2", "ai_answered,ai_close,ai_failed_action", "Cancel", "x", "Order::Cancel::Other", "No action", "Close::With message"],
      ["3", "ai_answered,ai_close", "Broken", "x", "Order::Damaged::Other", "Information Given", "Close::With message"],
      ["4", "ai_answered,ai_close", "Hi", "x", "Order::Status::Other", "Information Given", "Close::With message"],
      ["5", "ai_answered,ai_snooze", "Hi", "x", "Order::Damaged::Other", "", "Snooze::With message"],
    ],
    HX,
  );
  assert.equal(r.ai.closed, 4);
  assert.equal(r.ai.open, 1, "snoozed with a Closed date is still open");
  assert.equal(r.exceptionsClosedByAi, 3);
  assert.deepEqual(r.exceptionActions, { actionDone: 1, actionFailed: 1, noActionRecorded: 1 });
  assert.deepEqual([r.ai.actionDone, r.ai.actionFailed, r.ai.noActionRecorded], [1, 1, 2]);
  assert.equal(categoryRows(r).find((c) => c.id === "order_change").aiActionDone, 1);
  assert.equal(resolutionLine(r), "Resolution field on these closes: 1 action (Order::Cancelled), 2 information only.");
  assert.match(headlineText(r), /3 of the tickets it closed alone were post-purchase exceptions .* The AI recorded a completed action in Shopify on 1 of them and a failed action on 1; the export can't show whether refunds, reships or 3PL changes were finished\.$/);
});

test("action sentence: none recorded, singular, and no sentence without exceptions", () => {
  const none = run([["1", "ai_close", "Broken", "x"], ["2", "ai_close", "Damaged", "x"]]);
  assert.match(headlineText(none), /2 of the tickets it closed alone were .* The export shows no action recorded by the AI on any of them, and can't show whether refunds, reships or 3PL changes were finished\.$/);
  assert.equal(resolutionLine(none), null, "no Resolution column: no line");
  const one = run([["1", "ai_close,ai_executed_action", "Cancel my order", "x"]]);
  assert.match(headlineText(one), /1 of the tickets it closed alone was a post-purchase exception .* The AI recorded a completed action in Shopify on it; the export can't/);
  const oneNone = run([["1", "ai_close", "Broken", "x"]]);
  assert.match(headlineText(oneNone), /no action recorded by the AI on it, and can't show/);
  const zero = run([["1", "ai_close", "Where is my order", "x"]]);
  assert.match(headlineText(zero), /0 of the tickets it closed alone were post-purchase exceptions \(claims, order changes, return exceptions\) that need an action outside your helpdesk\.$/);
});

test("Resolution line is hidden when the column is there but empty on every AI-closed exception", () => {
  const r = run([["1", "ai_close", "Broken", "x", "", "", ""]], HX);
  assert.equal(r.exceptionResolution.columnPresent, true);
  assert.equal(resolutionLine(r), null);
});

test("came-back note stays under 220 characters", () => {
  assert.ok(CAME_BACK_NOTE.length < 220, String(CAME_BACK_NOTE.length));
});

test("trial fixture: 5 AI-handled, 3 closed, 2 handed back, AI Intent categories, 1 completed action", async () => {
  const { checkFile } = await import("../cli/check.js");
  const r = /** @type {any} */ (await checkFile(new URL("../samples/edge/gorgias-ai-real-tags.csv", import.meta.url).pathname));
  assert.deepEqual([r.ai.handled, r.ai.closed, r.ai.handedBack, r.ai.open], [5, 3, 2, 0]);
  const by = Object.fromEntries(r.categories.map((c) => [c.id, c.aiHandled]));
  assert.deepEqual(by, { damage_missing_wrong: 1, order_change: 2, return_exchange: 0, warranty: 0, subscription: 0, wismo: 1, other: 1 });
  assert.equal(r.exceptionsClosedByAi, 2);
  assert.deepEqual(r.exceptionActions, { actionDone: 1, actionFailed: 0, noActionRecorded: 1 });
  assert.equal(resolutionLine(r), "Resolution field on these closes: 1 action (Order::Cancelled), 1 information only.");
});
