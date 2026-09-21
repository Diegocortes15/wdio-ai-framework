# WebdriverIO + Appium Conventions Reference

The `/from-issue` skill consults this doc when rendering test files (Step 7 of [`workflow.md`](workflow.md)) and when adding members to a Page Object (Step 5). It is the mobile counterpart of the Playwright conventions this skill was first written against; the judgment is the same, the mechanics are not.

## Locator preference order

**Read the rule below, not CLAUDE.md.** A skill directory is the portability boundary, so a skill lifted into another repository takes its own `references/` and leaves CLAUDE.md behind. The rule has to be complete here or it does not survive the move. Keep the two in agreement by editing both.

Use the highest-priority locator that **uniquely identifies the element on the screen the test is standing on**. Both halves of that sentence carry weight, and the second one is the half that actually breaks tests — see "Uniqueness outranks level" below.

| Level | Strategy | WDIO form | Measured median (API 35) |
| ----- | -------- | --------- | ------------------------ |
| 1 | accessibility id (`content-desc` / `accessibilityIdentifier`) | `$('~Tap to login with given credentials')` | 10 ms |
| 2 | resource-id | `$('id=<package>:id/nameET')` | 9 ms |
| 3 | `-android uiautomator` (`UiSelector`) / `-ios predicate string` | `` $('android=new UiSelector().text("…")') `` | 13 ms |
| 4 | `-ios class chain` | `` $('-ios class chain:**/XCUIElementTypeCell[`name == "…"`]') `` | — |
| — | **XPath — forbidden, fails the build** | | 26–28 ms |

Level 1 is the contract written for accessibility and usually for tests; resource-id is an implementation name that survives most refactors. Many elements carry only one of the two — a text field with a resource-id and no content-desc is common — so stepping down from 1 to 2 is routine, and it is still reported (see "Report every downgrade").

**Never XPath.** `no-restricted-syntax` in `eslint.config.js` fails the build. On mobile the argument is cost as much as fragility: XPath is 2–3× slower on Android and up to 10× on iOS, and the one case Appium names as XPath's legitimate niche — reaching an element through its sibling — is covered by `UiSelector().fromParent()`:

```ts
// One product image among six identical ones, discriminated by the sibling title. 1 match.
$(`android=new UiSelector().text("${name}").fromParent(new UiSelector().resourceId("${PKG}/productIV"))`);
```

The XPath a person would naturally write for the same card, `//ViewGroup[.//TextView[@text="…"]]//ImageView`, returns six matches and nothing warns you.

## Uniqueness outranks level

A locator's level does not protect it. **What breaks tests is matching the wrong number of elements**, and on WebdriverIO that failure is silent:

| The locator resolves to | Playwright does | **WebdriverIO does** |
| ----------------------- | --------------- | -------------------- |
| zero elements | auto-wait, then resolve | auto-wait (`waitforTimeout`), then fail |
| one element | act | act |
| **many** elements | throw a strict-mode violation | **act on the first one, silently** |

So counting matters *more* here than on the web, not less. There is no runtime error to tell you a locator is ambiguous; the test simply reads or taps the wrong element and may still pass.

### What to do when you write a locator

1. **Count it on the screen it belongs to** — against the live app (see "Inspecting the live app" below), not by reasoning about the layout. One match is the answer you want.
2. **Count it on the screens a test arrives from.** A header, a list row or an error label can exist on several screens.
3. **When it is ambiguous, narrow it at the highest level that gives one match** — usually `UiSelector().fromParent()` / `.childSelector()` on Android, or a predicate combining `label` and `type` on iOS. Say which level you took and why, at the call site.
4. **Never use `$$(sel)[0]` to quiet an ambiguous locator.** It turns "which element is this?" into an arbitrary answer.

### Inspecting the live app

Selectors are verified against the running app before they are written, never inferred from the ticket or from memory. In this repository the tool is the `wdio-mcp` MCP server (`@wdio/mcp`), which drives its own Appium session:

- **`start_session`** with `platform: 'android'`, the device name, the APK's absolute `appPath`, `appWaitActivity: '*'` and **`autoAcceptAlerts: false`**. Its default accepts system dialogs silently — and a system dialog over the app is exactly what you need to see when an element "does not exist".
- **`get_elements`** with `includeContainers: true` and `inViewportOnly: false` lists every element with its accessibility id, resource-id and text. Pass both explicitly rather than trusting a default — the tool's README and its own schema disagree about `inViewportOnly`, and a count taken over part of the screen is not a count.
- **`get_elements` is a snapshot, and nothing in the tool waits.** `tap_element` does not wait either. Right after a tap that changes screens, the tree can be half-built — two root containers and nothing else — which reads exactly like "the element does not exist". So poll: after any transition, call `get_elements` again until an element that identifies the destination screen appears (its title, a field only it has), up to about 5 attempts. Only once that anchor is present does a missing element mean anything. If it never appears, take `get_screenshot` to see what is actually on screen — a system dialog, a different screen — before concluding anything.
- **A suggested selector ending in `.instance(N)` means the plain selector matches more than one element.** That is the count, delivered for you: narrow it, do not keep the suffix.
- **Never copy an XPath the tool suggests** (`altSelector` often is one). XPath fails the build here.
- **`close_session` when done.** Running the suite on the same device kills an open exploration session; start a new one afterwards.

