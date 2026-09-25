# Failure modes

Where this port broke, what catches it now, and what still does not.

**The rule for this page:** every claim is verified against the code or a run, or it says it is
unmeasured. Nothing here is an estimate dressed as a fact. Where a failure mode has no mitigation, it
is listed anyway — a page that only lists solved problems is marketing.

It exists because the sibling web repository's equivalent page is the most useful document in it, and
because six of the seven failures recorded there were records drifting from reality rather than code
defects. The same pattern already repeated here.

---

## What has actually broken here

Each of these happened during the port, was found, and has something that catches the next one.

| What broke                                                                                                                                                                                                                                                         | How it surfaced                                                                            | What catches it now                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A gate that swallowed its own failure.** The app reset ran in WDIO's `beforeTest`, whose errors are logged and discarded. A reset that timed out let the test run on the previous test's state — and the suite reported green                                    | Noticed while reading a run's log, not from a failure                                      | The reset is a Mocha root hook (ADR-0040): a failed reset fails the test. Verified against two real failures, whose message names the foreground package          |
| **A rule nobody would reach.** The requirement to run an expected-failure test as a plain `it` first lived in `fix-loop.md`, which `SKILL.md` said to read **only** after a failure — while `itFails` is written before any failure. The first real run skipped it | The PR body disclosed it                                                                   | The rule now sits at Step 7 and in the test template's `itFails` rule, where the marker is written. `SKILL.md` no longer says the file is for red runs only       |
| **Configuration that did not travel.** Prettier's config lived outside the skill directories in the web repo, so 28 files here failed `format:check` from Phase 1 onwards                                                                                          | A format check run by hand                                                                 | `.prettierrc.json` + `.prettierignore` (which excludes `.claude/`, so Prettier cannot spend the skills' line budget), and `format:check` in the PR checks         |
| **A lockfile only one npm version accepted.** Written by npm 11 locally; GitHub's Node 22 runner ships npm 10.9.8, which requires an optional peer npm 11 omits. The first Qase sync failed at `npm ci`                                                            | The CI job failed at merge — after review, with nothing before it to check                 | `.github/workflows/pr-checks.yml` runs `npm ci` on every PR. Reproduced both ways before fixing: npm 11 accepts the old lock, npm 10 rejects it                   |
| **Mutable metadata inside an identity.** A Qase case's identity was its test title, and `@smoke` lives at the end of a title here. Tagging or untagging a test would have deleted its case and created another, losing its history                                 | Caught by reading the map after the first sync, with 7 cases in it                         | The mapper strips trailing tags from the case title and sends them as Qase tags; a unit test asserts that a tagged test **updates** its case                      |
| **A connection check that was not a call.** `/from-issue` was told to "confirm the Atlassian MCP is connected". A tool search answered "still connecting" indefinitely, and a run stalled at Step 1 instead of aborting                                            | A real run reported it as a reference gap                                                  | Step 1 calls `getAccessibleAtlassianResources`, retries once, then aborts with the reconnect instructions                                                         |
| **Two Appium servers that coexisted by luck.** The exploration server bound `0.0.0.0:4723` and the test run's bound `127.0.0.1:4723`; macOS allowed both and the more specific listener won                                                                        | Measured while wiring `@wdio/mcp` — the suite passed, which is what made it worth checking | `npm run appium:explore` binds `127.0.0.1:4725`, and `.mcp.json` points the MCP at that port. Measured: running the suite still kills an open exploration session |
| **A tree read mid-transition.** `get_elements` right after a tap returned two root containers, which reads exactly like "the element does not exist"                                                                                                               | A real run reported it; a screenshot proved the screen was correct                         | `wdio-conventions.md` requires polling `get_elements` until an element of the destination screen appears, and a screenshot before concluding anything             |
| **A claim taken from a README instead of the installed code.** This repository's own skill said `get_elements` filters to the viewport by default, quoting the tool's README; the installed 3.13.0 schema says the opposite                                        | Found while writing the rule, before it misled anyone                                      | The rule now says to pass both flags explicitly and not to trust the default. **Nothing enforces this** — the honest answer is "read the installed schema"        |

