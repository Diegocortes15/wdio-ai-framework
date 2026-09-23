# 0043 — The sync reconciles against Qase itself, with no local id store (supersedes ADR-0041's `qase-map.json`)

**Date:** 2026-09-23
**Status:** Proposed
**Confidence:** High for the mechanism — it is unit-tested, including the removal path under mutation.
Medium for the API shape: `listCases` pages `GET /case/{code}` and filters on each entity's `suite_id`
client-side, and that has not yet run against the live project.
**Review by:** —
**Enforced by:** `src/tcms/suite-sync.test.ts` — removal inside covered suites, no removal in suites no
record mentions, none at all with no records, and a hand-renamed case reconciled away. The workflow
declares `permissions: contents: read`, so the job cannot write to the repository even by accident.

## Context

ADR-0041 had the sync keep a committed `qase-map.json` (logical test key → case id) and a CI step that
committed the refreshed map back to `main`. Then `main` got a ruleset requiring pull requests, and the
bot's push was rejected: `GH013 … Changes must be made through a pull request`. Qase itself synced
fine both times; only the map went stale, and the job went **red after every merge**, which is the
worst outcome — a red check that means nothing trains people to ignore red.

The obvious fix, a bypass for the `github-actions` app, is **not available on a user-owned
repository**: the API refuses it ("Actor GitHub Actions integration must be part of the ruleset source
or owner organization"), and a bypass by repository role does not apply to `GITHUB_TOKEN` — measured,
the push was rejected again. That leaves a personal access token in secrets (a long-lived credential
that opens a bigger hole than the one being closed) or removing the need to write to the repository.

## Decision

The sync keeps no local state. For every suite the records cover, it asks Qase what that suite holds
(`listCases`) and reconciles: records are created or updated by title, and any case in those suites
that no record describes is removed. `qase-map.json` is deleted and the commit-back step is gone.

## Consequences

- `main` needs no bypass and the workflow needs no write permission. The job is green again, so red
  means something.
- **A case edited by hand in Qase is reconciled away.** Renaming one there makes the old title an
  orphan: the next sync removes it and recreates the case from the records. Previously the map would
  have quietly corrected the title instead. Both outcomes end with the records winning; this one loses
  the case's history, which is the same cost a rename has always had here.
- The `test ↔ case` index is no longer readable from the repository. Qase itself is the index.
- Cost per sync: one paged listing per covered suite instead of one skipped search per case. At this
  scale that is noise; at thousands of cases the listing would want the server-side `suite_id` filter.
- A suite no record mentions is never listed and never touched, so cases from another feature — or
  written by hand outside this pipeline — survive. That is deliberate: this sync has no opinion about
  tests it was not given.

## Alternatives considered

- **Bypass for the Actions app.** Not possible on a personal repository; measured, not assumed.
- **A PAT in secrets so the push comes from an admin.** Rejected: it keeps the map at the price of a
  long-lived token any workflow could use to push to `main` — a wider hole than the rule closed.
- **Weaken the ruleset (drop the PR requirement and the required check).** Rejected: those two are the
  reason the ruleset exists, and the required check is what caught a lockfile that only failed on CI.
- **Have the bot open a pull request with the refreshed map.** Rejected for now: a PR per merge, plus
  auto-merge, to carry a generated index that the backend already holds.
