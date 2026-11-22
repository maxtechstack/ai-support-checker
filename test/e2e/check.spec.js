import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkFile } from "../../cli/check.js";
import { summaryText } from "../../core/index.js";
import { root, sampleFiles } from "../helpers.js";

const samples = sampleFiles();

/**
 * On closewellhq.com, Cloudflare's edge adds its own scripts to the HTML (the /cdn-cgi/ bot-detection loader, and
 * the Web Analytics beacon when automatic injection is on). The /check/ CSP blocks them, which is the point, but the
 * browser logs each block. Those two sources, and only those, are ignored; any other violation still fails a test.
 * A blocked inline script is identified by its sha256: it must match an inline script in the served HTML that loads
 * from /cdn-cgi/. Serving locally there are no such scripts, so nothing is ignored.
 * @param {string} text console message
 * @param {Set<string>} injectedHashes sha256 (base64) of inline scripts in the served HTML that reference /cdn-cgi/
 */
export function isCloudflareInjection(text, injectedHashes) {
  const url = text.match(/(?:Loading the script|Refused to load the script) '([^']+)'/)?.[1];
  if (url) {
    const u = new URL(url, "https://closewellhq.com/");
    return u.hostname === "static.cloudflareinsights.com" || u.pathname.startsWith("/cdn-cgi/");
  }
  if (/Executing inline script/.test(text)) {
    const hash = text.match(/'sha256-([A-Za-z0-9+/=]+)'/)?.[1];
    return Boolean(hash && injectedHashes.has(hash));
  }
  return false;
}

/** Load the page and start recording every request made after load, and every unexpected CSP violation. */
async function open(page) {
  const requests = [];
  const violations = [];
  const early = [];
  /** @type {Set<string> | null} */
  let injected = null;
  page.on("console", (m) => {
    const text = m.text();
    if (!/Content Security Policy|Refused to/.test(text)) return;
    if (!injected) early.push(text);
    else if (!isCloudflareInjection(text, injected)) violations.push(text);
  });
  const res = await page.goto("/check/", { waitUntil: "load" });
  const html = res ? await res.text() : "";
  injected = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1].includes("/cdn-cgi/")) injected.add(createHash("sha256").update(m[1]).digest("base64"));
  }
  await page.waitForLoadState("networkidle");
  violations.push(...early.filter((t) => !isCloudflareInjection(t, /** @type {Set<string>} */ (injected))));
  page.on("request", (r) => requests.push(r.url()));
  return { requests, violations };
}

async function drop(page, path) {
  await page.setInputFiles("#file", path);
}

/** Ticket values from a sample that must never show up on the page. */
function forbiddenStrings(csvPath) {
  const lines = readFileSync(csvPath, "utf8").split("\r\n").slice(1).filter(Boolean);
  const out = new Set();
  for (const line of lines) {
    const id = line.slice(0, line.indexOf(","));
    out.add(id);
    for (const m of line.matchAll(/[\w.]+@example\.com|NW\d{5}|https:\/\/[^,]+/g)) out.add(m[0]);
    const name = line.match(/@example\.com,([A-Z][a-z]+ [A-Z][a-z]+),/);
    if (name) out.add(name[1]);
  }
  return [...out];
}

test("3,000 tickets: result shown, zero requests while processing, no ticket text in the DOM", async ({ page }) => {
  const { requests, violations } = await open(page);
  await drop(page, samples["gorgias-3000"]);
  await expect(page.locator("#result")).toBeVisible();
  await page.locator("#counted summary").click();
  expect(requests).toEqual([]);
  expect(violations).toEqual([]);
  await expect(page.locator("#headline")).toContainText("Your AI agent handled 1,833 tickets.");
  const html = await page.content();
  const text = await page.locator("body").innerText();
  const leaks = forbiddenStrings(samples["gorgias-3000"]).filter((s) => html.includes(s) || text.includes(s));
  expect(leaks).toEqual([]);
  for (const subject of ["My mug arrived damaged", "Package marked as delivered", "Refund request for order"]) {
    expect(text).not.toContain(subject);
  }
});

test("page and CLI give identical numbers (Copy summary = CLI summary)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page);
  for (const name of ["gorgias-3000", "gorgias-small", "messy", "gorgias-no-ai", "gorgias-ai-real-tags"]) {
    await drop(page, samples[name]);
    await expect(page.locator("#result")).toBeVisible();
    await page.locator("#copy").click();
    await expect(page.locator("#copy-status")).toHaveText("Summary copied.");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied, name).toBe(summaryText(/** @type {any} */ (await checkFile(samples[name]))));
    await page.locator("#again").click();
  }
});

