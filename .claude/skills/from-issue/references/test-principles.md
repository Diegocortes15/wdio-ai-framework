# Test Principles (F.I.R.S.T.) Reference

The `/from-issue` skill consults this doc when rendering test files (Step 7 of [`workflow.md`](workflow.md)). Generated tests should comply with the F.I.R.S.T. principles for test quality. The compliant + non-compliant examples below help calibrate what "good" looks like for this framework.

F.I.R.S.T. = **F**ast, **I**solated, **R**epeatable, **S**elf-validating, **T**imely.

## Principles

### Fast

A test should run in seconds, not minutes. Target: <5 seconds per test for UI-driven scenarios; <1 second for unit-style.

- Favor a state shortcut (a deep link, a test activity) over UI clicks for setup that is not the subject — when the app offers one. Many mobile apps offer none; then setup goes through the UI and costs what it costs
- Avoid waiting for animations or network delays unnecessarily
- Use auto-waiting assertions (no `browser.pause()`, no fixed sleeps)

### Isolated

Each test creates its own state. No test depends on another test's side effects.

- Use `beforeEach` not `beforeAll` to reset state per test
- Don't share mutable fixtures across tests
- Tests must pass in any order; tests must pass when run alone
- A root hook relaunches the app before every test, so each test starts on a fresh process (see `wdio-conventions.md` "Test isolation")

### Repeatable

Same result every time, every environment.

- No `Math.random()` without a fixed seed
- No `new Date()` assertions tied to wall-clock time
- No flaky waits (always use auto-retrying `expect` assertions)
- Use fixed test data (from `data/` fixtures, not generated random values)

### Self-validating

Every test ends with an `expect(...)` assertion. Pass/fail is unambiguous.

- No "look at the screenshot and verify" tests
- No `console.log` as the verification mechanism
- No tests that pass when the SUT is broken (e.g., asserting an element exists without checking its content)

### Timely

Tests are written close in time to the code change they verify.

- For this framework: generated tests ship in the same PR as the Page Object scaffold (or shortly after)
- Don't accumulate untested code — file a Jira ticket when a feature lands

## Anti-pattern gallery

### Anti-Fast: logging in when the behaviour does not need a session

```ts
// BAD: the cart works logged out, so this login is ~5 s spent on nothing the AC asks about
it('adding a product shows a cart badge of 1', async () => {
  await LoginPage.open();
  await LoginPage.loginAs('bod@example.com', '10203040');
  await CatalogPage.openProduct('Sauce Labs Backpack');
  // ...
});
```

Rewrite: log in only when the acceptance criterion needs a signed-in user. Check what the app actually requires before adding a login as setup — measured on the reference app, adding to the cart works logged out, and a UI login costs ~5 s per test.

```ts
// GOOD: starts where the reset leaves it, logged out on the catalog
it('adding a product shows a cart badge of 1', async () => {
  await CatalogPage.openProduct('Sauce Labs Backpack');
  // ...
});
```

### Anti-Isolated: shared state via beforeAll

```ts
// BAD: cart state persists across tests, test order matters
let cart: CartPage;
test.beforeAll(async ({ browser }) => {
  cart = /* shared singleton */;
});
test('add item', async () => {
  await cart.add('X');
});
test('cart shows 1 item', async () => {
  await cart.expectCount(1); // depends on first test running first
});
```

Rewrite: each test gets its own fixture-provided page; setup happens per-test.

### Anti-Self-validating: assertion-free test

```ts
// BAD: test always passes if the page loads, even if the action is broken
test('add product', async ({ inventoryPage }) => {
  await inventoryPage.goto();
  await inventoryPage.addProductToCart('Sauce Labs Backpack');
  // No expect(). Test passes even if the cart didn't update.
});
```

Rewrite: every test has an `expect(...)` at the end.

```ts
test('add product', async ({ inventoryPage }) => {
  await inventoryPage.goto();
  await inventoryPage.addProductToCart('Sauce Labs Backpack');
  expect(await inventoryPage.header.cartBadge.getCount()).toBe(1);
});
```

## When in doubt

Prefer **Isolated** and **Self-validating** above the others. Fast and Repeatable matter at scale; Timely is about workflow not code. Isolated + Self-validating directly determine whether a test is trustworthy.

## See also

- [`wdio-conventions.md`](wdio-conventions.md) — overlap on "no fixed sleeps" (Fast + Repeatable)
- [`workflow.md`](workflow.md) Step 7 — where these principles are consulted during render
