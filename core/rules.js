// Compiles the JSON rules (rules/gorgias.json, rules/categories.json) into matchers.
// Pure ES module: no DOM, no Node APIs.

/**
 * @typedef {{ names: string[], required: boolean, note?: string }} HeaderSpec
 * @typedef {{ version: string, headers: Record<string, HeaderSpec>, tagSeparator: string,
 *   ai: { closeTags: string[], handoverTags: string[], otherTags: string[], ignoreTags: string[],
 *         outcomeField: { closeWords: string[], handoverWords: string[] } } }} GorgiasRules
 * @typedef {{ version: string, priority: string[], needsBackendAction: string[], labels: Record<string, string>,
 *   tags: Record<string, string[]>, keywords: Record<string, Record<string, string[] | boolean>> }} CategoryRules
 * @typedef {{ gorgias: GorgiasRules, categories: CategoryRules,
 *   tagCategory: Map<string, string>, matchers: { category: string, re: RegExp }[],
 *   closeTags: Set<string>, handoverTags: Set<string>, otherTags: Set<string>, ignoreTags: Set<string> }} CompiledRules
 */

const LETTER = "[\\p{L}\\p{N}]";

/** Lowercase, NFC, curly apostrophes to straight. */
export function normalizeText(s) {
  return String(s ?? "").normalize("NFC").toLowerCase().replace(/[‘’ʼ]/g, "'");
}

/** A tag as the rules list it: lowercase, runs of spaces and hyphens become one underscore. */
export function normalizeTag(tag) {
  return normalizeText(tag).trim().replace(/[\s-]+/g, "_");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "refund*" → refund\p{L}*, phrases keep their spaces; whole-word boundaries on both sides. */
export function keywordPattern(keyword) {
  const kw = normalizeText(keyword).trim();
  const wildcard = kw.endsWith("*");
  const body = escapeRe(wildcard ? kw.slice(0, -1) : kw).replace(/ +/g, "\\s+");
  return `(?<!${LETTER})${body}${wildcard ? `${LETTER}*` : ""}(?!${LETTER})`;
}

/**
 * @param {GorgiasRules} gorgias
 * @param {CategoryRules} categories
 * @returns {CompiledRules}
 */
export function compileRules(gorgias, categories) {
  const tagCategory = new Map();
  for (const category of categories.priority) {
    for (const tag of categories.tags[category] || []) {
      if (!tagCategory.has(normalizeTag(tag))) tagCategory.set(normalizeTag(tag), category);
    }
  }
  const matchers = [];
  for (const category of categories.priority) {
    const words = [];
    for (const lang of Object.values(categories.keywords)) {
      const list = lang[category];
      if (Array.isArray(list)) words.push(...list);
    }
    if (words.length) {
      matchers.push({ category, re: new RegExp(words.map(keywordPattern).join("|"), "u") });
    }
  }
  const set = (list) => new Set(list.map(normalizeTag));
  return {
    gorgias,
    categories,
    tagCategory,
    matchers,
    closeTags: set(gorgias.ai.closeTags),
    handoverTags: set(gorgias.ai.handoverTags),
    otherTags: set(gorgias.ai.otherTags),
    ignoreTags: set(gorgias.ai.ignoreTags),
  };
}
