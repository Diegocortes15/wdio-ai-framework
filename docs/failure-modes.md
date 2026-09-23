# Failure modes

Where this port broke, what catches it now, and what still does not.

**The rule for this page:** every claim is verified against the code or a run, or it says it is
unmeasured. Nothing here is an estimate dressed as a fact. Where a failure mode has no mitigation, it
is listed anyway — a page that only lists solved problems is marketing.

It exists because the sibling web repository's equivalent page is the most useful document in it, and
because six of the seven failures recorded there were records drifting from reality rather than code
defects. The same pattern already repeated here.

---

## What has actually broken here

Each of these happened during the port, was found, and has something that catches the next one.

| What broke                                                                                                                                                                                                                                                         | How it surfaced                                                                            | What catches it now                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A gate that swallowed its own failure.** The app reset ran in WDIO's `beforeTest`, whose errors are logged and discarded. A reset that timed out let the test run on the previous test's state — and the suite reported green                                    | Noticed while reading a run's log, not from a failure                                      | The reset is a Mocha root hook (ADR-0040): a failed reset fails the test. Verified against two real failures, whose message names the foreground package          |
| **A rule nobody would reach.** The requirement to run an expected-failure test as a plain `it` first lived in `fix-loop.md`, which `SKILL.md` said to read **only** after a failure — while `itFails` is written before any failure. The first real run skipped it | The PR body disclosed it                                                                   | The rule now sits at Step 7 and in the test template's `itFails` rule, where the marker is written. `SKILL.md` no longer says the file is for red runs only       |
| **Configuration that did not travel.** Prettier's config lived outside the skill directories in the web repo, so 28 files here failed `format:check` from Phase 1 onwards                                                                                          | A format check run by hand                                                                 | `.prettierrc.json` + `.prettierignore` (which excludes `.claude/`, so Prettier cannot spend the skills' line budget), and `format:check` in the PR checks         |
| **A lockfile only one npm version accepted.** Written by npm 11 locally; GitHub's Node 22 runner ships npm 10.9.8, which requires an optional peer npm 11 omits. The first Qase sync failed at `npm ci`                                                            | The CI job failed at merge — after review, with nothing before it to check                 | `.github/workflows/pr-checks.yml` runs `npm ci` on every PR. Reproduced both ways before fixing: npm 11 accepts the old lock, npm 10 rejects it                   |
| **Mutable metadata inside an identity.** A Qase case's identity was its test title, and `@smoke` lives at the end of a title here. Tagging or untagging a test would have deleted its case and created another, losing its history                                 | Caught by reading the map after the first sync, with 7 cases in it                         | The mapper strips trailing tags from the case title and sends them as Qase tags; a unit test asserts that a tagged test **updates** its case                      |
| **A connection check that was not a call.** `/from-issue` was told to "confirm the Atlassian MCP is connected". A tool search answered "still connecting" indefinitely, and a run stalled at Step 1 instead of aborting                                            | A real run reported it as a reference gap                                                  | Step 1 calls `getAccessibleAtlassianResources`, retries once, then aborts with the reconnect instructions                                                         |
| **Two Appium servers that coexisted by luck.** The exploration server bound `0.0.0.0:4723` and the test run's bound `127.0.0.1:4723`; macOS allowed both and the more specific listener won                                                                        | Measured while wiring `@wdio/mcp` — the suite passed, which is what made it worth checking | `npm run appium:explore` binds `127.0.0.1:4725`, and `.mcp.json` points the MCP at that port. Measured: running the suite still kills an open exploration session |
| **A tree read mid-transition.** `get_elements` right after a tap returned two root containers, which reads exactly like "the element does not exist"                                                                                                               | A real run reported it; a screenshot proved the screen was correct                         | `wdio-conventions.md` requires polling `get_elements` until an element of the destination screen appears, and a screenshot before concluding anything             |
| **A claim taken from a README instead of the installed code.** This repository's own skill said `get_elements` filters to the viewport by default, quoting the tool's README; the installed 3.13.0 schema says the opposite                                        | Found while writing the rule, before it misled anyone                                      | The rule now says to pass both flags explicitly and not to trust the default. **Nothing enforces this** — the honest answer is "read the installed schema"        |