| **A source search that answered a runtime question.** `accessibilityIdentifier` appears 0 times in the iOS app's source, and the brief concluded from that number that iOS exposes no accessibility ids. The runtime tree is full of them — `~Catalog-screen`, `~AddToCart`, `~ProceedToCheckout` — because UIKit sets them in storyboards, not in code | The first page source dump of the iOS app, three weeks after the claim was written | The count was right; the inference was not. The brief's own caveat — "confirm with a page source dump before deciding anything for iOS" — is now the rule in §5: a source search narrows a runtime question, it never closes one |
| **A tree that calls a drawn element invisible.** XCUITest reports `visible="false"` for the iOS cart badge — and for the tab bar's own labels, which are plainly on screen. Reading the tree alone produced "iOS has no cart badge", which would have marked four cross-platform tests Android-only | A screenshot, taken because the same attribute called the visible tab labels invisible | A screenshot before concluding anything is absent — the rule a tree read mid-transition already forced — and assertions on tab-bar children read existence and text, never `toBeDisplayed()` |
| **An accessibility id that lies about state.** iOS's More menu exposes `LogOut-menu-item` both logged out and logged in; only the visible label switches between "Log Out" and "Login" | Checking that a relaunch clears the session: the id was there in both states, so the check proved nothing | Session state is read from the label, never from that id's presence. An id names a widget, not a state (ADR-0044) |
| **A screen already inside another screen's page source.** On iOS the catalog's source carries the empty-cart view (`No Items`, `Go Shopping`) while the catalog is what is on screen | Dumping the catalog while hunting for the cart's anchors | An existence assertion is not a screen assertion: cart checks are scoped to `~Cart-screen`, and arrival is polled on the destination's own anchor |
| **A driver error that named nothing.** The first XCUITest session failed with a bare "code 70". Xcode 16.2 ships only the iPhoneSimulator18.2 SDK, and the machine had only the iOS 17.5 runtime installed | `xcodebuild -showdestinations`, run by hand, returned a placeholder saying "iOS 18.2 is not installed" — which the driver never said | `xcodebuild -downloadPlatform iOS` (iOS 18.3, 8.72 GB) fixed it, and brief §4 no longer claims this machine needs nothing. **Unenforced:** the rule is to run the underlying tool by hand when a driver reports only a number |
| **A config path that moved with its file.** Moving the WDIO config into `config/` broke the Mocha root hook: `mochaOpts.require: ['./src/hooks/reset-app.ts']` is resolved relative to the CONFIG FILE, so Mocha looked for `config/src/hooks/…` and every worker died before the first test | The first run after the move, with a `Cannot find module` naming the impossible path | The path is `../src/…`, and `wdio.shared.conf.ts` states which options are config-relative (`specs`, `suites`, `mochaOpts.require`) and which are resolved against the working directory |
| **A predicate pattern that matched nothing.** The iOS cart total was addressed with `name MATCHES "\$[0-9]+\.[0-9][0-9]"`. `$` is the predicate language's variable marker, so the pattern found no element at all — not a wrong one, none | The first iOS run of the cart spec: one failing test out of nineteen | The pattern avoids `$` entirely (`[^ ]+[.][0-9][0-9]`, which also separates the total from a row's `$ 29.99` by the space), and `wdio-conventions.md` lists it with the other iOS traps. **Unenforced** — it is a rule in prose |
| **Credentials that can be typed but not submitted.** On iOS the keyboard covers the login screen's submit button, and this build dismisses it for nothing: `mobile: hideKeyboard` errors, the Return key, a tap on another element, a swipe and `mobile: scroll` all leave it up. Six rejected-credential tests cannot exist there | Measured while porting the login spec — five dismissal strategies, each tried and logged | Those tests are `itOn('android', …)` with that reason, printed in the report. `LoginPage.loginAs` throws on iOS when asked for a password other than the listed one, instead of signing in with a password the caller did not ask for |
| **A branch rule that rejected a bot's push.** The Qase sync committed a refreshed `qase-map.json` straight to `main`. A ruleset requiring pull requests then rejected it (`GH013 … Changes must be made through a pull request`), so **every merge left the sync job red** while Qase itself was perfectly in sync | The job failed minutes after the OR-2 merge | The sync keeps no local state and the workflow has `contents: read` (ADR-0043). There is nothing left to push, so the rule and the job no longer disagree |

