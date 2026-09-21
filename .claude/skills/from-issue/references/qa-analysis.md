# QA Analysis Reference

The `/from-issue` skill consults this doc during Step 4 of [`workflow.md`](workflow.md) — AC normalization. It drives the decision of **what tests to actually create** from the AC text, BEFORE bucket classification or smoke selection.

Different from sibling docs:

- [`bucket-classification.md`](bucket-classification.md) categorizes tests after they're decided (Positive / Negative / Edge)
- [`smoke-policy.md`](smoke-policy.md) selects critical tests after they're created (@smoke or not)
- This doc decides WHICH tests to create at all — upstream of both

## What QA analysis means here

A senior QA SDET reading an issue's ACs doesn't generate one test per AC mechanically. They apply judgment:

- ACs that describe the same flow with parameter variations → ONE parameterized test
- ACs that describe compound behaviors → MULTIPLE tests, split by behavior
- ACs that aren't testable (visual aesthetic, manual-only, out of scope) → SKIP

This doc captures that judgment.

## Three types of analysis decisions

### MERGE multiple ACs into one parameterized test

When ACs share the same setup + flow but differ only in inputs or expected outputs.

**Example:**

- AC1: "Valid US postal code (5 digits) is accepted at checkout"
- AC2: "Valid international postal code (alphanumeric) is accepted at checkout"
- AC3: "Empty postal code shows 'Postal Code is required' error"

→ ONE parameterized test that iterates over scenarios:

```ts
const scenarios = [
  { postal: '12345', expectAccepted: true, description: 'US' },
  { postal: 'AB1 2CD', expectAccepted: true, description: 'UK' },
  { postal: '', expectError: 'Postal Code is required', description: 'empty' },
];
for (const scenario of scenarios) {
  test(`@standard checkout postal validation — ${scenario.description}`, async ({
    /* ... */
  }) => {
    /* ... */
  });
}
```

**Why:** less duplication, easier to add cases, single point of maintenance for the flow.

### SPLIT one AC into multiple tests

When one AC contains compound behaviors that should be verified separately.

**Example:**

- AC: "User logs in successfully, adds a product to cart, completes checkout, and sees the order confirmation"

→ THREE separate tests:

1. `@no-auth standard_user logs in successfully and lands on inventory`
2. `@standard add product increments cart badge`
3. `@standard complete checkout shows order confirmation`

**Why:** isolation per F.I.R.S.T. principles. If the checkout breaks, the login test still tells you login works. Merged into one mega-test, you'd lose information.

### SKIP an AC entirely

When the AC isn't automatable in this framework, is out of scope, or is fully covered by another AC's test.

**Examples:**

- AC: "The Login button uses the brand's primary color (#7e57c2)"
  → SKIP — visual aesthetic; covered by visual regression suite if needed, not by functional tests

- AC: "User can sign in with Google OAuth"
  → SKIP — out of scope; saucedemo doesn't have OAuth; this AC may have been filed in error

- AC: "Both valid AND invalid postal codes are handled correctly"
  → SKIP — duplicates AC1 + AC3 from the MERGE example above

### Read the AC's stance: intended, or observed?

Before deciding what to create, decide what the AC is *claiming*. There are two kinds and they
lead to opposite outcomes, and the difference is visible in the AC's own grammar.

**An AC stating intended behaviour** describes what the system should do. Nothing in it mentions
being broken:

> "Given `problem_user` is on the inventory page, when they select "Name (Z to A)", then the
> products are listed in descending alphabetical order."

Generate the test asserting exactly that. If the application disagrees, **the test has found a
bug** — the ADR-0020 gate stops the run and reports; landing it as `test.fail()` against a filed
defect is a separate, human-approved step (ADR-0024). Never soften the assertion to match what
the app does.

**An AC stating observed behaviour** describes what the system currently does, brokenness
included. The words give it away — *collapses*, *broken*, *instead of*:

> "For `problem_user`, every product image collapses to the same broken placeholder (sl-404)
> instead of a distinct image per product."

Generate the test asserting that, and it passes. This is characterization: the ticket asked to
**document** a behaviour, not to require a different one. There is no defect to file, because
nobody claimed the app should be otherwise.

**Both of those are real ACs from this repository, and they produced opposite test shapes.**

The rule for this skill: **assert what the AC says.** Whether a ticket *should* have been written
one way or the other is the author's judgment — `/refine-ticket`'s rubric asks the question
explicitly so it gets settled before generation. Rewriting an AC's stance here would be
reinterpreting a requirement, which is the specific thing the fix loop forbids.

**When the AC's stance is genuinely unclear**, treat it as intended behaviour. That path fails
loudly and routes to a person; the other path produces a test that passes while asserting a bug
is correct, and nothing ever revisits it.

## Worked examples (from saucedemo coverage)

### Example 1: MERGE (3 → 1)

Issue ACs (parameterized variations):

- AC1: Standard user adds Sauce Labs Backpack, cart badge shows 1
- AC2: Standard user adds Sauce Labs Bike Light, cart badge shows 1
- AC3: Standard user adds Sauce Labs Onesie, cart badge shows 1

→ ONE parameterized test iterating over `loadProducts().slice(0, 3)`.

### Example 2: SPLIT (1 → 3)

Issue AC: "Standard user can log in, browse products, add to cart, and check out"

→ THREE tests:

- `@no-auth standard_user logs in` (login.spec.ts)
- `@standard add product increments cart badge` (cart/add-remove.spec.ts)
- `@standard checkout happy path completes successfully` (checkout/happy-path.spec.ts)

### Example 3: SKIP (1 → 0)

Issue AC: "Login button has 200ms fade-in animation on page load"
→ SKIP. Animations aren't tested functionally; visual regression would catch breakage if it matters.

## When in doubt

**Default to NOT merging/splitting/skipping.** One test per AC is the conservative path. Only apply MERGE/SPLIT/SKIP when the case is clear (shared flow, compound behavior, unambiguously non-automatable).

Over-merging hides failures. Over-splitting fragments coverage. Over-skipping loses requirements. The default position is "trust what the BA wrote."

## Reviewer override

If a reviewer disagrees with a merge/split/skip decision, they edit the generated tests directly in the PR (manual add/remove). The skill does NOT re-run on the same issue. Same pattern as `bucket-classification.md` and `smoke-policy.md`.

## PR surface

EVERY merge/split/skip decision MUST surface in the PR body. Three places:

1. **"What I understood from the issue" section's normalized AC list** — show the original AC text + the analysis decision (MERGE/SPLIT/SKIP) + rationale
2. **AC coverage table** — column "Test" shows the resulting test name(s); column "Status" includes `merged into X`, `split into N tests`, or `⚠️ skipped: <rationale>`
3. **"Notes for reviewer" section** (per `pr-description-template.md`) — call out merge/split/skip decisions explicitly with the 📝 marker so reviewers can push back

## See also

- [`bucket-classification.md`](bucket-classification.md) — what happens after QA analysis (categorize the resulting tests)
- [`smoke-policy.md`](smoke-policy.md) — what happens after categorization (mark critical tests)
- [`workflow.md`](workflow.md) Step 4 — where QA analysis is consulted