The pattern worth naming, and it is the web repo's pattern again: **most of these were a rule, a
config or a record that did not match reality, not code that computed the wrong answer.**

---

## What the port has measured about the environment

- **The emulator degrades.** After 2 h 42 min of use its load average was 10–12 (and `/proc/loadavg`
  counted 1702 scheduling entities), and the app reset failed in 2 of 3 runs. After a cold restart:
  load 1.8, 984 entities, 3 of 3 green. A
  reset failure is therefore a reason to check the emulator before suspecting the app or the test.
- **`boot_completed` is not idle.** Right after boot the load still spikes to 11–34 for a while. The
  preflight in `scripts/start-emulator.sh` disables the Google apps that ANR, but it does not wait for
  the system to settle. **Unmitigated**, and the reason a first run after boot can be slow.
- **Timings, measured 2026-09-21 on API 35:** app reset (terminate + activate + catalog visible) 2.6 s
  median (n=8); UI sign-in 5.1 s median (n=8); a sign-in reaches the catalog 1.2–1.35 s after the tap
  (n=4). These are what the absence window in the login spec is derived from.

---

## What has no mitigation

- **A plausible-but-wrong test passes every gate.** Inherited unchanged from the web repo. A real
  instance is already in the suite: the test for OR-1's AC 1 asserts three elements are displayed, and
  `LoginPage.open()` already waits for one of them. Nothing but a reviewer catches that.
- **The suite never runs in CI.** No device. PR checks cover install, types, lint, format and the unit
  tests of the Qase sync; whether the tests pass is established on one developer's machine.
- **A dry run is not an independent rerun.** The two `/from-issue` rehearsals of OR-1 produced identical
  code, but the same agent ran both with the first in context. The real independence check is the next
  ticket in a fresh session.
- **Qase steps are a snapshot of one local run.** They are copied into the records when `/from-issue`
  runs the suite; renaming a Page Object's step titles later does not reach Qase until the records are
  regenerated (ADR-0041).
- **A dead Jira link stays dead.** A case's description links its ticket; if the ticket is deleted,
  nothing notices.
- **The application does not change.** Both SUTs are frozen, so every claim about selector durability
  here — including the measured ones — proves uniqueness today, not durability.
- **One author.** Whether these conventions survive a second person is untested. The first evidence
  will be the OR-2 run in a fresh session.

---

## The thesis, measured so far

The port exists to answer one question: how much of the AI layer had to change. Measured against the
Phase 1 baseline (3338 skill lines, 0 changed) at commit `eb524f3`:

| Group                                                                                                                               | Lines changed             |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Whole skills untouched:** `/report-bug`, `/scaffold-page-object`                                                                  | **0** (not yet needed)    |
| **Judgment, untouched:** `bucket-classification.md`, `data-placement.md`, `refine-ticket`'s `workflow.md` + `writeback-template.md` | **0**                     |
| **Judgment, adjusted:** `smoke-policy.md` (1), `qa-analysis.md` (3), `rubric.md` (8), `sources.md` (3)                              | **15 added**              |
| **Mechanics:** conventions, test template, workflow, harness, TCMS, PR template, `SKILL.md`                                         | the rest                  |
| **Total**                                                                                                                           | **+487 / −839, 14 files** |

The split is the finding: what changed is the mechanics — how a test is written, which commands run,
how a locator is verified. What barely moved is the QA judgment — which tests to write, which are
smoke, which bucket they belong to, when a finding goes to a person instead of into a test.

Caveat on the total: `playwright-conventions.md` (509 lines) was rewritten as `wdio-conventions.md`
(218 lines), and git does not detect that as a rename, so it counts as a delete plus an add. Both
`/report-bug` and `/scaffold-page-object` are still Playwright-shaped; their cost is unpaid, not zero.
