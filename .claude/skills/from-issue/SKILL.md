---
name: from-issue
description: Generate Playwright tests from a Jira ticket (read via the Atlassian MCP), composing /scaffold-page-object when a target Page Object doesn't yet exist, and open a GitHub PR with the generated tests for review.
allowed-tools: Bash(gh:*) Bash(git:*) Bash(npx:*) Bash(rm:*) Bash(mkdir:*) Bash(ls:*) Bash(.claude/skills/from-issue/scripts/typecheck-spec.sh:*) Read Glob Grep Write mcp__atlassian__getAccessibleAtlassianResources mcp__atlassian__getJiraIssue
---

# from-issue

Given a Jira issue key (e.g. `SW-123`), this skill reads the ticket via the Atlassian MCP, normalizes its requirement in whatever form it was written (narrative, Given/When/Then, bullet ACs, prose, or mixed), generates a set of Playwright tests, runs them locally, and opens a GitHub PR with a structured description. The PR is the review gate, and the GitHub-for-Jira app auto-links it onto the ticket. See ADR-0011.

**A run never opens a red PR** (ADR-0020). If the typecheck or a test fails, the skill diagnoses and retries up to 3 times; if it still fails — or if the failure means the **app** contradicts an AC rather than the generated code being wrong — it reports what it found and opens nothing.

## How to use it

Tell Claude what you want:

> Use the from-issue skill on SW-123.

Or for experimentation (skip push/PR):

> Use the from-issue skill on SW-123 with dry-run.

Or read the ticket from a local file instead of Jira — same pipeline, no Atlassian connection needed:

> Use the from-issue skill with --from-file tickets/SW-901-inventory-cart-badge.md

Jira stays the real ticket source (ADR-0011); a file is for exercising the pipeline and for testing changes to this skill without burning a real ticket. It is a **rehearsal, not a delivery path**: the run generates, typechecks and executes the tests, then stops — no branch, no commit, no PR and no TCMS records (ADR-0026). A file-sourced run never claims a Jira URL it did not read. See `references/workflow.md` Step 2 and `tickets/README.md`.

If the ticket's feature already has a generated spec, the skill **augments** that file (adds the new tests, and adds/modifies the Page Object as needed) instead of creating a new file — see ADR-0010. Re-running any ticket that already contributed to the file refuses. To force a separate file instead of augmenting:

> Use the from-issue skill on SW-123 with --new-file.

## Workflow

The full procedural workflow is in [`references/workflow.md`](references/workflow.md). Read that file before executing the skill.

> **Setup note:** the Atlassian MCP must be connected (OAuth) for the Step 2 ticket read — defined at project scope in `.mcp.json`. Its read tools (`mcp__atlassian__getAccessibleAtlassianResources`, `mcp__atlassian__getJiraIssue`) are pre-authorized in `allowed-tools` above so reads don't prompt each run. If a future Atlassian MCP build renames those tools, update the `allowed-tools` line to match.

## References

Each names the step that needs it, so a run loads what it uses rather than everything.

- [`references/workflow.md`](references/workflow.md) — the procedural workflow. **Read first, always.**
- [`references/bucket-classification.md`](references/bucket-classification.md) — Positive/Negative/Edge definitions + worked examples. **Step 6**, mandatory before classifying.
- [`references/smoke-policy.md`](references/smoke-policy.md) — `@smoke` selection criteria + worked examples. **Step 6**, mandatory before classifying.
- [`references/qa-analysis.md`](references/qa-analysis.md) — senior QA judgment: when to merge, split or skip ACs. **Step 4**, before producing test records.
- [`references/harness.md`](references/harness.md) — data-driven config and autonomous harness growth (ADR-0014). **Step 6.5**, before touching `AUTH_USERS`.
- [`references/data-placement.md`](references/data-placement.md) — inline vs. externalized (`data/`) test data. **Step 6**; most runs keep data inline and never need more than the decision rule.
- [`references/test-template.md`](references/test-template.md) — canonical test-file template. **Step 7**, when rendering.
- [`references/playwright-conventions.md`](references/playwright-conventions.md) — the Playwright practices generated tests must follow. **Step 7**, when rendering.
- [`references/test-principles.md`](references/test-principles.md) — F.I.R.S.T. principles and the anti-pattern gallery. **Step 7**; the gallery is the part that is specific to this repo.
- [`references/pr-description-template.md`](references/pr-description-template.md) — the PR body's structure and rules. **Step 12**, and skipped entirely on a `dry-run`.
- [`references/fix-loop.md`](references/fix-loop.md) — the no-red-PR gate: diagnosis, retry budget, forbidden fixes. **Step 10.5 only — read nothing of it when a run is green.**
- [`references/tcms-sync.md`](references/tcms-sync.md) — the records artifact's shape. **Step 11.5**, and skipped on a `dry-run` or a `--from-file` run.

## Scripts

- [`scripts/sync-base-branch.sh`](scripts/sync-base-branch.sh) — resolves the base branch, refuses a prior ticket's branch, and fast-forwards onto the remote. Used by workflow Step 1.5.
- [`scripts/typecheck-spec.sh`](scripts/typecheck-spec.sh) — typechecks the files a run generated against the project's own `tsconfig.json` (path aliases included), always cleaning up its throwaway config. Resolves `tsc` from `node_modules/.bin` only. Used by workflow Step 9.

## Composition

This skill invokes `/scaffold-page-object` (C.1) when a Page Object inferred from the AC text has no matching file in `src/pages/`.

## See also

- `docs/from-issue.md` — learning guide with worked examples
- ADR-0008 — why custom skills follow this layout
- [ADR index (origin repo)](https://github.com/Diegocortes15/playwright-ai-framework/tree/main/docs/adr) — rationale for every `ADR-NNNN` cited above. Paths like `docs/…` and `src/…` are relative to that repo, not to this skill.
