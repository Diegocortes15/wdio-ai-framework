# TCMS records artifact + at-merge Qase sync

The framework mirrors tests into Qase **one-way, at merge**, behind the `src/tcms/` seam. `/from-issue` does **not** push to Qase; it writes a committed **records artifact**, and a CI job that runs when records change on `main` (`npm run tcms:sync`) does the authoritative create/update/remove. A rejected PR therefore never mutates Qase.

**The sync reads the records and nothing else** (ADR-0041). It does not run the suite — there is no device in CI — so everything a Qase case shows has to be in the record: title, AC text, provenance, and the steps.

## Step 11.5 — write/append `.tcms/records/<feature>.json`

Records files are keyed by **feature** (e.g. `login.json`), mirroring the spec files — **not** by ticket. When the ticket augments an existing feature, **append** the new records to that feature's file (create it only if absent); never start a per-ticket file. There is **no file-level `meta`** — each record carries its own `jira` array, because one feature file legitimately holds tests from several tickets, and a single test may trace to more than one ticket over time.

One object per generated test, from the Step 6 model:

```json
{
  "records": [
    {
      "title": "<the test title exactly as written in the spec, @smoke included>",
      "acText": "<the AC text this test covers — the human-readable expected outcome>",
      "user": "<the account the test enters in the login form, or no-auth>",
      "tags": ["@smoke"],
      "bucket": "Positive | Negative | Edge",
      "feature": "<feature slug, e.g. login>",
      "contextLabel": "no auth",
      "jira": [{ "key": "<THIS ticket, e.g. OR-1>", "url": "https://…/browse/OR-1" }],
      "steps": ["Open the login screen from the menu", "Submit credentials for \"bod@example.com\""]
    }
  ]
}
```

- **`title`** is the spec's `it(...)` title as written, tags included — it is how a reader finds the test in the repository. For an `itFails` test, it is the title passed to `itFails`, without the `[expected failure: …]` suffix the helper adds at run time. **The sync strips trailing tags from the Qase case title** and sends them as Qase tags, so the case reads as prose and `@smoke` is a label you can filter on.
- **`steps`** are copied from the test's run record under `test-results/steps/` (written by Step 10's target-spec run): the `title` of each entry in its `steps` array, in order. A record's own `title` field is the **full Mocha path** (`<feature> — <context> <bucket> <test title>`), not the `it` title, so match a record to its test on the path's tail — or on the file name, which is that path slugified. **Never invent them** — if the run record is missing, write `[]` and say so in the PR body; the sync then gives the case a single generic step.
- **`user`** is the account the test **enters in the login form**, whether or not the app lets it in — a rejection test (wrong password, locked-out account) names the account it tried. It is `no-auth` only when the test enters no account at all: it never touches the login form, or it submits the username empty.
- **`jira`** lists the ticket(s) **this** test traces to — usually just the one you're working.

Write/append with the Write tool and `git add` it alongside the spec. Skip under `dry-run` **and under `--from-file`** (see below). The sync rejects a record missing a non-empty `jira` array or a `steps` array, and two records with the same `feature › context › bucket › title`.

## `expectedFailure` — for a test that lands as `itFails`

A record gains one optional field when its test is locked to a filed defect with `itFails` because the **application**, not the test, is wrong (ADR-0024):

```json
"expectedFailure": {
  "key": "OR-4",
  "url": "https://…/browse/OR-4",
  "reason": "one plain sentence: what the application does that it should not"
}
```

Write it exactly when the spec uses `itFails` — which, per `fix-loop.md`, is only when a person already made that call: on the ticket, or at the approval of a blocked run. The sync puts the defect in the Qase case's description, so a reader of the catalogue sees why the case is expected to fail instead of a bare status. A record whose test uses `itFails` but has no `expectedFailure` is an unattributed expected failure — the thing ADR-0024 warns is indistinguishable from a test somebody gave up on.

## What the merge-time sync does (`src/tcms/suite-sync.ts`, run by CI)

- Reads **all** `.tcms/records/*.json` and the committed `qase-map.json`.
- One Qase case per logical test under **`feature › context › bucket`**, marked **automated**; steps from the record's `steps`, with the AC text as the last step's expected result.
- **No hand-written case ids.** A test's identity is its `feature › context › bucket › title`, with trailing tags stripped — so tagging or untagging a test updates its case instead of replacing it. The first sync finds the case by title (or creates it) and records its id in `qase-map.json`, which later syncs use to update it directly. The bot commits the refreshed map back to `main`.
- **Removes** every mapped case whose record no longer exists — a test deleted from the suite, with its record, disappears from Qase at the next sync. It refuses to remove anything when there are no records at all, which is more likely a broken checkout than a deleted suite.
- **Renaming a test, or moving it to another bucket, is a new case**: the old one is removed with its history and a new one is created. Rename deliberately. Adding or removing a tag is **not** a rename.

Mapping lives in `src/tcms/case-mapper.ts` + `suite-sync.ts` — do not re-derive.

## Runs sourced from a local file

**They write no records at all** (ADR-0026). A file-sourced run skips Step 11.5 along with the branch, commit and PR: there is no ticket, so there is no requirement for a catalogue case to trace to — and the sync rejects a record with an empty `jira` array.
