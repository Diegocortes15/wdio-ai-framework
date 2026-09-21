# 0040 — Every test starts from a fresh app process; a test that needs a session logs in itself

**Date:** 2026-09-21
**Status:** Proposed
**Confidence:** Medium — measured on one emulator only. Revisit if login time dominates the suite, or
if the app gains a state shortcut (deep link, test activity) that makes logging in cheap.
**Review by:** — when BrowserStack is wired; the reset has not been run there.
**Enforced by:** Config. `src/hooks/reset-app.ts` is a Mocha root hook registered in
`mochaOpts.require` of `wdio.android.conf.ts`, so every test runs behind it. Nothing fails if that
line is removed.

## Context

The web repository logs in once per user and reuses the session through Playwright's `storageState`.
Mobile has no analogue: measured 2026-09-18 and again 2026-09-21, `my-demo-app-android` keeps session
and cart in memory only, and neither survives process death. The APK declares no deep links — its only
exported activity is `SplashActivity` (manifest read with `aapt2`) — so the usual shortcut for skipping
the login UI does not exist here. Logging in also turned out to be unnecessary for most flows: the cart
works while logged out.

## Decision

Before every test, terminate and relaunch the app, then poll until the catalog is displayed. The reset
leaves the app logged out, with an empty cart. A test that needs a session logs in through the UI as
part of its own setup.

The hook is a Mocha root hook rather than WDIO's `beforeTest`, because an error thrown from `beforeTest`
is logged and swallowed. That was observed on 2026-09-21: the reset timed out and the test still ran,
on whatever state the previous test had left. A reset that fails has to fail the test.

## Consequences

- Tests are independent of order, which is what parallel runs on BrowserStack require.
- The reset uses only standard Appium commands (`terminateApp`, `activateApp`) — no `adb shell`, which
  a device cloud may restrict.
- A test that kills the process on purpose (OR-3) does not disturb the next test.
- Cost, measured 2026-09-21 on API 35 (n=8, one session): reset **2.6 s** median, UI login **5.1 s**
  median. Tests that need a session pay both.
- When the reset fails, Mocha skips the remaining tests of that spec file. That is intended: nothing
  after a failed reset can be trusted.
- The reset is only as stable as the emulator. On 2026-09-21 it failed in 2 of 3 runs on an emulator
  whose load average was 10–12, and passed 3 of 3 after a cold restart.

## Alternatives considered

- **Keep the process alive and walk back to the catalog between tests.** Measured cheaper per test
  (`back()` to the catalog, 1.1 s median, not counting emptying the cart). Rejected: tests become
  order-dependent; one failure leaves an unknown state for the next test (measured: `back()` with the
  menu drawer open exits to the launcher); it blocks sharding across devices; and OR-3 kills the
  process anyway.
- **Clear app data (`adb shell pm clear`) between tests.** Not needed — nothing is persisted. It also
  depends on `adb`, which a device cloud may not expose.
- **One login per spec file.** Held in reserve. Not built until login cost is measured as a problem.
