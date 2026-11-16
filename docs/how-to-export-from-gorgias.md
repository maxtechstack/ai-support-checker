# How to export your tickets from Gorgias

The checker reads a Gorgias **view export**: a CSV file that Gorgias emails you.

> Labels checked in a live Gorgias account on Nov 16, 2026. Background: the Gorgias help center
> ([Exports](https://docs.gorgias.com/en-US/exports-404844)).

1. In Gorgias, open **Inbox** and click **All** under **Default views**. To check only the AI Agent's tickets, use
   **Shared views › AI Agent › All** instead.
2. Tick the checkbox at the top of the ticket list so it says **All selected**. If Gorgias offers to select every
   ticket in the view (large views load in pages), take that too.
3. Click the **three dots** next to it, then **Export tickets**. Gorgias emails you a download link once the export
   is ready (about an hour per 100,000 tickets). The link works for 14 days.

Who can export: the account owner, admins and leads.

## Only want the AI Agent's tickets?

If the checker says it found no AI Agent tickets but your AI Agent is on, export **Shared views › AI Agent › All**
the same way.

## What's in the file

Ticket id, tags, channel, subject, dates, assignee, customer email and name, counts of messages, and one column per
ticket field. No message text. The checker reads only the ticket id, tags, subject, closed date and two ticket
fields ("AI Agent Outcome", "Contact reason"), and it reads them in your browser: the file is never uploaded.
