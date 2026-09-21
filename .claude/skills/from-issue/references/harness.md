# Harness — the session each test starts from

On the web this file described a data-driven Playwright project matrix: one pre-authenticated
project per user, grown on demand. **Mobile has no equivalent, and nothing to grow.**

## Why

A web session is a cookie or a token, so it can be captured once and injected into every test
(`storageState`). A mobile app's session lives in the app — in memory, or in its private storage —
and there is no supported way to hand a test a ready-made one. Measured on the reference app:
session and cart are held in memory only, and neither survives the process being killed.

## What this repository does instead

- **Every test starts from a fresh app process.** A Mocha root hook terminates and relaunches the
  app before each test (ADR-0040). The test begins on the launch screen, logged out, with nothing
  in memory.
- **A test that needs a signed-in user logs in as its first action**, through the login Page
  Object. That login is setup, not the subject, and it costs a few seconds of UI.
- **There are no routing tags.** Nothing routes a test to a user-specific project because none
  exist. `@smoke` is the only tag.

## When a ticket needs a user nobody has named

Use an account the ticket names or the login screen documents. If there is none, do not invent
credentials: record it as an assumption for the PR body, and let the reviewer supply one.

## When this stops being true

If the application gains a way to establish a session without the UI — a deep link that signs in,
a test-only activity, a backdoor — that is the equivalent of `storageState`, and this file and
ADR-0040 are where it gets decided.