Where no such tool is available, a throwaway spec that logs `driver.getPageSource()` answers the same questions — count the matches in the XML.

### Elements that exist only while shown

Some elements are absent from the view tree until they are displayed — validation messages are the usual case (`nameErrorTV` on the login screen appears only after a failed submit), and the cart badge is absent, not zero, when the cart is empty. Assert on them with an auto-waiting matcher (`toHaveText`, `toBeDisplayed`); a count of zero is the resting state, not a broken locator.

### Report every downgrade

Anything below level 1 goes in the run's **Obstacles encountered** as a selector downgrade: the element, the level available, the level used, and why. That is the only place a reviewer learns you looked.

## Composition rules the generated code must obey

Stated here rather than cited, because a skill lifted into another repository takes this file and leaves CLAUDE.md behind.

**A Page method never returns another Page.** Return `void` or data. Fluent navigation was rejected: it makes every Page know the graph of every Page it can reach, and a test reads as a chain whose type says nothing about where it ended up. The spec navigates explicitly, by calling the Page it means.

**No Page imports another Page.** Same rule seen from the file system, and the one a generator breaks first. If two Pages need the same element, it becomes a Component.

**A Component knows about locators and, optionally, child Components. Never about a Page, and never about its parent.** Nesting stops at depth 2.

**A Page composes Components and holds page-unique locators.** It never composes another Page.

**Tests know Pages and Data only** — never a raw `$()` built in the spec, never a Component directly.

**Page Objects are exported as singletons** (`export default new LoginPage()`), because WebdriverIO has no fixtures to inject them. A spec imports the Page it uses (`import LoginPage from '@pages/LoginPage'`). Locators are getters, so each access re-queries the current screen instead of holding a stale element.

If you are generating for an app whose team already uses fluent Page Objects, this is a real disagreement: say so in the obstacles section rather than quietly following the house style of whichever repository you are standing in.

## Auto-waiting assertions

Use `expect-webdriverio` matchers on elements. They retry until they pass or `waitforTimeout` expires.

```ts
// GOOD: retries until the text matches or the wait expires
await expect(LoginPage.passwordError).toHaveText('Enter Password');

// BAD: a one-shot read, taken whenever this line happens to run
expect(await LoginPage.passwordError.getText()).toBe('Enter Password');
```

## No manual waits

```ts
// FORBIDDEN — lint fails the build
await browser.pause(2000);
```

A hand-rolled `setTimeout` sleep is not caught by lint and is banned all the same. App start-up and screen transitions vary between runs on a device — a splash that takes 3 s on one run takes 6 s on the next — so a fixed sleep either wastes time or flakes. Poll for the element.

## Asserting that something does NOT happen

The hard case on mobile, and one the web conventions never had to state. An acceptance criterion like *"a wrong password shall not open the catalog"* asserts an **absence**, and an absence is true at the instant before the thing arrives.

```ts
// BAD: passes immediately after the tap — before a navigation that takes ~1.2 s lands
await expect(CatalogPage.title).not.toBeDisplayed();

// GOOD: watch for the navigation for a bounded window, and assert it never came
expect(await CatalogPage.opensWithin(NAVIGATION_WINDOW_MS)).toBe(false);
```

Rules:

- **The watch is a Page Object query returning data** (`opensWithin(ms): Promise<boolean>`), not a raw wait in the spec.
- **Measure the window, name it, and write the measurement beside it.** Take a few times the real duration of the thing that must not happen (a successful sign-in reaches the catalog ~1.2 s after the tap; the window is 5 s). A window shorter than the real transition makes the test pass vacuously.
- **How to measure it:** the inspection tool cannot time a transition. Write a throwaway spec under `tests/` that does the action with input that *does* trigger the navigation, takes `Date.now()` right after the tap, waits for the destination with `waitForDisplayed`, and logs the difference. Take at least three samples, write the range beside the constant, and delete the spec before anything is committed.
- **It costs the full window on every passing run.** Prefer a positive signal whenever the application offers one — an error message that appears is always better than a navigation that does not. Use the absence only when nothing positive exists.
- **An expected failure catches a vacuous version.** If the test is locked to a defect with `itFails` and the absence check passes too early, the run reports "expected to fail, but passed" — which is the right alarm.

## Named steps live in the Page Object, not the spec

WebdriverIO has no `test.step`. The project's `step(title, fn)` helper (`src/utils/step.ts`) is the equivalent: it records the step's title, outcome and duration, and a WDIO hook writes one JSON record per test under `test-results/steps/`. Those titles are what other tools read — `/report-bug` turns a failed test's steps into repro steps, and the TCMS records artifact carries them as a case's steps.

