import assert from "node:assert/strict";
import { test } from "node:test";
import { createChecker, createRowFeed, RULES, categoryRows, headlineText, mapHeaders, percent, summaryText } from "../core/index.js";

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
  assert.deepEqual(r.ai, { handled: 4, closed: 2, handedBack: 1, open: 1, bothCloseAndHandover: 0, closeTagButOpen: 1, fieldOnly: 0 });
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
