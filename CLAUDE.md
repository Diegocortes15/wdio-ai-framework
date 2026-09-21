# CLAUDE.md — Always-loaded rules

Loaded into every Claude Code session in this repository. Keep it under 150 lines.

**This file holds operating rules, not judgment.** QA judgment lives inside `.claude/skills/*/references/`,
because a skill directory is what travels to the next repository and this file is not (ADR-0019). If a
line here starts to explain _why_ a test should be written a certain way, it belongs in a skill reference.

## Project purpose

Mobile port (WebdriverIO + Appium) of `Diegocortes15/playwright-ai-framework`. SUT:
`saucelabs/my-demo-app-android` 2.2.0 (`apps/mda-2.2.0-25.apk`, not committed).

The repository tests one thesis: the AI layer (skills + governance) ports to a different platform. The
measurement is **how many skill lines had to change** — the Phase 1 baseline is 0. Context, measurements
and decisions already closed: `docs/PORT-BRIEF.md`. Read it before proposing anything structural.

**Everything written to the repository is English** — code, comments, commits, docs, test titles, lint
messages — whatever language the conversation is in.

## Quick run

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="$(/usr/libexec/java_home)"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

npm run emulator     # boots the AVD and disables the Google apps that ANR over the SUT
npm test             # the whole suite
npm run test:smoke   # tests whose title ends in @smoke
npm run test:unit    # unit tests of the Qase sync (no device)
npm run typecheck && npm run lint && npm run format:check
```

Binaries live in `node_modules/.bin`: invoke them through `npm run` or `npx`, never bare. Start Appium only through the WDIO service or from the project root — Appium 3 resolves drivers against
the `package.json` of the working directory.

## Inspecting the live app

The `wdio-mcp` MCP server (`@wdio/mcp`, pinned, in `.mcp.json`) drives the app for selector discovery. It needs
its own Appium: `npm run appium:explore` (127.0.0.1:4725; the test run's Appium uses 4723). Running the suite
kills an open exploration session — start a new one after. How to use it: `wdio-conventions.md`.

## Where things live

| What                        | Where                                                               |
| --------------------------- | ------------------------------------------------------------------- |
| Page Objects                | `src/pages/` — exported as singletons                               |
| Components                  | `src/components/`                                                   |
| Specs                       | `tests/<feature>/*.spec.ts`                                         |
| Test data                   | `data/` — inline in the spec is the default                         |
| WDIO config (Android)       | `wdio.android.conf.ts`                                              |
| App reset before each test  | `src/hooks/reset-app.ts` (Mocha root hook)                          |
| Expected failure (ADR-0024) | `itFails` in `src/utils/expected-failure.ts`                        |
| Named steps (`test.step`)   | `step` in `src/utils/step.ts`; run records in `test-results/steps/` |
| Qase catalogue sync         | `src/tcms/`, `.tcms/records/`, `qase-map.json` (ADR-0041)           |
| App under test (the APK)    | `apps/` — gitignored                                                |
| Appium server log           | `logs/` — gitignored                                                |
| Skills                      | `.claude/skills/<name>/`                                            |

There is **no fixture layer**: tests import Page Objects directly (`import LoginPage from '@pages/LoginPage'`)
and use the WDIO globals (`$`, `driver`, `expect`). Aliases `@data/*`, `@pages/*`, `@components/*`,
`@utils/*` map to `data/`, `src/pages/`, `src/components/`, `src/utils/` (`tsconfig.json`).

## Composition rules (must follow)

1. A Component knows Locators and, at most, child Components. Never Pages, never its parent.
2. A Page composes Components and holds page-unique locators. Never composes other Pages.
3. **Pages never return other Pages.** Methods return `void` or data. Navigation lives in the spec.
4. Tests know Pages and Data only — never raw locators or Components. Convention, not a technical barrier.
5. Locator and component fields are `readonly` (or getters), set once.
6. Constructor order: composed Components first, page-direct locators second.
7. Action methods read like English: `LoginPage.loginAs(user, password)`.
8. Queries return data, never an element.
9. A Component scoped to one of many similar elements takes a discriminator.
10. Refactor a page-direct locator into a Component the moment a second page needs it.
11. Component nesting depth ≤ 2.
12. No fixed sleeps — see "What to NEVER do".

## Selectors

Order: `~accessibility id` → `id=` → `UiSelector` / predicate string → class chain. **Only XPath is a build
gate**. `$()` returns the first match silently — count matches first (`wdio-conventions.md`).

## Session strategy

**Every test starts from a fresh app process** (ADR-0040): the root hook terminates and relaunches the
app, so each test begins on the catalog, logged out, with an empty cart. A test that needs a session logs
in through `LoginPage` as its own setup. Never share state between tests, and never assume test order.

## Tag conventions

`@smoke` is the only tag. Mocha has no tag option, so it goes at the **end of the test title** —
`npm run test:smoke` greps titles. The web repository's **routing** tags
(`@no-auth`, one tag per user) chose which pre-authenticated project ran a test; here every test starts
logged out and logs in itself, so there is nothing to route. Do not add routing tags.

## Custom skills

`/refine-ticket`, `/from-issue`, `/scaffold-page-object`, `/report-bug` — copied verbatim from the web
repository, then adapted where they broke. `/from-issue` and `/refine-ticket` are adapted;
`/scaffold-page-object` and `/report-bug` still assume Playwright. **Every line changed in a skill is the
cost the thesis measures**: change one only on purpose, and say so in the PR body.

**A skill directory is the portability boundary** (ADR-0019). No markdown link inside a skill may resolve
outside it: cite ADRs as plain text, write repository paths as backticked prose, reference a sibling skill
by name. Check before handing off — no output means clean:

```bash
grep -rn "](\.\./\|](/\|](docs/\|](src/\|](tests/\|](data/" .claude/skills/
```

## GitHub + Jira

- Tickets come from **Jira** through the Atlassian MCP — project **`OR`**. `gh` CLI for GitHub; no GitHub
  MCP server (ADR-0007, scoped by ADR-0011).
- **PR titles follow Conventional Commits.** The repository squash-merges, so the title becomes the commit.
- **CI never runs the suite** — no device yet. Two jobs, both deviceless: PR checks (`npm ci`, typecheck, lint,
  format, unit tests) and the Qase catalogue sync when records change on `main` (ADR-0041). Run the affected
  specs locally, green, before opening a PR — nothing else will. A PR is opened only on a green local run.
- **Commit only when asked.**

## ADRs

- Mobile records live in `docs/adr/`. The inherited ones the skills cite as plain text (ADR-0001, 0019,
  0020, 0022, 0030…) live in the web repository under `docs/adr/`.
- Inherited decisions keep their inherited numbers. New mobile decisions start at **0040**. Never
  renumber: nothing validates the citations, so renumbering repoints them silently.
- Append-only: never edit an accepted record, supersede it. Every record declares **`Enforced by:`** —
  the lint rule, test or script that makes it true, or `Nothing — prose only`.

## What to NEVER do

- Use XPath — lint fails the build.
- Sleep for a fixed time. `browser.pause()` fails lint; a hand-rolled `setTimeout` does not, and is
  banned all the same. The app's splash and header timing vary between runs: poll for the element
  (`waitForDisplayed`, `waitUntil`, `expect-webdriverio`).
- Make a Page method return another Page, or import a Page from another Page.
- **Open a red PR** (ADR-0020). On failure, diagnose and retry up to 3 times; if it still fails, or the
  app contradicts an acceptance criterion, report and open nothing.
- **Act on a finding instead of reporting it** (ADR-0030). A failing test, an unmet AC, a behaviour the
  docs claim and the app lacks: diagnose, show the readings that survive with evidence, and stop.
- Omit `Obstacles encountered` from a skill report (ADR-0022) — it renders `None.` when empty.
- Publish the Appium server log or a screen recording to an unauthenticated host. The log carries session
  tokens, so it inherits the confidentiality of the app under test.
- Copy saucedemo specifics from the web repository — users, tags, selectors, Page Objects. Carry the
  rationale, decide the rest here.
- Assume an emulator failure is the app's or the test's. A system dialog on top hides the whole tree of
  the app under test and reads as "element not found" (`docs/PORT-BRIEF.md` §6, obstacle 5).
