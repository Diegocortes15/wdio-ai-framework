# TCMS records artifact + at-merge Qase sync

The framework mirrors tests into Qase **one-way, at merge** (see ADR-0017), behind the `src/tcms/` seam. `/from-issue` does **not** push to Qase; it writes a committed **records artifact**, and a merge-time CI step (`npm run tcms:sync`) does the authoritative create/update/archive. A rejected PR therefore never mutates Qase.

## Step 11.5 — write/append `.tcms/records/<feature>.json`

Records files are keyed by **feature** (e.g. `inventory.json`), mirroring the spec
files — **not** by ticket. When the ticket augments an existing feature, **append**
the new records to that feature's file (create it only if absent); never start a
per-ticket file. There is **no file-level `meta`** — each record carries its own
`jira` array, because one feature file legitimately holds tests from several tickets
(SW-3 + SW-4 + SW-5 all live in `inventory.json`), and a single test may even trace
to more than one ticket over time.

One object per generated test, from the Step 6 model:

```json
{
  "records": [
    {
      "title": "<prose test title, with any embedded @tag tokens stripped>",
      "acText": "<the AC text this test covers — the human-readable expected outcome>",
      "user": "standard_user | … | no-auth",
      "tags": ["@no-auth", "@smoke"],
      "bucket": "Positive | Negative | Edge",
      "feature": "<feature slug, e.g. login>",
      "contextLabel": "<context label, e.g. 'no auth' / 'problem_user'>",
      "jira": [{ "key": "<THIS ticket, e.g. SW-1>", "url": "https://…/browse/SW-1" }]
    }
  ]
}
```

Set `jira` to the ticket(s) **this** test traces to (usually just the one you're
working). Write/append with the Write tool and `git add` it alongside the spec.
Skip under `dry-run` **and under `--from-file`** (see below). The sync rejects any record missing a non-empty `jira` array, and with those two skips in place such a record is never written in the first place.

## `expectedFailure` — for a test that lands as `test.fail()`

A record gains one optional field when its test is marked `test.fail()` because the
**application**, not the test, is wrong (ADR-0024):

```json
"expectedFailure": {
  "key": "SW-14",
  "url": "https://…/browse/SW-14",
  "reason": "one plain sentence: what the application does that it should not"
}
```

**A `/from-issue` run never writes it.** A run blocked by an app-versus-AC contradiction writes
no records at all (ADR-0020), and it is not the agent's call whether a test lands annotated
(ADR-0024). The field is added by hand at the moment a person approves the landing, alongside
the `test.fail()` marker itself.

**The spec file must also force artifact capture.** Add this at the top of the file, next to the
imports:

```ts
test.use({ screenshot: 'on', video: 'on' });
```

Playwright does not treat an expected failure as a failure, so the project's
`screenshot: 'only-on-failure'` and `video: 'retain-on-failure'` capture **nothing** for exactly
the tests whose evidence matters most. The trace still records, but reading one needs
`npx playwright show-trace` and a checkout — which puts an engineer between a BA, a product owner
or a support agent and the bug they are being asked to judge. A defect-locked test that produces
no screenshot and no video is a defect report nobody outside the repository can see.

It has to be **file-level**: `video` cannot be scoped to a `describe`, because it forces a new
worker. Measured cost on `inventory.spec.ts`: **+12% run time and +12 MB of artifacts** for that
file. Do not turn it on globally to avoid the thought — every passing test would pay it.

It does two jobs. The Playwright report reads it through `src/utils/report-annotations.ts` and
explains the expected failure in words — otherwise the test shows a bare "expected" status that
tells a reader nothing about why. And it is the machine-readable half of ADR-0024's rule that
the annotation must name the defect: a `test.fail()` test whose record has no `expectedFailure`
is flagged in the report as an **unattributed expected failure**, which is the thing ADR-0024
warns is "indistinguishable from a test somebody gave up on". Detection, not prevention — it
never fails a run.

## What the merge-time sync does (`src/tcms/suite-sync.ts`, run by CI)

- Reads **all** `.tcms/records/*.json` + the full `test-results/results.json`.
- One Qase case per logical test under **`feature › context › bucket`**, marked **automated**; steps from `test.step` names; **expected = the record's `acText`**; deduped across projects (passed only if every project passed).
- Find-or-create (never references an unknown id), one run per sync, writes `qase-map.json` (test → case id), and **archives** cases whose records vanished.

Mapping lives in `src/tcms/case-mapper.ts` + `suite-sync.ts` — do not re-derive.

## Runs sourced from a local file

**They write no records at all** (ADR-0026). A file-sourced run skips Step 11.5 along with the
branch, commit and PR: there is no ticket, so there is no requirement for a catalogue case to
trace to. An earlier version of this file told you to write `"jira": []` instead — that produced
exactly the artifact the sync is coded to reject (`suite-sync.ts` throws on an empty `jira`
array), so a file-sourced PR could not be merged without failing the build on `main`.
