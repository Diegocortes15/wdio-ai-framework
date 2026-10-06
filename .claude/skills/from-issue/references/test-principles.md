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

### Anti-Isolated: state built once and shared

```ts
// BAD: the arrange runs once, so the second test depends on the first
before(async () => {
  await CatalogPage.openProduct(PRODUCT);
  await ProductDetailPage.addToCart();
});

it('the cart lists the product', async () => {
  await CartPage.open();
  expect(await CartPage.getProductNames()).toEqual([PRODUCT]);
});

it('the cart badge reads 1', async () => {
  // only true if the test above ran, and ran first
  await expect(CatalogPage.navigation.cartBadge).toHaveText('1');
});
```

Rewrite: every test arranges what it needs. There are no fixtures to inject one — Page Objects are
singletons and the spec calls them directly.

On this framework the anti-pattern does not even buy the speed it is reaching for: a root hook
relaunches the app before **every** test, so anything a `before` built is gone before the first test
runs (see `wdio-conventions.md` "Test isolation"). Shared setup here does not couple the tests — it
simply is not there any more.

### Anti-Self-validating: assertion-free test

```ts
// BAD: green as long as the taps land, even if nothing reached the cart
it('adding a product fills the cart', async () => {
  await CatalogPage.openProduct(PRODUCT);
  await ProductDetailPage.addToCart();
  // No expect(). The cart could have stayed empty.
});
```

Rewrite: every test ends on an assertion about what the action changed.

```ts
it('adding a product fills the cart', async () => {
  await CatalogPage.openProduct(PRODUCT);
  await ProductDetailPage.addToCart();

  await expect(ProductDetailPage.navigation.cartBadge).toHaveText('1');
});
```

### Anti-Self-validating: the assertion that could have read another element

Having an `expect` is not the same as being able to fail. This one shipped green here:

```ts
// BAD: after decreasing 6 → 5, the badge reads 5 AND the row's quantity reads 5.
// The locator resolved to the row. The badge could have been frozen, wrong or
// absent, and this test would still be green.
await CartPage.decreaseQuantity();
await expect(CartPage.navigation.cartBadge).toHaveText('5');
```

The test is not wrong on its face — the fix is not a different assertion, it is a
state in which the two cannot agree:

```ts
// 6 of one product and 1 of another: the badge reads 7, the rows read 6 and 1.
// Now a locator pointing at a row produces 6, and the test fails as it should.
```

Ask it of any assertion whose expected value is short — a number, a word like
`Active`, a price. Where the repository offers an assertion audit, it counts the
duplicates and names the element the test read; where it does not, count by hand
on the screen the test stands on.

## When in doubt

Prefer **Isolated** and **Self-validating** above the others. Fast and Repeatable matter at scale; Timely is about workflow not code. Isolated + Self-validating directly determine whether a test is trustworthy.

## See also

- [`wdio-conventions.md`](wdio-conventions.md) — overlap on "no fixed sleeps" (Fast + Repeatable)
- [`workflow.md`](workflow.md) Step 7 — where these principles are consulted during render
