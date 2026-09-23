# 0041 — The Qase catalogue syncs from the committed records alone, without a run (scopes ADR-0017)

**Date:** 2026-09-21
**Status:** Superseded by ADR-0043 (the `qase-map.json` half only; syncing from records without a run stands)
**Confidence:** Medium — the sync logic is unit-tested against a fake seam; the Qase API path is the
web repository's, unchanged, but it has not yet run against this repository's project.
**Review by:** — when a device cloud (BrowserStack) makes a CI run of the suite possible; run results
could then be mirrored as well.
**Enforced by:** `.github/workflows/tcms-sync.yml` (runs on changes to `.tcms/records/` on `main`);
`src/tcms/suite-sync.test.ts` (creation, update by known id, removal of orphans, duplicate and
invalid records); `loadRecords` rejects a record without `jira` or `steps`.

## Context

ADR-0017, inherited from the web repository, mirrors tests into Qase at merge from two inputs: the
records `/from-issue` commits, and the report of the suite's run in the same CI job. The run supplied
each case's steps (from `test.step`) and was required — a record with no run result was not synced.

This repository has no CI run of the suite. The emulator image is arm64 while hosted runners are x86,
and a device cloud is not wired yet. Diego created the Qase project (`ORSAUCE`) and wants the
catalogue mirrored anyway, reversing the "TCMS out of scope" decision in `docs/PORT-BRIEF.md` §12.

## Decision

The catalogue sync reads **only** the committed records and `qase-map.json`. Each record carries the
test's steps, which `/from-issue` copies from the local run it already makes (Step 10) — the step
titles recorded by `src/utils/step.ts`. A CI job on `main`, triggered by changes to `.tcms/records/`,
creates, updates and removes cases, then commits the refreshed map back.

Run results are not mirrored. There is no run in CI to take them from.

## Consequences

- Qase reflects merged code, and a rejected PR never touches it — the same property ADR-0017 had.
- The job needs no device and runs in seconds.
- Steps are those of the last local `/from-issue` run. A later change to a Page Object's step titles
  does not reach Qase until the record is regenerated. The web repository refreshed steps on every
  merge; this one does not.
- A case's identity is `feature › context › bucket › title`. Renaming a test or moving it to another
  bucket removes the old case, with its history, and creates a new one.
- A record without a run record to copy steps from gets a single generic step. The PR says so.
- The sync refuses to remove anything when there are no records at all, and fails on duplicate
  logical keys — two guards the web version did not need, because its run report bounded the input.
- A sync failure does not fail the job (Qase is downstream), but it is printed as a GitHub
  `::warning::`: here the sync is the whole job, and a silent failure would be a green check that lies.

## Alternatives considered

- **Sync locally after running the suite**, by hand or from a git hook. Rejected: Qase would reflect
  one machine rather than `main`, and depend on someone remembering.
- **Wait for BrowserStack and keep ADR-0017 as is.** Rejected for now: Qase would stay empty until a
  decision that has no date.
- **Derive steps statically from the Page Object methods a spec calls.** Rejected: it guesses at what
  ran, and a guessed step in a test case is worse than a generic one.
