#!/usr/bin/env node
// Writes docs/screenshot.png: the result for the synthetic 3,000-ticket sample (never a real export).
import { chromium } from "@playwright/test";
import { join } from "node:path";
import { startServer } from "./serve.js";
import { root } from "../test/helpers.js";

const server = await startServer(8789);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:8789/check/");
await page.setInputFiles("#file", join(root, "samples", "gorgias-3000.csv"));
await page.locator("#result").waitFor();
await page.locator(".result .wrap").screenshot({ path: join(root, "docs", "screenshot.png"), animations: "disabled" });
await browser.close();
server.close();
console.log("wrote docs/screenshot.png");
