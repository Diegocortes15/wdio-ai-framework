---
name: refine-ticket
description: Iteratively harden a Jira automation ticket against a "bulletproof" rubric — grounded in existing automation, app docs, and user-supplied sources — then write the refined acceptance criteria back to the ticket on approval, so /from-issue has nothing left to guess.
allowed-tools: Read Glob Grep Bash mcp__atlassian__getAccessibleAtlassianResources mcp__atlassian__getJiraIssue mcp__atlassian__editJiraIssue mcp__atlassian__addCommentToJiraIssue mcp__atlassian__getConfluencePage mcp__atlassian__searchConfluenceUsingCql mcp__wdio-mcp__start_session mcp__wdio-mcp__close_session mcp__wdio-mcp__get_elements mcp__wdio-mcp__get_screenshot mcp__wdio-mcp__tap_element mcp__wdio-mcp__swipe mcp__wdio-mcp__get_app_state
---

# refine-ticket

Given a Jira issue key (e.g. `SW-123`), this skill reads the ticket via the Atlassian MCP, scores it against the refinement rubric, and loops — auto-resolving gaps from existing automation + docs and asking you (or a source you point it at) for the rest — until the ticket is unambiguous. On your approval it writes a `Refined Acceptance Criteria` section back to the ticket, using Jira's own rich formatting — a divider, an info panel marking the section machine-owned, and a `status` lozenge per acceptance criterion. It does NOT generate tests; run `/from-issue` after. See ADR-0013.

## How to use it

Tell Claude what you want:

> Use the refine-ticket skill on SW-123.

Or to preview without writing to Jira:

> Use the refine-ticket skill on SW-123 with dry-run.

During the loop, when asked about a gap you can either answer directly or point the skill at a source ("it's in Confluence page X", a URL, a doc path). The skill ingests it and continues. It stops when the ticket has no open gaps, then asks before writing anything back.

Refinement is **shift-left**: it works for a ticket whose feature is not built yet, and it never asks the app what new behaviour should be. The one exception is a ticket that points at something that **already exists** — "the same error as the login screen", "reuse the cart's empty state", "this component, on the new page". There the skill asks your permission, opens the referenced screen on a device, and records what it saw as an **observation** with its date, platform and build. An observation reaches the approval gate marked `observed` and becomes an acceptance criterion only if you say it is intended behaviour, because an app shows what was built, defects included. See ADR-0045, which scopes ADR-0013 for this.

## Workflow

The full procedural workflow is in [`references/workflow.md`](references/workflow.md). Read that file before executing the skill.

> **Setup note:** driving a device needs the exploration Appium server running (`appium:explore`) and the `wdio-mcp` server connected; without them the skill says the reference could not be verified and asks you instead. The Atlassian MCP must be connected (OAuth) with **write** scope for the Step 7 description update — defined at project scope in `.mcp.json`. Its read + write tools are pre-authorized in `allowed-tools` above so the loop doesn't prompt each call. Write-back happens only on your explicit approval (per ADR-0013).

## References

- [`references/workflow.md`](references/workflow.md) — the procedural loop
- [`references/rubric.md`](references/rubric.md) — the "bulletproof" checklist (definition of done)
- [`references/sources.md`](references/sources.md) — source catalog + user-supplied-source protocol
- [`references/writeback-template.md`](references/writeback-template.md) — the `Refined Acceptance Criteria` block as ADF nodes, the lozenge mapping, and the idempotent-update rule

## Composition

This skill pairs with `/from-issue`: refine first, then generate. It reuses the `/from-issue` skill's `references/bucket-classification.md` and `references/qa-analysis.md` for the rubric's coverage/automatable judgment.

## See also

- `docs/refine-ticket.md` — learning guide with a worked example
- ADR-0008 — why custom skills follow this layout
- [ADR index (origin repo)](https://github.com/Diegocortes15/playwright-ai-framework/tree/main/docs/adr) — rationale for every `ADR-NNNN` cited above. Paths like `docs/…` and `src/…` are relative to that repo, not to this skill.
