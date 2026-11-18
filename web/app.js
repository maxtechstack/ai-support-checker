// Page logic. The file is read by worker.js; this side only ever receives counts.
// Everything is written with textContent: no ticket text reaches the DOM.
import {
  CAME_BACK_NOTE, ESTIMATE_LINE, NO_AI_BODY, NO_AI_TITLE, SMALL_SAMPLE_NOTE, SKIP_REASONS,
  categoryRows, fmt, headlineParts, summaryText,
} from "../core/report.js";
import { RULES } from "../core/rules-data.js";

const REPO = "https://github.com/maxtechstack/ai-support-checker";
const NOT_CSV_EXT = /\.(xlsx|xls|numbers|ods|zip|gz|pdf|json|xml|txt|tsv)$/i;

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @param {string} tag @param {Record<string, string>} [attrs] @param {(Node | string)[]} [kids] */
function el(tag, attrs = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const kid of kids) node.append(kid);
  return node;
}

let worker = null;
/** @type {import("../core/checker.js").CheckResult | null} */
let last = null;

function show(id, on) {
  $(id).hidden = !on;
}

function reset() {
  show("status", false);
  show("error", false);
  show("result", false);
  last = null;
}

function showError(title, body, headers) {
  show("status", false);
  $("error-title").textContent = title;
  $("error-body").textContent = body;
  show("error-headers", Boolean(headers));
  if (headers) {
    $("error-found").textContent = headers.found.filter(Boolean).join(", ") || "(none)";
    $("error-expected").textContent = headers.expected.join(", ");
  }
  show("error", true);
  $("error").focus?.();
}

function handleError(err) {
  if (err.code === "missing_headers") {
    showError(
      "This doesn't look like a Gorgias ticket export.",
      `It's missing the column${err.missing.length > 1 ? "s" : ""} ${err.missing.map((m) => `“${m}”`).join(" and ")}.`,
      err,
    );
  } else if (err.code === "empty") {
    showError("The file is empty.", "There are no ticket rows in it. Export the view again from Gorgias and drop the new file here.");
  } else if (err.code === "not_csv") {
    showError("This isn't a CSV file.", "Export the view from Gorgias as CSV (the file Gorgias emails you) and drop that file here.");
  } else {
    showError("We couldn't read this file.", "Try exporting it again from Gorgias. If it keeps happening, tell us what you see (never the data).");
  }
}

// One worker, started at page load, so every script and module it needs is fetched before a file is chosen:
// while a file is processed the page makes no request at all.
let runId = 0;
let t0 = 0;

function createWorker() {
  worker = new Worker(new URL("worker.js", import.meta.url));
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.run !== runId) return; // an older file, replaced by a newer one
    if (msg.type === "progress") {
      /** @type {HTMLProgressElement} */ ($("progress")).value = Math.round(msg.share * 100);
    } else if (msg.type === "error") {
      handleError(msg.error);
    } else if (msg.type === "done") {
      document.documentElement.dataset.ms = String(Math.round(performance.now() - t0));
      show("status", false);
      render(msg.result);
    }
  };
  worker.onerror = () => handleError({ code: "read" });
}

/** @param {File} file */
function start(file) {
  reset();
  runId++;
  if (NOT_CSV_EXT.test(file.name)) return handleError({ code: "not_csv" });
  if (file.size === 0) return handleError({ code: "empty" });
  $("status-text").textContent = "Reading your file in your browser…";
  /** @type {HTMLProgressElement} */ ($("progress")).value = 0;
  show("status", true);
  t0 = performance.now();
  worker.postMessage({ type: "start", file, run: runId });
}

/** @param {import("../core/checker.js").CheckResult} r */
function render(r) {
  last = r;
  const headline = $("headline");
  headline.replaceChildren();
  const notes = $("notes");
  notes.replaceChildren();
  if (r.notes.noAiTickets) {
    headline.append(el("p", {}, [String(NO_AI_TITLE)]));
    notes.append(el("li", {}, [String(NO_AI_BODY)]), el("li", {}, [`Tickets in the export: ${fmt(r.tickets)}.`]));
    show("table-wrap", false);
    show("estimate", false);
  } else {
    for (const sentence of headlineParts(r)) {
      headline.append(...sentence.map((p) => (typeof p === "string" ? p : el("strong", {}, [fmt(p.n)]))), " ");
    }
    $("estimate").textContent = ESTIMATE_LINE;
    show("estimate", true);
    notes.append(el("li", {}, [String(CAME_BACK_NOTE)]));
    if (r.notes.smallSample) notes.append(el("li", { class: "warn" }, [String(SMALL_SAMPLE_NOTE)]));
    if (r.ai.open) notes.append(el("li", {}, [`${fmt(r.ai.open)} AI-handled tickets were neither closed by AI nor handed back (still open, snoozed, or closed by AI and opened again).`]));
    renderTable(r);
    show("table-wrap", true);
  }
  renderCounted(r);
  show("result", true);
  $("result-title").setAttribute("tabindex", "-1");
  $("result-title").focus();
}