```ts
// LoginPage.ts
import { step } from '@utils/step';

async loginAs(username: string, password: string): Promise<void> {
  await step(`Submit credentials for "${username}"`, async () => {
    await this.usernameInput.setValue(username);
    await this.passwordInput.setValue(password);
    await this.loginButton.click();
  });
}
```

**Placement rules:**

- **Every action method a test calls directly is wrapped in one `step`** — composed ones (`open`, `loginAs`) **and** single-element ones (`openMenu`, `openProduct`). This differs from the Playwright rule on purpose: there, primitives were left unwrapped because the trace auto-records every click. Appium has no trace, so an unwrapped action is invisible in every report.
- **Depth is 1 by construction.** A step called inside another step is folded into the outer one, so a composed method may call stepped Component methods freely.
- **Queries are not steps.** `getProductNames()` and `opensWithin()` return data; they are not actions a person would list in repro steps.
- **Specs never call `step`.** Assertions stay in the spec as plain `expect(...)`. If a behaviour needs a named action the Page Object doesn't expose, add the method to the Page Object.
- **Step titles are action-focused, present tense, written for a human reading a failure** (`'Submit credentials for "bod@example.com"'`). **Never put a password or a token in a title** — titles are written to disk and copied into bug reports.

One logical assertion per test. Don't pile unrelated assertions into one test.

## Test isolation

**Every test starts from a fresh app process**: a Mocha root hook terminates and relaunches the app before each test, so it begins on the app's launch screen, logged out, with nothing in memory. Do not share state across tests and never rely on test order. A test that needs a session logs in through the Page Object as its own setup.

There is no `storageState` equivalent: the app keeps session and cart in memory, and nothing survives the relaunch. Check this per application — an app that persists state to disk needs its data cleared as well, and the reset hook is where that belongs.

## Page Object methods

Methods are verb phrases (`open()`, `loginAs()`, `openProduct()`); queries return data. Locators are exposed as getters so a spec can assert on them with an auto-waiting matcher, but a spec never builds its own `$()`.

```ts
// GOOD
await LoginPage.loginAs('bod@example.com', '10203040');
await expect(LoginPage.passwordError).toHaveText('Enter Password');

// BAD: the spec knows the screen's internals
await $('id=com.example:id/nameET').setValue('bod@example.com');
```

## Anti-patterns

### Conditional asserts

```ts
// BAD: passes vacuously when the message isn't there
if (await LoginPage.passwordError.isDisplayed()) {
  await expect(LoginPage.passwordError).toHaveText('Enter Password');
}
```

Use auto-waiting assertions and let them fail loudly.

### No conditionals in a test body (parameterized variants)

When you parameterize a test over variants that differ by which **action** or **expected value** applies, put that difference **in the data table** and apply it on a single straight-line path — never branch in the body.

```ts
// GOOD — the differing value is data, applied unconditionally
const rejections = [
  { input: 'an empty username', username: '', password: '10203040', error: 'usernameError', message: 'Username is required' },
  { input: 'an empty password', username: 'bod@example.com', password: '', error: 'passwordError', message: 'Enter Password' },
] as const;
for (const { input, username, password, error, message } of rejections) {
  it(`${input} is rejected with "${message}"`, async () => {
    await LoginPage.open();
    await LoginPage.loginAs(username, password);
    await expect(LoginPage[error]).toHaveText(message); // type-safe: a getter name
  });
}
```

Each row is still a real, independent test.

### Exact match for named-element filters

When a query targets one element identified by a human name, match it exactly. `UiSelector().text("…")` is exact; `.textContains("…")` would also match every longer name that contains it. Use the substring form only when matching a group deliberately.

## Reaching the state a test starts from

Before rendering a test, decide for each precondition: **is getting there the subject, or is it setup?**

- **The acceptance criterion names the action** → drive it through the UI.
- **The criterion assumes the action and describes what comes after** → it is setup. On mobile there is usually no shortcut to seed it — no deep link, no test activity — so setup also goes through the UI, as a Page Object call the test makes before the part it is about. Check the application's manifest for deep links before assuming there are none; if one exists, it is the seeding mechanism.

**Never shortcut the precondition when the subject is the state SURVIVING** — a test about a cart surviving the app being backgrounded builds the cart through the UI, backgrounds the app, and reads it back.

## Device-level actions belong in the spec, not in a Page Object

`driver.back()`, backgrounding the app, and terminating or relaunching it are the device's controls, not a screen's — the same on every screen. They are called from the spec, like `page.goBack()` on the web.

**Know what a device action does before relying on it.** Measured on the reference app: `driver.back()` with the navigation drawer open **exits the app to the launcher** instead of closing the drawer. **Assert you arrived before you go back**, so a back that did something unexpected fails where it happened.

## See also

- [`test-principles.md`](test-principles.md) — F.I.R.S.T. (overlap on Fast / Repeatable)
- [`bucket-classification.md`](bucket-classification.md) — categorization happens after these conventions
- https://appium.io/docs/en/latest/guides/ — upstream source
