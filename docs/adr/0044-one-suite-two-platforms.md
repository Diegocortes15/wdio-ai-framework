# 0044 — One suite, two platforms: the same specs run on Android and iOS

**Date:** 2026-09-25
**Status:** Proposed
**Confidence:** High for the reset and the platform-skip mechanics — both measured on a device, see
below. Medium for the locator layer: `byPlatform` is designed and typechecked, but no Page Object has
been ported to it yet, so the claim "only the locators differ" is measured on the page source, not on
a green iOS run.
**Review by:** when a device cloud runs the suite, or when a third target appears (tablet, real device).
**Enforced by:** `tsc --noEmit` — a `Record<Platform, T>` locator map missing a platform does not
compile, and typecheck already runs in `pr-checks.yml` without a device; an ESLint `no-restricted-syntax`
rule that bans `driver.isAndroid` / `driver.isIOS` inside `tests/**`; `itOn` requires a written reason
the way `itFails` requires a defect key. **None of the three exists yet** — they land with the refactor
this record describes. Until then: prose only.

## Context

The repository tests whether the AI layer ports to another platform. Testing the same product on
Android and iOS is the second half of that question, and the decision cannot wait: every Page Object
written before it is a Page Object to rewrite.

Measured 2026-09-25 on an iPhone 16 simulator (iOS 18.3, app `com.saucelabs.mydemo.app.ios` 2.2.2;
the Android APK is 2.2.0 — see "Accepted drift"):

- **The screens and their content match.** Same catalog, same product detail, same cart, same totals.
- **Navigation differs.** iOS has a tab bar (`~Catalog-tab-item`, `~Cart-tab-item`, `~More-tab-item`)
  and reaches login through More; Android has a drawer (`~View menu`) and a cart icon in the header.
- **Test data differs.** `Sauce Labs Backpack - Red` (iOS) vs `Sauce Labs Backpack (red)` (Android),
  and the cart total renders `$59.98` on iOS against `$ 179.94` on Android — the space is not ours to
  normalise.
- **The cart badge exists on both.** An earlier reading of the iOS tree concluded it did not; the
  element is there (`~GrayRoundView Icons` plus a `StaticText` holding the count) but XCUITest reports
  `visible="false"` for it, as it does for the tab labels that are plainly drawn. A screenshot settled it.
- **A relaunch clears cart and session on iOS too**, in 3 037–3 464 ms across four relaunches, against
  Android's measured median of 2 600 ms. Verified by reading the More menu's label, not its
  accessibility id — the id is `LogOut-menu-item` in both states while the label switches between
  "Log Out" and "Login".

So the platforms differ in how a screen is reached and in what an element is called, and agree on what
the product does. That is the shape this record is designed for. It is also the common shape: Apple's
HIG has no drawer and puts top-level navigation in a bottom tab bar, so a drawer/tab-bar split is what
two native teams following their own guidelines produce, not a defect.

## Decision

1. **Config topology.** `config/wdio.shared.conf.ts` holds everything platform-independent;
   `config/wdio.android.conf.ts` and `config/wdio.ios.conf.ts` spread it and add one capability each,
   taken from `config/capabilities/`. A device cloud is then a fourth config that reuses the same
   capability object — not a rewrite.
2. **Device and version come from the environment**, with the local machine's values as defaults
   (`ANDROID_DEVICE`, `ANDROID_VERSION`, `IOS_DEVICE`, `IOS_VERSION`). A client's CI never has our AVD.
3. **Platform selection is npm scripts**: `test:android`, `test:ios`, and `npm test` running both in
   sequence, because a pull request is opened green (ADR-0020) and green on one platform is not green.
   No custom `--android` flag: `wdio run` does not parse one, and a wrapper is a layer to maintain.
   Sequence, not parallel: an emulator and a simulator on one machine is the load that already made
   the reset flake 2 runs in 3.
4. **One Page Object per screen.** A locator that differs is a two-key map:
   `$(byPlatform({ android: …, ios: … }))`, resolved **inside the getter**, never at module load.
5. **Navigation differences live in a component**, `Navigation` (today's `Header`), whose API is
   platform-neutral. Composition rule 3 is unchanged: the spec still decides to navigate; only the
   mechanics move.
6. **Data that differs per platform lives in `data/`** and is resolved at call time. It never enters a
   test title: a title is a Qase case's identity, so a platform-dependent title would split one
   behaviour into two cases.
7. **A test whose behaviour does not exist on a platform** is declared with
   `itOn(platform, reason, title, fn)`. The reason is required; the helper appends `@android` / `@ios`
   to the title and decides at declaration time (`driver` is defined when the worker loads a spec —
   measured), so a skipped test costs no app relaunch and the report prints one line with its reason.
   **`itOn` is the exception.** When the behaviour exists and only the observation differs, the test
   stays single and `byPlatform` resolves the locator.
8. **What to run is chosen with `--suite` / `--spec`**, both native to the runner. Capability-level
   `specs` / `exclude` is not used for platform applicability: a CLI `--spec` overrides it, and the
   skills run single specs that way, so the exclusion would silently stop applying.
9. **The reset stays terminate + activate** (ADR-0040, unchanged and now measured on both platforms).
   The hook takes the app id per platform and asks `CatalogPage` for the arrival anchor, so no selector
   lives in two places.
10. **A test record gains `platforms`**, and the platform reaches Qase as a case tag. Qase
    configurations are the right mechanism for per-platform results, and are deliberately not used yet:
    they attribute results, and this pipeline syncs a catalogue, not runs (ADR-0041, ADR-0043).

## Consequences

- The four existing Page Objects and both specs get rewritten once. That cost is paid now precisely
  because it grows with every ticket.
- `npm test` roughly doubles in wall time. The fast loop is per platform; the gate is both.
- A skipped test is visible in the report with its reason, and a client asking "what does iOS cover"
  is answered from the records, not from memory.
- Two app artifacts to keep in step, and **an accepted version drift**: the published Android build is
  2.2.0 and the published iOS build 2.2.2. A behavioural difference between platforms may therefore be
  a version difference; the artifacts and their versions are recorded so that question is answerable.
- `byPlatform` cannot express a difference in _interaction logic_, only in locators and data. The first
  screen that needs different steps on each platform — iOS login already needs a scroll to its submit
  button, Android does not — is handled inside the Page Object method, and if that ever stops being
  readable, the escalation is a platform implementation behind a shared interface. Not before.

## Alternatives considered

- **Cucumber, for real tag expressions** (`not @ios`). Rejected: Mocha has no tags and `grep` is a poor
  substitute, but moving would rewrite 18 tests, the spec style and most of the skill lines the thesis
  measures. The trade is recorded here so a future reader knows it was a choice, not an oversight.
- **`if (driver.isIOS)` inline in each getter**, as the official `webdriverio/appium-boilerplate` does.
  Rejected on one concrete ground: nothing can tell that a platform branch is missing, while a
  `Record<Platform, T>` makes it a compile error on a check that already runs without a device.
- **A Page Object per platform behind a shared interface.** Rejected as premature: measured, no screen
  of this app differs in interaction logic — three files per screen would buy nothing today.
- **Both capabilities in one config, one command.** Rejected for local runs (machine load), and
  unnecessary for CI, where the platform is a job in a matrix.
- **Per-capability `specs` / `exclude`** for platform-only tests — see decision 8.
