#!/usr/bin/env node
// Writes synthetic Gorgias view exports. Every name, email, order number and subject is made up;
// no real ticket is ever used. Seeded, so the same command always writes the same file.
//
//   node samples/generate.js                 all samples (the 50,000-row file is not committed)
//   node samples/generate.js --rows 1000 --seed 7 --out /tmp/x.csv
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Header row of a Gorgias view export (trial account, Nov 2, 2026), plus two ticket fields and a customer field.
export const HEADERS = [
  "Ticket id", "Tags", "Channel", "Priority", "Last used integration name", "Last used integration type",
  "Created by an agent", "Subject", "Creation date", "Closed date", "Survey score", "Survey replied date",
  "Assignee name", "Assignee email", "Customer email", "Customer name", "First response time (s)",
  "Resolution time (s)", "Number of agent messages", "Number of customer messages", "Ticket URL",
  "Ticket Field: Contact reason", "Ticket Field: AI Agent Outcome", "Customer Field: Customer Type",
];

/** mulberry32 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SUBJECTS = {
  damage_missing_wrong: [
    "My mug arrived damaged", "Box was broken on arrival", "Item missing from my package", "Received the wrong item",
    "Package marked as delivered but not here", "Wrong size sent", "Lid cracked in transit", "Order #{o} never arrived",
    "Paket beschädigt angekommen", "Colis endommagé", "Llegó roto", "Artikel ontbreekt in mijn pakket",
  ],
  order_change: [
    "Change my shipping address", "Can I add an item to my order?", "Cancel my order #{o}", "Update address on order #{o}",
    "Remove item from order", "Edit my order before it ships", "Bestellung ändern bitte", "Annuler ma commande",
  ],
  return_exchange: [
    "How do I return this?", "Refund request for order #{o}", "Exchange for a larger size", "Need a return label",
    "Refund still pending", "Rücksendung", "Demande de remboursement", "Quiero hacer una devolución",
  ],
  warranty: [
    "Kettle stopped working", "Warranty claim", "Lamp not working after a week", "Faulty charger",
    "Funktioniert nicht mehr", "Garantía de mi producto",
  ],
  subscription: [
    "Pause my subscription", "Skip my next box", "Cancel subscription", "Change subscription frequency",
    "Abonnement kündigen",
  ],
  wismo: [
    "Where is my order?", "Tracking number please", "Order status #{o}", "Still waiting for my order",
    "When will my order arrive?", "Wo ist meine Bestellung?", "Où est ma commande ?",
  ],
  other: [
    "Question about sizing", "Do you ship to Canada?", "Discount code invalid", "Product question",
    "Wholesale inquiry", "Hello", "Gift wrapping", "Which colour suits me?",
  ],
};

const CATEGORY_WEIGHTS = [
  ["wismo", 0.3], ["other", 0.2], ["return_exchange", 0.15], ["damage_missing_wrong", 0.12],
  ["order_change", 0.1], ["subscription", 0.08], ["warranty", 0.05],
];
const FIRST = ["Skyler", "Casey", "Finley", "Jordan", "Avery", "Rowan", "Quinn", "Emerson", "Harper", "Reese"];
const LAST = ["Ellsworth", "Lockhart", "Northcott", "Fairbanks", "Whitlow", "Ashdown", "Merriman", "Brookfield"];
const AGENTS = [["Marco Ruiz", "marco@northwind-goods.example"], ["Dana Kim", "dana@northwind-goods.example"]];
const CHANNELS = ["email", "chat", "contact_form", "instagram-direct-message"];

function pick(r, list) {
  return list[Math.floor(r() * list.length)];
}

function weighted(r, pairs) {
  let x = r();
  for (const [v, w] of pairs) {
    if ((x -= w) < 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

function csvCell(v) {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ts(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * @param {{ rows: number, seed: number, aiShare?: number }} opts
 */
