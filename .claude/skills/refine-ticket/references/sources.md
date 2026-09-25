# Sources — where refinement evidence comes from

`/refine-ticket` resolves gaps (see [`rubric.md`](rubric.md)) from **ground truth**, not invention. It consults sources in the cheap-to-expensive order below, then asks the user for anything still unresolved. **A missing source is never a failure — it is a prompt for input.** This is what makes the skill reusable on a greenfield repo with no docs.

## Discovery order (cheap → expensive)

1. **The ticket** — already read in workflow Step 2 (Atlassian MCP `getJiraIssue`).
2. **The authoring contract** — `docs/jira-tickets.md` when present: what a good ticket looks like (mirrors the rubric).
3. **Existing automation (ground truth)** — read the repo:
   - `src/pages/` — real Page Objects + their action methods (confirms locations + capabilities).
   - `tests/` — existing specs (feeds the rubric's coverage flag).
   - `data/` — named scenarios and reference data (confirms data). Test accounts may live here, in `docs/app/` (source 4), or only in the tickets and on the app's own login screen. Check each rather than assuming any.
   - `src/components/`, and `src/fixtures/` or `src/hooks/` where they exist — what's wired, including the state every test starts from.
4. **App domain knowledge** — `docs/app/` when present: `users.md` (the real users), `flows.md`, `overview.md`, `glossary.md`.
5. **Framework judgment** — `CLAUDE.md`, `from-issue/references/bucket-classification.md`, `from-issue/references/smoke-policy.md`, `from-issue/references/qa-analysis.md`.
6. **The running application** — only when the ticket references something that already exists, and under the rules in the section below.
7. **User-supplied** — anything the user points at mid-loop.

## 6. The running application — for a reference that already exists, and nothing else

Refinement is **shift-left**: it must work for a ticket whose feature is not built yet. That is why the
app is not a general source. But a ticket often points at something that **does** exist — "the same
error as the login screen", "reuse the cart's empty state", "this button, on the new page" — and for
that kind of gap the app is the very thing the ticket is referring to. Asking the user to re-describe
what the app already shows is worse than looking (ADR-0045 scopes the inherited ADR-0013 for this).

**The test for whether the app may be consulted** is one question: *does the thing the ticket
references already exist?*

- **Yes** — a screen, a message, a component, a behaviour the new work is asked to copy or extend.
  Open it, read it, record it as an observation.
- **No** — the behaviour is new, or the reference is the behaviour under design. Close the gap the
  normal way: ask the user, or point at a doc. **Never drive the app to decide what new behaviour
  should be.** That is writing the specification from the implementation, and it silently promotes
  today's defects into tomorrow's acceptance criteria.

**Every reading is an observation, never a requirement.** Record it with its provenance and carry it to
the approval gate marked `observed`, so a person decides whether it is intended behaviour:

```
Observed 2026-09-25 on Android (my-demo-app 2.2.0, emulator API 35):
the cart's empty state shows "Oh no! Your cart is empty…" above a "Go Shopping" button.
```

**Name the platform, always.** The two builds of this SUT do not agree: the same account is
`bod@example.com` on Android and `bob@example.com` on iOS, product names differ, and one account is
locked out on Android and signs in on iOS. An observation without a platform is false half the time.
When the AC applies to both platforms, **observe both** before writing it, and say so; when they
differ, that difference is itself a gap for the author to resolve.

**If the app contradicts the ticket or the docs, that is a finding, not an input** (ADR-0030). Report
it and let a person decide; do not quietly rewrite the AC to match what the app does.

Two rules from before still hold: **no selectors in the ticket** (`/from-issue` confirms those at
generation time), and **a missing device is never a failure** — if nothing is running, say the
reference could not be verified and ask the user, exactly as with any other absent source.

## User-supplied-source protocol

When a gap cannot be closed from sources 1–6, ask the user a **targeted** question and offer two response modes:

- **(a) Answer directly** — the user states the fact ("use `standard_user`"; "the error is `Epic sadface: ...`").
- **(b) Point at a source** — the user names where the knowledge lives. Ingest it, then re-resolve the gap:
  - **Confluence page** → fetch via `getConfluencePage` (or locate via `searchConfluenceUsingCql`).
  - **A URL** → fetch and read it.
  - **A repo path or doc** → `Read` / `Grep` it.

Ask one cluster of related gaps at a time; do not interrogate one field per message. Record every assumption made when the user says "default it / your call" so it can be shown at the approval gate.

## Greenfield behavior

On a repo with no `docs/app/` and an empty suite, sources 3–4 yield little; the skill leans on 5 and 7 (conventions + you) — and source 6 answers nothing either, because a greenfield repo has nothing built to reference. It still scores the ticket against the rubric and closes gaps via user input — it does **not** abort for lack of docs, and it does **not** invent ground truth silently.
