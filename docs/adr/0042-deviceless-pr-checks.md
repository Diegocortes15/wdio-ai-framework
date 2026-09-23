# 0042 — CI runs deviceless checks on every pull request, and never the suite

**Date:** 2026-09-23
**Status:** Proposed
**Confidence:** High — the failure it prevents already happened once, and the job is a few minutes.
**Review by:** — when a device cloud makes running the suite in CI possible; that is a separate decision.
**Enforced by:** `.github/workflows/pr-checks.yml`. Its absence is visible: a PR with no checks.

## Context

`docs/PORT-BRIEF.md` §12 recorded "CI: none for now" — the suite needs an emulator, the local system
image is arm64 while hosted runners are x86, and BrowserStack is the intended direction. That reasoning
still holds for **running tests**, and it was taken to mean no CI at all.

Then a lockfile written by npm 11 reached `main` through a reviewed pull request and broke the first
Qase sync at `npm ci`, because the runner ships npm 10. Nothing between the local run and the merge
looked at it: validation happens on one machine, with one npm.

## Decision

A pull-request job runs the checks that need no device: `npm ci`, `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm run test:unit`. The suite still does not run in CI — specs are verified
locally before the PR is opened, as `CLAUDE.md` says.

## Consequences

- The class of failure that caused this (something that only reproduces on a different machine or
  toolchain version) is caught before merge instead of after.
- It contradicts the brief's earlier "no CI", which is corrected in place with a note — the brief is the
  present layer, this record is the log.
- A green PR still says nothing about whether the tests pass. That remains a local claim, and the PR
  body is where it is stated.
- Two workflows now exist and both are deviceless, so "CI" in this repository never means the suite.

## Alternatives considered

- **Nothing, and remember to regenerate the lockfile with npm 10.** Rejected: it is a rule with no gate,
  which is the failure `Enforced by:` exists to prevent.
- **Pin the runner's npm to the local one.** Rejected: it makes CI agree with one machine instead of
  making the lockfile portable, and the next contributor's npm would disagree again.
- **Run the suite in CI on an x86 emulator.** Rejected here: that is the deferred BrowserStack decision,
  not a PR check.