export function generate({ rows, seed, aiShare = 0.6 }) {
  const r = rng(seed);
  const out = [HEADERS.map(csvCell).join(",")];
  const start = Date.UTC(2026, 9, 1);
  for (let i = 0; i < rows; i++) {
    const id = 200000 + i;
    const category = weighted(r, CATEGORY_WEIGHTS);
    const subject = pick(r, SUBJECTS[category]).replace("{o}", `NW${10000 + Math.floor(r() * 89999)}`);
    const tags = [];
    if (r() < 0.35 && category !== "other") tags.push(category === "wismo" ? "order-status" : category.split("_")[0]);
    let ai = r() < aiShare;
    let aiField = "";
    let human = false;
    let closed = true;
    if (ai) {
      const x = r();
      if (x < 0.5) tags.push("ai_close"), (aiField = "Close");
      else if (x < 0.82) tags.push("ai_handover"), (aiField = "Handover"), (human = true);
      else if (x < 0.86) tags.push("ai_answered", "ai_handover"), (aiField = "Handover"), (human = true);
      else if (x < 0.9) tags.push("ai_close", "ai_handover"), (human = true);
      else if (x < 0.94) tags.push("ai_snooze"), (closed = r() < 0.5);
      else if (x < 0.96) tags.push("ai_processing"), (closed = false);
      else if (x < 0.98) tags.push("ai_close"), (closed = false); // closed by AI, open again now
      else aiField = "Close"; // field only, no tag
    } else {
      human = true;
      closed = r() < 0.9;
      if (r() < 0.05) tags.push("ai_ignore");
    }
    if (r() < 0.1) tags.push("vip");
    const created = new Date(start + Math.floor(r() * 45 * 86400) * 1000);
    const closedAt = closed ? new Date(created.getTime() + Math.floor(r() * 3 * 86400) * 1000) : null;
    const agent = human ? pick(r, AGENTS) : ["", ""];
    const name = `${pick(r, FIRST)} ${pick(r, LAST)}`;
    const email = `${name.toLowerCase().replace(" ", ".")}${i}@example.com`;
    const row = [
      id, tags.join(","), pick(r, CHANNELS), "normal", "", "", "False", subject, ts(created),
      closedAt ? ts(closedAt) : "", r() < 0.2 ? 1 + Math.floor(r() * 5) : "", "", agent[0], agent[1], email, name,
      60 + Math.floor(r() * 3600), closedAt ? Math.floor((closedAt.getTime() - created.getTime()) / 1000) : "",
      1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3), `https://northwind-goods.gorgias.example/app/ticket/${id}`,
      r() < 0.3 ? category : "", aiField, pick(r, ["New", "Returning"]),
    ];
    out.push(row.map(csvCell).join(","));
  }
  return out.join("\r\n") + "\r\n";
}

/** Small files for edge cases; each has a golden output in test/golden/. */
export function edgeCases() {
  const small = generate({ rows: 120, seed: 11 });
  const noAi = generate({ rows: 200, seed: 12, aiShare: 0 });
  return {
    "gorgias-small.csv": small,
    "gorgias-no-ai.csv": noAi,
    "missing-headers.csv": "Ticket ID,Subject,Status\r\n1,Hello,closed\r\n",
    "empty.csv": "",
    "header-only.csv": HEADERS.join(",") + "\r\n",
    "not-a-csv.csv": "PK\u0003\u0004\u0014\u0000\u0006\u0000\u0008\u0000\u0000\u0000!\u0000xl/workbook.xml",
    "messy.csv":
      "﻿" + HEADERS.map((h) => ` ${h.toUpperCase()} `).join(",") + "\r\n" +
      generate({ rows: 30, seed: 13 }).split("\r\n").slice(1, 31).join("\r\n") + "\r\n" +
      "\r\n" + // empty line
      "200000,ai_close,email\r\n" + // short row
      generate({ rows: 3, seed: 13 }).split("\r\n")[1] + "\r\n", // duplicate id
  };
}

function main(argv) {
  const get = (flag, dflt) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : dflt;
  };
  if (argv.includes("--rows")) {
    const out = get("--out", join(here, "out.csv"));
    writeFileSync(out, generate({ rows: Number(get("--rows")), seed: Number(get("--seed", "1")) }));
    console.log(`wrote ${out}`);
    return;
  }
  mkdirSync(join(here, "edge"), { recursive: true });
  writeFileSync(join(here, "gorgias-3000.csv"), generate({ rows: 3000, seed: 1 }));
  writeFileSync(join(here, "gorgias-50000.csv"), generate({ rows: 50000, seed: 2 }));
  for (const [name, text] of Object.entries(edgeCases())) writeFileSync(join(here, "edge", name), text);
  console.log("wrote samples/gorgias-3000.csv, samples/gorgias-50000.csv and samples/edge/*");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