The pattern worth naming, and it is the web repo's pattern again: **most of these were a rule, a
config or a record that did not match reality, not code that computed the wrong answer.**

The bot-push one is worth a second look, because the first three fixes we reached for were all wrong:
a bypass for the `github-actions` app **cannot exist on a user-owned repository** (the API refuses it,
and a bypass by repository role does not apply to `GITHUB_TOKEN` — measured, rejected twice); a PAT in
secrets would have opened a wider hole than the rule closed; and weakening the ruleset would have
deleted the check that had already caught a real failure. **The workflow was written when `main` was
open, and it assumed it always would be.** When a rule and a job disagree, the job is usually the one
making the assumption.

---

## What the port has measured about the environment

- **The emulator degrades.** After 2 h 42 min of use its load average was 10–12 (and `/proc/loadavg`
  counted 1702 scheduling entities), and the app reset failed in 2 of 3 runs. After a cold restart:
  load 1.8, 984 entities, 3 of 3 green. A
  reset failure is therefore a reason to check the emulator before suspecting the app or the test.
- **`boot_completed` is not idle.** Right after boot the load still spikes to 11–34 for a while. The
  preflight in `scripts/start-emulator.sh` disables the Google apps that ANR, but it does not wait for
  the system to settle. **Unmitigated**, and the reason a first run after boot can be slow.
- **Timings, measured 2026-09-21 on API 35:** app reset (terminate + activate + catalog visible) 2.6 s
  median (n=8); UI sign-in 5.1 s median (n=8); a sign-in reaches the catalog 1.2–1.35 s after the tap
  (n=4). These are what the absence window in the login spec is derived from.
- **Timing, measured 2026-09-23 on API 35:** a tap on "Add to cart" shows the cart badge 0.68–0.70 s
  later (n=3). The 3 s window in the cart spec's "raising the quantity adds nothing" test is derived
  from it.
- **Three screens share one title id.** `productTV` is the catalog's "Products", the product detail's
  product name and the cart's "My Cart"; `cartBt` is both "Add to cart" and "Proceed To Checkout".
  Only one screen is in the tree at a time, so each locator counts 1 — and a `waitForDisplayed` on the
  destination's title passes instantly on the screen you are leaving. Found while scaffolding the cart
  pages for OR-2, before it broke anything. **Caught by convention only:** `CartPage.open()` waits for
  the cart list's content-desc, which no other screen has, and the title getters say to assert text,
  never presence. Nothing enforces it.
- **A value on screen is not always a value in the tree.** A cart row's colour is an image whose
  content-desc is the generic "Displays color of selected product"; the colour itself is not readable
  through Appium. `/refine-ticket` wrote OR-2's AC 7 asking the row to show "its colour" without
  checking it was readable. Diego's call on 2026-09-23: **do not verify it** — asserting that a swatch
  exists would look like colour coverage and prove nothing — so the AC and the test dropped it. Caught
  now by `refine-ticket/references/rubric.md`, which flags an AC asking for a value the tree does not
  carry before it reaches generation.

- **The iOS reset costs 3.0–3.5 s** (n=4, iPhone 16 / iOS 18.3, app 2.2.2): terminate + activate until
  `~Catalog-screen` is displayed, 3 037–3 464 ms, against Android's 2.6 s median. Both clear the cart
  and the session, so ADR-0040's strategy holds unchanged on the second platform.
