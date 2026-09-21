# wdio-ai-automation-framework-mydemoapp

Mobile port (WebdriverIO + Appium) of the ticket→test→PR pipeline. SUT:
[`saucelabs/my-demo-app-android`](https://github.com/saucelabs/my-demo-app-android) 2.2.0.

**The thesis this repo tests:** the value of the sibling Playwright repo is not
Playwright, it is the AI layer — the QA judgment in `.claude/skills/*/references/`
and the governance rules. If 2-3 tickets come through clean here, it holds.

## Phase 1 baseline (2026-09-18)

The skills were copied **verbatim**, not one line changed. That is the starting
point the port is measured against:

|                             |                                                                            |
| --------------------------- | -------------------------------------------------------------------------- |
| Skill lines ported          | 3338                                                                       |
| Lines changed               | **0**                                                                      |
| Portability grep (ADR-0019) | clean                                                                      |
| Known debt                  | 5 rules stated only by reference to a `CLAUDE.md` that does not exist here |

`playwright-cli` was **not** ported: it is Playwright-specific. `@wdio/mcp` replaces it.

## Running

```bash
npm run emulator     # boots the AVD (~8 s) + preflight for apps that ANR
npm test             # wdio run ./wdio.android.conf.ts
npm run typecheck
npm run lint
```

Requires `ANDROID_HOME`, `JAVA_HOME` and `platform-tools` on the PATH.

## Selectors

Preference order, with the measured cost behind it (API 35, Apple Silicon):

| Level | Strategy                                         | Median   |
| ----- | ------------------------------------------------ | -------- |
| 1     | `~accessibility id` (content-desc)               | 10 ms    |
| 2     | `id=` (resource-id)                              | 9 ms     |
| 3     | `-android uiautomator` / `-ios predicate string` | 13 ms    |
| 4     | `-ios class chain`                               | —        |
| —     | **XPath: forbidden, fails the build**            | 26-28 ms |

Across the 4 screens of the SUT: 55 clickables, 27 ambiguous, **0 that require
XPath**. The hard case — tapping one product image among six identical ones,
discriminated by the sibling title — is resolved by `UiSelector().fromParent()`
with 1 match.

Note: WebdriverIO's `$()` returns the **first** match silently where Playwright
throws a strict-mode violation. Counting matches matters more here, not less.

## Language

Everything in this repository is written in English — code, comments, commit
messages, docs and test titles.
