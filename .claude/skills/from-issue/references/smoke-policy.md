# Smoke Policy Reference

The `/from-issue` skill uses this doc to decide which generated tests get the `@smoke` tag. The decision is recorded in the test's `smoke: boolean` field in Step 6 of [`workflow.md`](workflow.md), then drives the `@smoke ` prepend in Step 7 and the `⚡` marker in the PR description's AC coverage table (see [`pr-description-template.md`](pr-description-template.md)).

## What `@smoke` means in this project

`@smoke` marks a test as a **build-verification candidate**. The smoke set should:

- **Cover critical user journeys** — the flows that, if broken, render the application unusable
- **Stay tight** — small enough to run in 1-2 minutes; meant for fast feedback on every push/PR
- **Be stable** — minimal flakiness so failures signal real regressions, not test brittleness
- **Run via `npm run test:smoke`** — which uses `playwright test --grep "@smoke"`

A test that's "happy path" but peripheral (e.g., sort by price) is NOT smoke. A test that's "negative" but covers critical regression risk (e.g., unauthenticated cart access is properly blocked) IS smoke. Bucket (Positive/Negative/Edge) is orthogonal to smoke status.

## Criteria for `smoke: true`

A test is smoke-worthy if at least one applies:

- **Core authentication or authorization flow** — login success/failure, session, route gating
- **Checkout completion or payment** — must-not-break revenue-critical paths
- **Data integrity assertion** — cart state, order persistence, user data correctness
- **Critical regression risk** — historically-broken flows where a bug would be customer-facing
- **Gateway to the rest of the app** — landing pages, primary navigation that other tests depend on

## Never change an existing test's smoke status

The run assigns smoke to the tests **it generates**, and to nothing else. If reading the existing set reveals that a new test is a more critical version of something already tagged, **say so in the PR body and leave that test alone**:

> ⚠️ **Smoke overlap:** `<new test>` covers the same failure as `<existing test>`, which is currently `@smoke`. Reviewer: consider whether the older one still earns the tag.

Three reasons it reports instead of editing. The tag routes tests into the build gate, so removing one silently changes what verifies a release. ADR-0010 is deliberate about not destroying manual edits, and a `@smoke` a person added is one. And touching tests unrelated to the ticket puts them in the diff, which makes the pull request harder to review for no gain.

Same shape as every other judgment call in this skill: report it, let a person decide.

## Criteria for `smoke: false`

A test is NOT smoke-worthy if it primarily verifies:

- **UI nicety** — animations, hover states, visual polish
- **Sort/filter variation** — alternative orderings of the same data
- **Performance assertion** — load time, render time (these are Edge bucket, not smoke)
- **Visual regression** — pixel-perfect comparisons (separate concern from build verification)
- **Secondary error path** — when a more critical version of the same error is already smoke. **This one is relational**: it cannot be judged from the new test alone, which is why Step 6 lists the existing set before classifying. Until that listing exists the criterion is unusable, and a policy that asks a question the run cannot answer promises more precision than it delivers.
- **Boundary nicety** — whitespace handling, character encoding, locale variations
- **Configuration variation** — same behavior tested under different valid configs

## Worked examples

### `smoke: true` (3 examples)

- AC: "Standard user logs in with valid credentials and lands on inventory page."
  → Test: `@no-auth standard_user logs in successfully and lands on inventory`
  → **smoke: true** — core auth flow; gateway to the rest of the app.

- AC: "Locked-out user sees the lockout error message."
  → Test: `@no-auth locked_out_user sees the lockout error`
  → **smoke: true** — critical auth-rejection regression risk; protects against silent permission failures.

- AC: "User can complete checkout with valid info and see the order confirmation."
  → Test: `@standard checkout with valid info completes successfully`
  → **smoke: true** — checkout completion (revenue-critical path).

### `smoke: false` (3 examples)

- AC: "User sorts products by price descending and sees products in the expected order."
  → Test: `@standard sort by price descending shows products in order`
  → **smoke: false** — sort variation; secondary to "user can browse products".

- AC: "Invalid password shows a generic error message."
  → Test: `@no-auth invalid password shows generic error`
  → **smoke: false** — secondary error path; the locked_out_user case already covers critical auth rejection in smoke.

- AC: "Inventory page loads within 2 seconds on a cold cache."
  → Test: `@standard inventory page loads within 2 seconds`
  → **smoke: false** — performance assertion (Edge bucket); not a flow-correctness concern.

## When in doubt

Default to **`smoke: false`**. Over-tagging makes the smoke set useless; under-tagging is recoverable (reviewer can add `@smoke` in the PR before merge). The smoke set should grow conservatively, not eagerly.

## Reviewer override

If a reviewer disagrees with the LLM's smoke pick on a PR, the workflow is: edit the generated test file directly in the PR — add `@smoke ` after the auth-tag, or remove it. The orchestrator does NOT re-run on the same issue. The PR is the curation gate; the LLM is just the first draft.