- **The same app is not the same data.** iOS says `Sauce Labs Backpack - Red` where Android says
  `Sauce Labs Backpack (red)`, and renders a cart total as `$59.98` where Android writes `$ 179.94`.
  Product names and money formatting are platform-dependent inputs (ADR-0044), not constants.
- **The iOS login screen has no ids on its inputs.** One `XCUIElementTypeTextField` and one
  `XCUIElementTypeSecureTextField`, both unnamed, and a submit `Button` named `Login` — the same name
  as the screen title's `StaticText`, so it needs a predicate on type to be unambiguous. Tapping a
  username chip fills both fields at once, which Android has no equivalent of.

- **The two builds do not agree on behaviour.** `alice@example.com` is locked out on Android and signs
  in on iOS 2.2.2 (measured 2026-09-25). A cross-platform suite therefore cannot assume that an AC
  written from one app holds on the other — and the difference is a finding to report, not a test to
  adjust (ADR-0030).
- **iOS submits the login form only through the account chips.** Tapping a listed username fills both
  fields without raising the keyboard, which is the one path that leaves the submit button reachable.

---

## What has no mitigation

- **A plausible-but-wrong test passes every gate.** Inherited unchanged from the web repo. A real
  instance is already in the suite: the test for OR-1's AC 1 asserts three elements are displayed, and
  `LoginPage.open()` already waits for one of them. Nothing but a reviewer catches that.
- **The suite never runs in CI.** No device. PR checks cover install, types, lint, format and the unit
  tests of the Qase sync; whether the tests pass is established on one developer's machine.
- **A dry run is not an independent rerun.** The two `/from-issue` rehearsals of OR-1 produced identical
  code, but the same agent ran both with the first in context. The real independence check is the next
  ticket in a fresh session.
- **Qase steps are a snapshot of one local run.** They are copied into the records when `/from-issue`
  runs the suite; renaming a Page Object's step titles later does not reach Qase until the records are
  regenerated (ADR-0041).
- **A dead Jira link stays dead.** A case's description links its ticket; if the ticket is deleted,
  nothing notices.
- **The application does not change.** Both SUTs are frozen, so every claim about selector durability
  here — including the measured ones — proves uniqueness today, not durability.
- **One author.** Whether these conventions survive a second person is untested. The first evidence
  will be the OR-2 run in a fresh session.

---

## The thesis, measured so far

The port exists to answer one question: how much of the AI layer had to change. Measured against the
Phase 1 baseline (3338 skill lines, 0 changed) at commit `eb524f3`:

| Group                                                                                                                               | Lines changed             |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Whole skills untouched:** `/report-bug`, `/scaffold-page-object`                                                                  | **0** (not yet needed)    |
| **Judgment, untouched:** `bucket-classification.md`, `data-placement.md`, `refine-ticket`'s `workflow.md` + `writeback-template.md` | **0**                     |
| **Judgment, adjusted:** `smoke-policy.md` (1), `qa-analysis.md` (3), `rubric.md` (8), `sources.md` (3)                              | **15 added**              |
| **Mechanics:** conventions, test template, workflow, harness, TCMS, PR template, `SKILL.md`                                         | the rest                  |
| **Total**                                                                                                                           | **+487 / −839, 14 files** |

The split is the finding: what changed is the mechanics — how a test is written, which commands run,
how a locator is verified. What barely moved is the QA judgment — which tests to write, which are
smoke, which bucket they belong to, when a finding goes to a person instead of into a test.

Caveat on the total: `playwright-conventions.md` (509 lines) was rewritten as `wdio-conventions.md`
(218 lines), and git does not detect that as a rename, so it counts as a delete plus an add. Both
`/report-bug` and `/scaffold-page-object` are still Playwright-shaped; their cost is unpaid, not zero.
