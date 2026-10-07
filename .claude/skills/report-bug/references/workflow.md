# report-bug Workflow

The procedural workflow Claude follows when the `report-bug` skill is invoked.

## Inputs

- **`--grep <substring>`** (optional) — narrow to one failure when the run had several. Matched against the test title.

## Steps

### 1. Collect the facts

```bash
node .claude/skills/report-bug/scripts/collect-failure.mjs [--grep "<substring>"]
```

| Exit | Meaning |
| ---- | ------- |
| 0 | JSON on stdout — one entry per failure, per platform |
| 3 | The last run recorded no failures, or none matched `--grep`. Say so and stop |
| 4 | Nothing was run: there is no `test-results/failures/`. Tell the user to run the suite, and stop |

Do **not** hunt for these facts by hand if the script fails — fix the run, then re-run the script. Reconstructing them by reading files is how a report ends up describing a different failure than the one that happened.

**`evidence` is a folder the run already wrote**, one per failed test, holding `screenshot.png`, `page-source.xml` and `failure.json`. Name that folder in the draft — there is nothing to copy or collect first.

**Read `otherPlatforms` before drafting anything.** The same test can fail on one platform and pass on the other, and that single fact changes what the report is: a defect in one build, not in the product. This repository has a filed example — `alice@example.com` is locked out on Android and signs in on iOS (OR-7). A report that does not say which platforms were tried is asking the reader to assume.

### 2. Decide what kind of failure this is

**This is the judgment the skill exists to support, and it is not yours to settle.** The rule is wider than this skill and does not depend on it being invoked: ADR-0030 makes it any finding, and `docs/triage.md` in the origin repository carries the full workflow, including what happens after the report. Read the acceptance criterion against the actual behaviour and present *both* readings:

- **The application is wrong** — the test faithfully encodes the AC, and the app does not do it. A defect.
- **The ticket is wrong** — the app behaves as designed, and the AC describes something it never did. A refinement.
- **The automation is wrong** — the app and the AC are both fine, and the test encodes an assumption the app never promised to keep. A fix to this repository, and it gets its own ticket like any other work.

Nothing in the run distinguishes them for you. What the app currently shows is checkable — read `page-source.xml`, which is the element tree at the moment the assertion gave up, and look at `screenshot.png` beside it — and that **narrows** the question without closing it: a tree that no longer matches the test says the assumption is stale, not who should have changed. The screenshot earns its place twice here, because the platforms disagree about what "visible" means: iOS reports elements the application plainly draws as `visible="false"`, so a tree that looks empty is not proof the screen was.

They are indistinguishable from the failure alone. A report that asserts "the application has a bug" when the truth was a badly written AC — or a locator of ours that was always too loose — sends someone chasing a ghost, and the credibility of every later report goes with it.

Where the repository documents the behaviour (`docs/app/`), cite it — but **citing it does not
settle the question**. Documentation records two different things that look identical on the
page, and they point in opposite directions:

- **A specification** — "the system shall do X". The app not doing X is a defect.
- **A defect log** — "X is broken for this user". That records that a bug *exists*; it is not
  evidence the bug is *correct*.

`docs/app/users.md` calling something a "Broken sort dropdown" is the second kind. Quoting it
proves the behaviour is known, not that the ticket was wrong to expect otherwise.

State which kind you found, quote it, and **still present both readings**. The only thing that
genuinely settles it is a person who knows whether the behaviour is intended.

### 3. Render the draft

Follow [`report-template.md`](report-template.md) exactly. Every section, in order.

**Check the failure's `when` against the spec you are reading.** `test-results/failures/` outlives
the spec that produced it, so a report can describe a test that has since been renamed or deleted —
it happened on the web repository mid-session. When the title no longer exists in `tests/`, ask for
a fresh run rather than filing a report about a test that is gone.

**If the script returned `missing` instead of `acceptanceCriterion`**, render its reason in
**Expected** before falling back to the assertion — the table in `report-template.md` gives the
wording. `no-matching-record` is the *expected* state after a run blocked by ADR-0020, which
writes no records artifact: do not treat it as an error, and do not go hunting for the file.

Repro steps come from the script's `steps` — the titles the Page Objects' `step(...)` calls recorded
as the test ran, so they are prose, not code. Use them verbatim; do not paraphrase them into
something prettier that no longer matches what ran. When the field is `missing`, say so in the draft
instead of reconstructing the path from the test's source: a step nobody executed is how a report
sends a reader down a route that does not exist.

### 4. Hand it over

Print the draft. **File nothing.**

If the user concludes the application is at fault and files the defect, the blocked test's
destination is `itFails('<KEY>', …)` referencing it (ADR-0024) — never applied by you, and never
offered. When the behaviour is right on one platform and wrong on the other, the destination is
`itOn` for the platform that has it, with the defect key in the reason. Say where the draft goes; do not act on it. Say plainly that it is a draft for the user to review, and that the tracker write is deliberately not implemented (see the skill's Scope section).

Then report **Obstacles encountered** — ALWAYS, even when there are none (one line: `Obstacles encountered: none.`). Per ADR-0022 it carries three things:

1. **Evidence gaps** — a field the script could not fill: no acceptance criterion matched the test title, no step record, a screenshot or tree the capture could not take (its reason is in the failure's `notes`). Name what is missing, because a reader will otherwise assume it was checked and found empty. **There is never a network log** — Appium cannot see the app's traffic — so a network-shaped failure is reported from what the screen showed, and the report says that is all there was.
2. **Tooling friction** — a command that failed and was retried or worked around.
3. **Reference gaps** — where this skill's own `references/` did not cover the case and you improvised. **Name the file that should have covered it.**

Do not restate the two readings from Step 2 here; they belong in the draft itself.
