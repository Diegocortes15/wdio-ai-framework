---
name: report-bug
description: Turn a failed WebdriverIO + Appium run into a ready-to-file bug report draft — repro steps, expected vs actual, what the other platform did, and the evidence the run captured — for a human to review and file. Never files anything itself.
allowed-tools: Bash(node:*) Bash(ls:*) Bash(zip:*) Read Glob Grep
---

# report-bug

Given the last failed run, this skill assembles a bug report you can paste into a tracker: repro steps, the acceptance criterion the test traces to, expected versus actual, **what the same test did on the other platform**, and the evidence the run captured at the moment of failure — a screenshot and the element tree behind it.

**It files nothing.** You invoke it, you read the draft, you decide. That division is the point: the tedious part is transcription, and the part that needs judgment — is this a defect in the application, a ticket describing behaviour the application never had, or a test of ours encoding an assumption the application never promised to keep? — stays with a person.

## How to use it

Run the suite first, then:

> Use the report-bug skill.

Or for one failure when several failed:

> Use the report-bug skill for the test about sorting.

## Workflow

The full procedural workflow is in [`references/workflow.md`](references/workflow.md). Read that file before executing the skill.

## References

- [`references/workflow.md`](references/workflow.md) — the procedural workflow
- [`references/report-template.md`](references/report-template.md) — the draft's structure, and the two-readings rule

## Scripts

- [`scripts/collect-failure.mjs`](scripts/collect-failure.mjs) — gathers every failure of the last run, its evidence folder, the steps it ran, the acceptance criterion it traces to, and what the same test did on the other platform, into structured JSON. Plain Node, no dependencies. Locating facts is lookup, not judgment, so it is a script rather than prose.

**There is no evidence-collecting script**, and that is the port's doing rather than an omission. On the web the evidence landed in hashed directories under absolute paths, so a second script existed to gather it into one folder. Here the framework writes each failure's screenshot, element tree and error into a single folder as it happens, so there is nothing left to assemble. **There is no trace and no network log either** — Appium cannot see the application's traffic without a proxy, so the script that turned a trace into a HAR has no counterpart and was removed rather than faked.

## Scope

Filing into a tracker is deliberately **not** implemented. Jira writes are the exception, not the rule, in this project — only `/refine-ticket` writes, and only on explicit approval (ADR-0013). When a tracker write is added here it needs the same treatment and its own ADR.

## See also

- ADR-0020 — why a run that cannot go green opens no PR; this skill is what you reach for afterwards
- ADR-0021 — the runtime observations the web framework correlates into a report. **There is no mobile equivalent**: a device has no console and no network panel, the Appium server log covers a run rather than a test, and `logcat` has not been wired to anything. A report here says what the screen held and what the driver was asked for, and names that as the limit rather than implying more was checked
- [ADR index (origin repo)](https://github.com/Diegocortes15/playwright-ai-framework/tree/main/docs/adr) — rationale for every `ADR-NNNN` cited above. Paths like `docs/…` and `src/…` are relative to that repo, not to this skill.
