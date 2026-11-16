// Static guard for the main trust point: the page code never talks to the network.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { root } from "./helpers.js";

const NETWORK = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection)\b|https?:\/\/[^"'\s]*\.(js|mjs)\b/;

function files(dir, ext) {
  return readdirSync(join(root, dir)).filter((f) => f.endsWith(ext)).map((f) => join(root, dir, f));
}

test("core and web code make no network calls", () => {
  for (const f of [...files("core", ".js"), ...files("web", ".js")]) {
    const m = readFileSync(f, "utf8").match(NETWORK);
    assert.equal(m, null, `${f}: ${m?.[0]}`);
  }
});

test("core is pure: no DOM, no Node APIs", () => {
  for (const f of files("core", ".js")) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /from "node:|require\(|\bdocument\.|\bwindow\./, f);
  }
});

test("the page loads no third-party script or stylesheet", () => {
  const html = readFileSync(join(root, "web", "index.html"), "utf8");
  for (const m of html.matchAll(/<(script|link)\b[^>]*(src|href)="([^"]+)"/g)) {
    if (m[1] === "link" && !/rel="(stylesheet|preload|icon)"/.test(m[0])) continue;
    assert.ok(!/^(https?:)?\/\//.test(m[3]), `external ${m[1]}: ${m[3]}`);
  }
});

test("the page writes file-derived values with textContent only", () => {
  const app = readFileSync(join(root, "web", "app.js"), "utf8");
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});
