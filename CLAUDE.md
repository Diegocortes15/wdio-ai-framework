# CLAUDE.md — Always-loaded rules

Loaded into every Claude Code session in this repository. Keep it under 150 lines.

**This file holds operating rules, not judgment.** QA judgment lives inside `.claude/skills/*/references/`,
because a skill directory travels to the next repository and this file does not (ADR-0019): a line that
explains _why_ a test is written a certain way belongs in a skill reference.

## Project purpose

Mobile port (WebdriverIO + Appium) of `Diegocortes15/playwright-ai-framework`. SUT: `my-demo-app-android`
2.2.0 and `my-demo-app-ios` 2.2.2, both in `apps/`, neither committed.

The repository tests one thesis: the AI layer (skills + governance) ports to a different platform, measured
as **how many skill lines had to change** (Phase 1 baseline: 0). Context and closed decisions:
`docs/PORT-BRIEF.md` — read it before proposing anything structural.

**Everything written to the repository is English** — code, comments, commits, docs, test titles, lint messages — whatever language the conversation is in.

## Quick run

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="$(/usr/libexec/java_home)"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

npm run emulator     # boots the AVD and disables the Google apps that ANR over the SUT
npm run simulator    # boots the iOS simulator the iOS config targets
npm test             # both platforms, in sequence — the gate before a PR
npm run test:android # one platform, the fast loop (also test:ios); -- --suite cart runs one feature
npm run test:smoke   # tests whose title ends in @smoke, on both platforms
npm run test:unit    # unit tests of the Qase sync (no device)
npm run typecheck && npm run lint && npm run format:check
```

Device and version come from the environment (`ANDROID_DEVICE`, `IOS_DEVICE`, `IOS_VERSION`, …) with this
machine's values as defaults — a client's CI has neither our AVD nor our simulator (ADR-0044). Binaries
live in `node_modules/.bin`: run them through `npm run` or `npx`, never bare. Start Appium only through
the WDIO service or from the project root — Appium 3 resolves drivers against the working directory.

## Inspecting the live app

The `wdio-mcp` MCP server (`@wdio/mcp`, pinned, in `.mcp.json`) drives the app for selector discovery over its
own Appium: `npm run appium:explore` (127.0.0.1:4725; the test run uses 4723). Running the suite kills an
open exploration session. How to use it: `wdio-conventions.md`.

## Where things live

| What                                  | Where                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Page Objects, Components, Specs       | `src/pages/` (singletons), `src/components/`, `tests/<feature>/*.spec.ts`               |
| WDIO configs                          | `config/wdio.shared.conf.ts` + one per platform + `capabilities/`                       |
| Platform helpers, platform data       | `byPlatform`/`onlyOn` in `src/utils/platform.ts`, `itOn` in `platform-only.ts`; `data/` |
| App reset before each test            | `src/hooks/reset-app.ts` (Mocha root hook)                                              |
| Expected failure (ADR-0024)           | `itFails` in `src/utils/expected-failure.ts`                                            |
| Named steps (`test.step`)             | `step` in `src/utils/step.ts`; run records in `test-results/steps/`                     |
| Qase catalogue sync                   | `src/tcms/`, `.tcms/records/` (ADR-0041, ADR-0043)                                      |
| Apps, Appium server log               | `apps/`, `logs/` — both gitignored                                                      |
| Skills; what broke here + the numbers | `.claude/skills/<name>/`; `docs/failure-modes.md`                                       |

There is **no fixture layer**: tests import Page Objects directly and use the WDIO globals (`$`, `driver`,
`expect`). `@data/*`, `@pages/*`, `@components/*`, `@utils/*` map to `data/`, `src/…` (`tsconfig.json`).

## Composition rules (must follow)

1. A Component knows Locators and, at most, child Components. Never Pages, never its parent.
2. A Page composes Components and holds page-unique locators. Never composes other Pages.
3. **Pages never return other Pages.** Methods return `void` or data. Navigation lives in the spec.
4. Tests know Pages and Data only — never a raw locator, never a Component imported into a spec. Through the Page that composes it (`CartPage.navigation.cartBadge`) is fine.
5. Locator and component fields are `readonly` (or getters), set once.
6. Constructor order: composed Components first, page-direct locators second.
7. Action methods read like English: `LoginPage.loginAs(user, password)`.
8. Queries return data, never an element.
9. A Component scoped to one of many similar elements takes a discriminator.
10. Refactor a page-direct locator into a Component the moment a second page needs it.
11. Component nesting depth ≤ 2.
12. A locator, flow or datum that differs between platforms is a `byPlatform({android, ios})` map, never an `if`: the map's type makes a missing platform a compile error (ADR-0044).

## Selectors

Order: `~accessibility id` → `id=` → `UiSelector` / predicate string → class chain. **Only XPath is a build gate**. `$()` returns the first match silently — count matches first (`wdio-conventions.md`).

## Session strategy

**Every test starts from a fresh app process** (ADR-0040): the root hook relaunches the app, so each test
begins on the catalog, logged out, with an empty cart — measured on both platforms. A test that needs a
session logs in through `LoginPage` itself. Never share state between tests, nor assume test order.

## Tag conventions

`@smoke` is the only tag anyone writes, at the **end of the test title** — Mocha has no tag option and
`npm run test:smoke` greps titles. No routing tags. `@android` / `@ios` are never written by hand:
`itOn(platform, reason, …)` appends them, and its reason is required (ADR-0044).

## Recording what we learn

When something breaks, a workflow needs correcting, or a measurement contradicts a doc, the **same change**
adds it to `docs/failure-modes.md`: what broke, how it surfaced, what catches it now. **Do it without being
asked.** A lesson that changes how work is done also goes into the skill, into lint or CI, or here — a
lesson with a gate beats a lesson in prose.

## Custom skills

`/refine-ticket`, `/from-issue`, `/scaffold-page-object`, `/report-bug` — copied from the web repository,
then adapted where they broke; `/report-bug` still assumes Playwright. **Every line changed in a skill is
the cost the thesis measures**: change one on purpose, and say so in the PR body.

**A skill directory is the portability boundary** (ADR-0019). No markdown link inside a skill may resolve
outside it: cite ADRs as plain text, paths as backticked prose, a sibling skill by name. Check before
handing off with `grep -rn "](\.\./\|](/\|](docs/\|](src/\|](tests/\|](data/" .claude/skills/` —
no output means clean.

## GitHub + Jira

- Tickets come from **Jira** through the Atlassian MCP — project **`OR`**. `gh` CLI for GitHub; no GitHub
  MCP server (ADR-0007, scoped by ADR-0011).
- **PR titles follow Conventional Commits.** The repository squash-merges, so the title becomes the commit.
- **CI never runs the suite** — no device yet. Two deviceless jobs: PR checks (`npm ci`, typecheck, lint,
  format, unit tests) and the Qase sync when records change on `main` (ADR-0041). Run the affected specs
  locally, green on both platforms, before opening a PR — nothing else will.
- **Commit only when asked.**

## ADRs

- Mobile records live in `docs/adr/`; the inherited ones skills cite as plain text (ADR-0001, 0019, 0020,
  0022, 0030…) live in the web repository. Inherited numbers are kept, mobile records start at **0040**:
  renumbering would silently repoint citations nothing validates.
- Append-only: never edit an accepted record, supersede it. Every record declares **`Enforced by:`** —
  the lint rule, test or script that makes it true, or `Nothing — prose only`.

## What to NEVER do

- Use XPath — lint fails the build.
- Sleep for a fixed time. `browser.pause()` fails lint; a hand-rolled `setTimeout` does not and is banned
  all the same. Splash and screen timing vary: poll (`waitForDisplayed`, `waitUntil`, `expect-webdriverio`).
- Make a Page method return another Page, or import a Page from another Page.
- Branch by platform inside a spec (`driver.isAndroid`, `byPlatform`) — lint fails it. The difference
  belongs in the Page Object, the data, or `itOn`: only the runner and the object model know the platform.
- **Open a red PR** (ADR-0020). On failure, diagnose and retry up to 3 times; if it still fails, or the
  app contradicts an acceptance criterion, report and open nothing.
- **Act on a finding instead of reporting it** (ADR-0030). A failing test, an unmet AC, a behaviour the
  docs claim and the app lacks: diagnose, show the readings that survive with evidence, and stop.
- Omit `Obstacles encountered` from a skill report (ADR-0022) — it renders `None.` when empty.
- Publish the Appium server log or a screen recording to an unauthenticated host. The log carries session
  tokens, so it inherits the confidentiality of the app under test.
- Copy saucedemo specifics from the web repository (users, tags, selectors, Page Objects): carry the
  rationale, decide the rest here.
- Assume a device failure is the app's or the test's. A system dialog on top hides the whole tree of the
  app under test and reads as "element not found" (`docs/PORT-BRIEF.md` §6, obstacle 5).
