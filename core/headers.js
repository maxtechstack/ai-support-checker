// Maps the export's header row to the fields the checker reads. Case-insensitive, trimmed.

/**
 * @typedef {{ ok: boolean, index: Record<string, number>, used: Record<string, string>,
 *   missingRequired: string[], missingOptional: string[], found: string[], columnCount: number }} HeaderMap
 */

function clean(name) {
  return String(name ?? "").replace(/^﻿/, "").trim();
}

/**
 * @param {string[]} headerRow
 * @param {import("./rules.js").GorgiasRules} gorgias
 * @returns {HeaderMap}
 */
export function mapHeaders(headerRow, gorgias) {
  const found = headerRow.map(clean);
  const lower = found.map((h) => h.toLowerCase());
  /** @type {HeaderMap} */
  const map = { ok: true, index: {}, used: {}, missingRequired: [], missingOptional: [], found, columnCount: found.length };
  for (const [key, spec] of Object.entries(gorgias.headers)) {
    let at = -1;
    for (const name of spec.names) {
      at = lower.indexOf(name.trim().toLowerCase());
      if (at >= 0) break;
    }
    if (at >= 0) {
      map.index[key] = at;
      map.used[key] = found[at];
    } else if (spec.required) {
      map.missingRequired.push(spec.names[0]);
    } else if (spec.names.length) {
      map.missingOptional.push(spec.names[0]);
    }
  }
  map.ok = map.missingRequired.length === 0;
  return map;
}

/** Every header name the rules know, for the "expected" list in the error. */
export function expectedHeaders(gorgias) {
  return Object.values(gorgias.headers).flatMap((s) => s.names.slice(0, 1));
}