/** @param {import("../core/checker.js").CheckResult} r */
function renderTable(r) {
  const body = $("cat-rows");
  body.replaceChildren();
  for (const row of categoryRows(r)) {
    const name = el("th", { scope: "row" }, [row.label]);
    if (row.needsBackendAction) name.append(" ", el("span", { class: "tag" }, ["needs action"]));
    body.append(
      el("tr", row.needsBackendAction ? { class: "exception" } : {}, [
        name,
        el("td", {}, [fmt(row.aiHandled)]),
        el("td", {}, [fmt(row.aiClosed)]),
        el("td", {}, [fmt(row.handedBack)]),
        el("td", {}, [fmt(row.aiOpen)]),
        el("td", {}, [row.share ?? "–"]),
      ]),
    );
  }
  $("cat-foot").replaceChildren(
    el("tr", {}, [
      el("th", { scope: "row" }, ["All AI-handled"]),
      el("td", {}, [fmt(r.ai.handled)]),
      el("td", {}, [fmt(r.ai.closed)]),
      el("td", {}, [fmt(r.ai.handedBack)]),
      el("td", {}, [fmt(r.ai.open)]),
      el("td", {}, ["100%"]),
    ]),
  );
}

function dl(pairs) {
  return el("dl", { class: "kv" }, pairs.flatMap(([k, v]) => [el("dt", {}, [k]), el("dd", {}, [v])]));
}

/** @param {import("../core/checker.js").CheckResult} r */
function renderCounted(r) {
  const g = RULES.gorgias;
  const c = RULES.categories;
  const body = $("counted-body");
  const skipped = Object.entries(r.rows.skipped).filter(([, n]) => n > 0);
  const tagList = (tags) => tags.map((t) => `${t}: ${g.ai.notes?.[t] ?? ""}`);

  const cats = el("ul", { class: "rules" });
  for (const id of c.priority) {
    if (id === "other") continue;
    const en = c.keywords.en?.[id] ?? [];
    const others = Object.entries(c.keywords).filter(([lang]) => lang !== "en").map(([lang, k]) => `${lang}: ${(k[id] ?? []).join(", ")}`);
    cats.append(
      el("li", {}, [
        el("strong", {}, [c.labels[id]]),
        el("p", { class: "small" }, [`Tags: ${(c.tags[id] ?? []).join(", ")}`]),
        el("p", { class: "small" }, [`Keywords (English): ${en.join(", ")}`]),
        el("p", { class: "small muted" }, [`Basic lists: ${others.join(" · ")}`]),
      ]),
    );
  }

  body.replaceChildren(
    el("h4", {}, ["Your file"]),
    dl([
      ["Rows read", fmt(r.rows.read)],
      ["Tickets counted", fmt(r.rows.counted)],
      ["Rows skipped", skipped.length ? skipped.map(([k, n]) => `${fmt(n)} ${SKIP_REASONS[k] ?? k}`).join("; ") : "none"],
      ["Columns used", Object.entries(r.headers.used).map(([k, h]) => `${h} (${k})`).join(", ")],
      ["Optional columns not in your file", r.headers.missingOptional.join(", ") || "none"],
    ]),
    el("h4", {}, ["AI-handled tickets"]),
    el("p", { class: "small" }, ["A ticket counts as AI-handled when it has one of the AI Agent tags below, or a value in the “AI Agent Outcome” ticket field. A ticket with both ai_close and ai_handover counts as handed back, because a human got it."]),
    el("ul", { class: "small" }, [...tagList([...g.ai.closeTags, ...g.ai.handoverTags, ...g.ai.otherTags, ...g.ai.ignoreTags])].map((t) => el("li", {}, [t]))),
    dl([
      ["Both ai_close and ai_handover", fmt(r.ai.bothCloseAndHandover)],
      ["ai_close but open again now", fmt(r.ai.closeTagButOpen)],
      ["Counted from the AI Agent Outcome field only", fmt(r.ai.fieldOnly)],
      ["Tickets without AI involvement", fmt(r.humanOnly)],
    ]),
    el("h4", {}, ["Categories"]),
    el("p", { class: "small" }, ["Matched on the subject, the tags and the contact reason, lowercase and whole words. A ticket gets the first match in this order. “Where is my order” is its own bucket and is not counted as an exception."]),
    cats,
    el("p", { class: "small" }, [
      `Rules version ${g.version === c.version ? g.version : `${g.version} (tickets) / ${c.version} (categories)`}. Edit them in `,
      el("a", { href: `${REPO}/blob/main/rules/gorgias.json` }, ["rules/gorgias.json"]),
      " and ",
      el("a", { href: `${REPO}/blob/main/rules/categories.json` }, ["rules/categories.json"]),
      ".",
    ]),
  );
}

function init() {
  const input = /** @type {HTMLInputElement} */ ($("file"));
  const drop = $("drop");
  input.addEventListener("change", () => input.files?.[0] && start(input.files[0]));
  for (const ev of ["dragenter", "dragover"]) {
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("over");
    });
  }
  for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) start(file);
  });
  // A file dropped outside the zone would open in the tab: don't.
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  $("copy").addEventListener("click", async () => {
    if (!last) return;
    try {
      await navigator.clipboard.writeText(summaryText(last));
      $("copy-status").textContent = "Summary copied.";
    } catch {
      $("copy-status").textContent = "Couldn't copy. Use Print / save as PDF instead.";
    }
  });
  $("print").addEventListener("click", () => window.print());
  $("again").addEventListener("click", () => {
    reset();
    input.value = "";
    $("check").scrollIntoView();
    input.focus();
  });
  $("error").setAttribute("tabindex", "-1");
  createWorker();
}

init();
