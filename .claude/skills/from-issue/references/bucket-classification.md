# Bucket Classification Reference

The `/from-issue` skill uses this doc to classify each generated test into one of three buckets: **Positive**, **Negative**, or **Edge**. The classification is recorded in the test's `bucket` field in Step 6 of [`workflow.md`](workflow.md), then drives the nested describe structure in Step 7 and the `Bucket` column in the PR description's AC coverage table (see [`pr-description-template.md`](pr-description-template.md)).

## Bucket definitions

### Positive

Tests that verify expected behavior under valid inputs and normal state. The happy path. The user does what they're supposed to do; the system responds correctly.

### Negative

Tests that verify expected failure modes under invalid inputs, missing required data, or unauthorized state. The user does something the system should reject; the system rejects cleanly with the right error.

### Edge

Tests that verify boundary conditions, unusual but valid inputs, performance assertions, or other "interesting" states that aren't strictly happy or sad path. The catch-all bucket for tests that don't cleanly fit Positive or Negative.

## Worked examples

### Positive (3 examples)

- AC: "Standard user logs in with valid credentials and lands on inventory page."
  → Test: `@no-auth standard_user logs in successfully and lands on inventory`
  → **Positive** — valid input, expected success.

- AC: "User can add a product to the cart and the cart badge increments."
  → Test: `@all-users add product increments cart badge`
  → **Positive** — normal happy-path flow.

- AC: "User sorts products by price descending and sees products in the expected order."
  → Test: `@standard sort by price descending shows products in order`
  → **Positive** — valid input, expected behavior verified.

### Negative (3 examples)

- AC: "Locked-out user sees the lockout error message."
  → Test: `@no-auth locked_out_user sees the lockout error`
  → **Negative** — expected failure, system rejects.

- AC: "Submitting checkout with missing postal code shows a validation error."
  → Test: `@standard checkout without postal code shows validation error`
  → **Negative** — invalid input, system rejects.

- AC: "User attempts to access cart without logging in and is redirected to the login page."
  → Test: `@no-auth unauthenticated cart access redirects to login`
  → **Negative** — unauthorized state, system rejects.

### Edge (3 examples)

- AC: "Username with leading/trailing whitespace is rejected the same way as malformed input."
  → Test: `@no-auth username with whitespace is rejected`
  → **Edge** — unusual input variation; tests boundary handling.

- AC: "Inventory page loads within 2 seconds on a cold cache."
  → Test: `@standard inventory page loads within 2 seconds`
  → **Edge** — performance assertion; not a happy/sad path behavior.

- AC: "Adding 100 products to the cart works without UI degradation."
  → Test: `@standard cart handles 100 items without degradation`
  → **Edge** — boundary condition; stress test of normal flow.

## When the AC is written in EARS form

A ticket refined by `/refine-ticket` carries its acceptance criteria in EARS notation, and the
trigger keyword is a **hint** worth reading before classifying:

- **WHEN** \<trigger\> — the expected path → usually **Positive**
- **IF** \<trigger\> **THEN** — EARS calls this category "unwanted behaviours" → usually **Negative**

It is a hint and not a rule, and the limit is the important part: **`Edge` has no EARS
counterpart.** Boundary conditions, unusual-but-valid input, performance assertions and
precedence between two error paths are all `IF … THEN` in EARS and can still be `Edge` here.
SW-15's AC 3 — a locked account submitting a *wrong* password, to establish which rejection
wins — is exactly that case, and `Edge` was right for it.

Never use the keyword to argue a test out of `Edge`. The definitions above and the ambiguity
rules below remain the authority; the keyword only saves you re-deriving Positive-vs-Negative
when the author already made that distinction explicit.

## Ambiguity rules

When a test could plausibly fit multiple buckets, apply these tiebreakers in order:

1. **Performance assertion** → Edge, NOT Negative. A slow page isn't "wrong behavior", it's a boundary check.
2. **Missing required input** → Negative, NOT Edge. Empty/missing fields are the canonical negative case.
3. **Multi-AC test spanning happy + sad path** → bucket by the _primary_ assertion. If the test's main `expect()` checks an error message, it's Negative. If it checks a success state, it's Positive. The presence of secondary happy-path setup steps doesn't change the bucket.
4. **Visual regression / accessibility check** → Edge, NOT Positive. These are auxiliary verifications, not flow-correctness.
5. **Locale / i18n / browser variation** → Edge. Variation across environments is by definition a boundary concern.

## When in doubt

Default to **Edge**. It's the catch-all bucket. Misclassifying a Positive test as Edge surfaces in PR review (reviewer can recategorize); misclassifying a Negative test as Positive silently hides the negative coverage.
