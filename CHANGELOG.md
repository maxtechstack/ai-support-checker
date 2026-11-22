# Changelog

## v1.1 (2026-11-22)

Rules from real AI Agent traffic: a Gorgias trial with a Shopify development store, 5 tickets, Nov 22, 2026.
Rules version `2026-11-22.1`.

- **Tags checked:** `ai_answered` is added on every AI reply and is never an outcome by itself; `ai_processing` is
  removed at the outcome; `ai_close` is removed when a ticket reopens. Tags cell confirmed: commas, no spaces, quoted.
- **Action tags:** `ai_executed_action` (seen on an order cancel that went through in Shopify) and `ai_failed_action`
  (from the Gorgias docs). The headline and a new "AI action recorded" column show them for tickets the AI closed
  alone.
- **AI Intent:** the "AI Intent" ticket field decides the category when its first two levels are in
  `rules/categories.json` `intents`; tags and keywords are the fallback.
- **Resolution field:** counted on AI-closed exceptions and shown as one line of context under the table.
- **AI Agent Outcome field:** exact prefixes (`Close::`, `Handover::`, `Snooze::`) instead of guessed words.
- **Snooze:** `ai_snooze` stays "still open" even though Gorgias exports snoozed tickets with a Closed date.
- **Samples:** the synthetic export has the Nov 22 header row, AI Intent, Resolution, `ai_answered` and action tags.
  Same seed; existing counts didn't move. New fixture `samples/edge/gorgias-ai-real-tags.csv` (anonymized).
- Result JSON is `resultVersion` 2 (new fields: `exceptionActions`, `exceptionResolution`, `ai.actionDone`, …).

## v1 (2026-11-18)

First public release: in-browser Gorgias export checker, CLI, synthetic samples.