test("synthetic sample: download link, then drop it in, same numbers as the CLI", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { requests, violations } = await open(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#sample").click()]);
  expect(download.suggestedFilename()).toBe("gorgias-3000.csv");
  const saved = test.info().outputPath("gorgias-3000.csv");
  await download.saveAs(saved);
  expect(readFileSync(saved, "utf8")).toBe(readFileSync(samples["gorgias-3000"], "utf8"));
  // A browser download from the link (Chrome doesn't report it as a page request), not a fetch from page code.
  expect(new URL(download.url()).pathname).toBe("/check/sample/gorgias-3000.csv");
  expect(requests).toEqual([]);
  await drop(page, saved);
  await expect(page.locator("#result")).toBeVisible();
  expect(requests).toEqual([]);
  expect(violations).toEqual([]);
  await page.locator("#copy").click();
  await expect(page.locator("#copy-status")).toHaveText("Summary copied.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(summaryText(/** @type {any} */ (await checkFile(samples["gorgias-3000"]))));
});

test("50,000 tickets in under 10 seconds with the page responsive", async ({ page }) => {
  const { requests } = await open(page);
  await page.evaluate(() => {
    window.__maxGap = 0;
    let last = performance.now();
    const tick = (now) => {
      window.__maxGap = Math.max(window.__maxGap, now - last);
      last = now;
      if (!window.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await drop(page, samples["gorgias-50000"]);
  await expect(page.locator("#result")).toBeVisible({ timeout: 15_000 });
  const ms = Number(await page.locator("html").getAttribute("data-ms"));
  const maxGap = await page.evaluate(() => ((window.__stop = true), window.__maxGap));
  console.log(`50,000 rows: ${ms} ms, longest frame gap ${Math.round(maxGap)} ms`);
  expect(ms).toBeLessThan(10_000);
  expect(maxGap).toBeLessThan(250);
  expect(requests).toEqual([]);
});

test("missing headers: clear error with found and expected columns", async ({ page }) => {
  const { requests } = await open(page);
  await drop(page, samples["missing-headers"]);
  await expect(page.locator("#error")).toBeVisible();
  await expect(page.locator("#error-body")).toContainText("“Tags”");
  await expect(page.locator("#error-found")).toHaveText("Ticket ID, Subject, Status");
  await expect(page.locator("#error-expected")).toContainText("Ticket id, Tags");
  await expect(page.locator("#error")).toContainText("header row only (never the data)");
  await expect(page.locator("#result")).toBeHidden();
  expect(requests).toEqual([]);
});

test("empty, header-only and non-CSV files", async ({ page }) => {
  await open(page);
  await drop(page, samples.empty);
  await expect(page.locator("#error-title")).toHaveText("The file is empty.");
  await drop(page, samples["header-only"]);
  await expect(page.locator("#error-title")).toHaveText("The file is empty.");
  await drop(page, samples["not-a-csv"]);
  await expect(page.locator("#error-title")).toHaveText("This isn't a CSV file.");
  await page.setInputFiles("#file", { name: "export.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("PK") });
  await expect(page.locator("#error-title")).toHaveText("This isn't a CSV file.");
});

test("no AI tags: explains the fallback instead of showing zeros", async ({ page }) => {
  await open(page);
  await drop(page, samples["gorgias-no-ai"]);
  await expect(page.locator("#headline")).toHaveText("We found no tickets handled by Gorgias AI Agent in this export.");
  await expect(page.locator("#notes")).toContainText("export that view");
  await expect(page.locator("#table-wrap")).toBeHidden();
});

test("small sample note under 100 AI-handled tickets", async ({ page }) => {
  await open(page);
  await drop(page, samples["gorgias-small"]);
  await expect(page.locator("#notes")).toContainText("small sample");
});

test("phone width: page explains, says to use a laptop, no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/check/");
  await expect(page.locator(".mobile-note")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("without JavaScript the page says it needs it", async ({ request }) => {
  // Playwright's javaScriptEnabled:false is emulation: Chrome still parses <noscript> as raw text, so check the markup.
  const html = await (await request.get("/check/")).text();
  expect(html).toMatch(/<noscript>[^]*This checker needs JavaScript[^]*<\/noscript>/);
});

test("trial fixture (real AI Agent tags): zero requests, action sentence, action column, Resolution line", async ({ page }) => {
  const { requests, violations } = await open(page);
  await drop(page, samples["gorgias-ai-real-tags"]);
  await expect(page.locator("#result")).toBeVisible();
  await page.locator("#counted summary").click();
  expect(requests).toEqual([]);
  expect(violations).toEqual([]);
  await expect(page.locator("#headline")).toContainText("The AI recorded a completed action on 1 of them; the export can't show whether refunds, reships or 3PL changes were finished.");
  await expect(page.locator("#resolution-line")).toHaveText("Resolution field on these closes: 1 action (Order::Cancelled), 1 information only.");
  const orderChange = page.locator("#cat-rows tr", { hasText: "Order change" });
  await expect(orderChange.locator("td").nth(2)).toHaveText("1");
  await expect(page.locator("#counted-body")).toContainText("ai_executed_action");
  await expect(page.locator("#counted-body")).toContainText("order::damaged");
  await expect(page.locator("#counted-body")).toContainText("Rules version 2026-11-22.1");
  const text = await page.locator("body").innerText();
  for (const s of ["shopper1@example.com", "Shopper Two", "Ship to another country", "900003"]) expect(text).not.toContain(s);
});

test("CSP filter ignores only Cloudflare's own injected scripts", () => {
  const inline = "console.log(1)";
  const hash = createHash("sha256").update(inline).digest("base64");
  const msg = (h) => `Executing inline script violates the following Content Security Policy directive 'script-src 'self''. Either the 'unsafe-inline' keyword, a hash ('sha256-${h}'), or a nonce ('nonce-...') is required to enable inline execution. The action has been blocked.`;
  const load = (u) => `Loading the script '${u}' violates the following Content Security Policy directive: "script-src 'self'".`;
  expect(isCloudflareInjection(msg(hash), new Set([hash]))).toBe(true);
  expect(isCloudflareInjection(msg(hash), new Set())).toBe(false);
  expect(isCloudflareInjection(load("https://static.cloudflareinsights.com/beacon.min.js/v1"), new Set())).toBe(true);
  expect(isCloudflareInjection(load("https://closewellhq.com/cdn-cgi/challenge-platform/scripts/jsd/main.js"), new Set())).toBe(true);
  expect(isCloudflareInjection(load("https://evil.example/cdn-cgi.js"), new Set())).toBe(false);
  expect(isCloudflareInjection(load("https://static.cloudflareinsights.com.evil.example/x.js"), new Set())).toBe(false);
  expect(isCloudflareInjection("Refused to connect to 'https://example.com/' because it violates connect-src 'none'", new Set())).toBe(false);
});
