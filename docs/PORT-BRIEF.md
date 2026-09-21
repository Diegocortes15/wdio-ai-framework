# Port brief — read this before doing anything

This repository is the **mobile port** (WebdriverIO + Appium) of
[`Diegocortes15/playwright-ai-framework`](https://github.com/Diegocortes15/playwright-ai-framework),
a Playwright + TypeScript framework for saucedemo.

This file exists so the port does not re-solve problems the web repo already
solved, and does not re-derive facts that were already measured. **Everything
below marked "measured" was executed, not estimated.** Dates are given because
some of it will go stale.

---

## 1. The thesis being tested

The value of the web repo is **not Playwright**. It is the AI layer:

- the QA judgment in `.claude/skills/*/references/`
- the governance rules: no-red-PR, human triage, mandatory `Obstacles encountered`,
  ADRs that declare `Enforced by:`

If 2-3 tickets come through this repo end-to-end and clean, the thesis holds.
If they do not, the answer wanted is **why**, not a workaround.

The measurement that answers it: **how many lines of the skills had to change.**
Phase 1 established the baseline at **0**. Every later change is the cost.

---

## 2. Decisions already closed — do not reopen

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | **SUT: `saucelabs/my-demo-app-android` 2.2.0** (`mda-2.2.0-25.apk`) | Same vendor as saucedemo, so the comparison is clean. Self-contained APK. No release since 2024-11-14, which for a SUT is stability, not staleness |
| 2 | **Android first, iOS second** | Not because iOS is expensive — Xcode 16.2 and the iOS 17.5 runtime are already installed. Because the APK is one file, the AVD already exists, and content-desc coverage lets the first tickets test the AI layer instead of selector archaeology. iOS is where the XPath question gets its real evidence |
| 3 | **Separate repo, not a monorepo** | Sharing a folder would keep the web `CLAUDE.md` in context and contaminate the portability experiment |
| 4 | **XPath stays a build-breaking `error`** | See §5. The premise that mobile forces XPath was measured false |

**Web + mobile in one WDIO framework was considered and rejected.** Measured: the
same `LoginPage` written for both differs in 13 of 36 lines — and the shared 23
are method signatures and bodies, while the differing 13 are the locators and
navigation, i.e. exactly where maintenance lives. The two SUTs share **zero** test
data (`standard_user` vs `bod@example.com`). Share the *criteria*
(`.claude/skills/`), not the code.

---

## 3. Where things stand

**Phase 1 is done.** Typecheck, lint and the one hand-written test are green.

```
Skill lines ported      3338
Lines changed           0        (verified byte-for-byte with diff -rq)
ADR-0019 grep           clean
Known debt              5 rules stated only by reference to a CLAUDE.md that does not exist here
```

`playwright-cli` was deliberately **not** ported — it is Playwright-specific.
`@wdio/mcp` (v3.13.0, depends on `webdriverio ^9.27`, no version conflict with
`@wdio/cli` 9.31) replaces it for live app exploration.

What exists: `wdio.android.conf.ts`, `src/components/Header.ts`,
`src/pages/LoginPage.ts`, `src/pages/CatalogPage.ts`, `tests/login/login.spec.ts`,
`eslint.config.js` with two validated gates, `scripts/start-emulator.sh`.

**Jira is set up.** Project **`OR` — ORGRIMMAR** (software, next-gen), the Horde
counterpart to the web project's `SW` — STORMWIND. Three tickets are written:

| Ticket | Subject | Exercises |
| --- | --- | --- |
| **OR-1** | A shopper signs in from the menu and returns to the catalog | The session redesign — mobile has no `storageState` |
| **OR-2** | Adding a product updates the cart badge and the cart contents | Page Object composition, and the one genuinely hard locator |
| **OR-3** | A cart that already holds products survives leaving and returning | The direct analogue of SW-21 — same requirement, different platform |

---

## 4. Environment — measured 2026-09-18

Already installed on this machine, nothing to add:

- Android SDK at `~/Library/Android/sdk`, AVD **`Medium_Phone_API_35`**,
  system image `android-35/google_apis_playstore/arm64-v8a`
- Xcode 16.2, iOS 17.5 runtime, iPhone 15 simulators
- JDK 11 — the UiAutomator2 driver needs Java 9+ for SDK 30+, so this is fine

Needed in the shell (not set by default on this machine):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="$(/usr/libexec/java_home)"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

`cmdline-tools` (`sdkmanager`, `avdmanager`) is **absent and not needed** — it is
only required to install more system images.

Timings: emulator cold boot to `boot_completed` **~8 s**; app splash
(`SplashActivity` → `MainActivity`) **~3.2 s**; the full green test run **~7 s**.
The earlier assumption of a 30 s–2 min emulator boot was wrong; boot is not the
bottleneck in the fix loop.

---

## 5. Selectors — the measured order

Benchmarked on API 35 / Apple Silicon, **n=12 interleaved rounds** (a blocked run
inflated XPath by ~60%, so interleave — the ranking held but the magnitude did not):

| Level | Strategy | Median |
| --- | --- | --- |
| 1 | `~accessibility id` (content-desc / accessibilityIdentifier) | 10 ms |
| 2 | `id=` (resource-id) | 9 ms |
| 3 | `-android uiautomator` (`UiSelector`) / `-ios predicate string` | 13 ms |
| 4 | `-ios class chain` | — |
| — | **XPath — forbidden, fails the build** | 26-28 ms |

Across the 4 screens the first tickets touch: **55 clickables, 27 ambiguous,
0 that require XPath.**

| Screen | Clickables | Ambiguous |
| --- | --- | --- |
| Catalog | 29 | 26 (20 are rating stars ×4 cards, 6 are product images) |
| Login | 8 | 0 |
| Product detail | 11 | 1 |
| Cart | 7 | 0 |

**The hard case is solved without XPath.** Tapping one product image among six
identical ones, in a card that has no resource-id and no content-desc of its own,
discriminated by the sibling title:

```ts
$(`android=new UiSelector().text("${name}").fromParent(new UiSelector().resourceId("${PKG}/productIV"))`)
// 1 match, 26 ms — verified, and it navigates
```

Appium's own docs name sibling navigation as XPath's legitimate niche. On Android,
`UiSelector().fromParent()` covers it and is faster.

**Two traps, both measured:**

1. `$()` in WebdriverIO returns the **first** match silently where Playwright throws
   a strict-mode violation. Counting matches matters more here, not less.
2. The XPath a person would naturally write for that card —
   `//ViewGroup[.//TextView[@text="…"]]//ImageView` — returns **6 matches** and
   nothing warns you. Slower *and* easier to get silently wrong.

**On iOS** (phase 4): `accessibilityIdentifier` appears **0 times** in
`saucelabs/my-demo-app-ios` source. The search index was validated before trusting
that zero (`import`=43, `UIKit`=31, `SwiftUI`=0 — it is UIKit + storyboards). This
does **not** force XPath: `-ios predicate string` matches on `label`, `value`,
`name` and `type` without any identifier, in the fastest tier, and `-ios class
chain` covers hierarchy. Per Appium docs XPath is up to **10x** slower on XCUITest.

Caveat: the iOS figure is source-code search, not a runtime accessibility tree.
Confirm with a page source dump before deciding anything for iOS.

---

## 6. Obstacles already solved — do not re-solve these

| # | Symptom | Cause | Fix (already applied) |
| --- | --- | --- | --- |
| 1 | `npm i -g appium` fails EACCES | node lives in `/usr/local`, global installs need root | Install Appium **local** to the project. The port needs that anyway |
| 2 | `Could not find a driver for automationName 'UiAutomator2'` with the driver correctly installed | **Appium 3 resolves drivers against the `package.json` of the working directory**, not `~/.appium` | Start the server from the project root. `@wdio/appium-service` does this; `APPIUM_HOME` is pinned in the script |
| 3 | `TS2353: 'capabilities' does not exist in type 'Testrunner'` | WDIO 9 changed the config type | Use `WebdriverIO.Config`, not `Options.Testrunner` |
| 4 | `$$(...)` then `.map()` does not typecheck | `$$` returns a `ChainablePromiseArray`, not an array | Use the chainable's own `.map()`: `$$(sel).map(e => e.getText())` |
| 5 | Test fails on `~View menu` after a full 10 s auto-wait; page source is 7928 bytes with **zero** content-desc | A **system dialog** (`package="android"`) was covering the app: *"Messages isn't responding"*. The `google_apis_playstore` image ships Google apps that ANR and steal the foreground | `scripts/start-emulator.sh` disables `messaging`, `maps` and `photos` as a preflight |

Obstacle 5 is the lesson of Phase 1: the failure was neither the app nor the test,
and the accessibility tree does not tell you "a dialog is on top" — it tells you
your element does not exist. The emulator is a shared device; web rarely is.

---

## 7. What ports, what adapts, what must be invented

Measured density of Playwright-specific mentions per file (excluding the vendored
`playwright-cli`, which was not ported). Total 3338 lines.

**Ports as-is (~1900 lines)** — this is the thesis:
`refine-ticket/workflow.md` 0/85 · `writeback-template.md` 0/108 · `rubric.md` 1/81 ·
`sources.md` 2/34 · all of `report-bug` (3/46, 5/104, 3/108) · `qa-analysis.md` 3/169 ·
`bucket-classification.md` 4/93 · `smoke-policy.md` 2/84 · `fix-loop.md` 2/79 ·
`tcms-sync.md` 4/96

**Needs rewriting (~1400 lines):**
`playwright-conventions.md` 90/509 → `wdio-conventions.md` ·
`scaffold-page-object/workflow.md` 47/281 (DOM snapshot → Appium page source XML) ·
`test-template.md` 34/162 · `page-object-template.md` 25/110 ·
`test-principles.md` 25/122 · `from-issue/workflow.md` 33/535

**Does not exist in mobile — must be invented:**

1. **`storageState` has no analogue.** Measured: nothing survives process death
   (§8). It is login-per-test, or keeping the process alive between tests.
2. **`test.step` does not exist in WDIO.** This is the blocking one.
   `report-bug` is the most portable skill by density — and its *input* is the
   `test.step` titles that Page Objects wrap actions in. Without an equivalent
   helper the skill ports and does not work. Build the helper before porting it.
3. **Playwright traces.** No analogue. Closest: screen recording + the Appium
   server log + page source dumps. The confidentiality rule carries over — the
   Appium log contains session tokens, so it inherits the SUT's confidentiality.
4. **The `waitForTimeout` gate** → ban `browser.pause()` instead. Already written
   and validated in `eslint.config.js`.
5. **Tag routing via Playwright projects + `grep`.** The per-user project matrix
   collapses; WDIO has suites plus mocha grep. Needs a redesign, not a translation.

---

## 8. App behaviour — measured

`my-demo-app-android` keeps state **in memory only**.

**Session and cart lifetime** (2026-09-18, re-checked 2026-09-21):

| Event | Cart | Session |
| --- | --- | --- |
| app backgrounded 3 s, then resumed | **survives** | survives |
| process terminated and relaunched | **empty** | logged out |

**Cart badge** (`cartTV`), 2026-09-21:

| State | Badge |
| --- | --- |
| cart empty | **absent from the view tree** — not zero |
| 1 unit added | `"1"` |
| 2 units of one product | `"2"`, and the cart shows one row with a total of "2 Items" |

The badge and the total count **units**, not distinct products. The absent-not-zero
behaviour matches the web app, and SW-21 makes the same note.

**Credentials**, read off the login screen: `bod@example.com` / `10203040` (it is
"bod", not "bob"), `alice@example.com` (locked out), `visual@example.com`.

**Login validation** (2026-09-21, each case from a freshly restarted app):

| Input | Result |
| --- | --- |
| `bod@example.com` + `10203040` | enters the catalog |
| empty username | stays, "Username is required" |
| empty password | stays, "Enter Password" |
| `alice@example.com` + `10203040` | stays, "Sorry this user has been locked out." |
| `bod@example.com` + `xxxxxxxx` | **enters the catalog** |
| `bod@example.com` + `1` | **enters the catalog** |
| `nadie@example.com` + `10203040` | **enters the catalog** |

**The app validates neither the username nor the password against any list** — it
checks both fields are non-empty and special-cases the locked-out user. This is
recorded as an open question in OR-1, not as an acceptance criterion. **Do not
write a "wrong password is rejected" test**: it would fail, and by ADR-0020
nothing would be opened, so the finding would be lost rather than recorded.

**Timing:** after `activate_app` the header takes up to ~4 s to render and the
delay is **not stable between runs**. Poll for the element. Fixed sleeps flaked
repeatedly while these measurements were being taken — which is the same rule the
framework already enforces against `browser.pause()`.

## 9. Rules inherited from the web repo

**These did not travel.** They lived in the web repo's `CLAUDE.md`, which is not
in this repository. Writing this repo's own `CLAUDE.md` is the first task of
Phase 2 — and it is the whole lesson of the port: *a rule that is not inside the
skill directory does not exist for the next repo.*

**Composition rules** (from ADR-0001, all still apply except where noted):

1. A Component knows Locators and, at most, child Components. Never Pages, never its parent.
2. A Page composes Components and holds page-unique locators. Never composes other Pages.
3. **Pages never return other Pages.** Methods return `void` or data. Navigation lives in the spec.
4. Tests know Pages and Data only. Never raw locators or Components.
   *Adapted:* without Playwright fixtures this is convention + lint, not a technical barrier.
5. All locator/component fields are `readonly`, set in the constructor.
6. Constructor order: composed Components first, page-direct locators second.
7. Action methods read like English.
8. Queries return data, never a locator.
9. A Component scoped to one of many similar elements takes a discriminator.
10. Refactor a page-direct locator into a Component the moment a 2nd page needs it.
11. Component nesting depth ≤ 2.
12. No arbitrary sleeps. *Adapted:* `browser.pause()` instead of `page.waitForTimeout()`.

*Adaptation:* Page Objects are exported as **singletons** (`export default new LoginPage()`),
because there are no fixtures to inject them.

**Governance — all of this ports unchanged:**

- **Never open a red PR** (ADR-0020). On a typecheck or test failure, diagnose and
  retry up to 3 times; if it still fails, or if the app contradicts an AC, report
  and open nothing.
- **Triage is a human decision** (ADR-0030). A failing test, an unmet AC, a
  behaviour the docs claim and the app lacks — diagnose fully, show the readings
  that survive, and stop. Never act on a finding instead of reporting it.
- **`Obstacles encountered` is mandatory** (ADR-0022) and renders even when empty
  (`None.`). Selector downgrades, tooling friction and gaps in a skill's own
  `references/` go there.
- **ADRs are append-only.** Never edit an accepted record; supersede it. Every
  record declares **`Enforced by:`** — the lint rule, test or script that makes it
  true, or `Nothing — prose only`. ADR-0005 stated a rule with no gate, the code
  was reverted three months later, and the record sat `Accepted` the whole time.
- **A skill directory is the portability boundary** (ADR-0019). No markdown link
  inside a skill may resolve outside it. Cite ADRs as plain text, write repo paths
  as backticked prose, reference a sibling skill by name. Validate with:
  ```bash
  grep -rn "](\.\./\|](/\|](docs/\|](src/\|](tests/\|](data/" .claude/skills/
  ```
  No output means clean.
- **Conventional Commits** for PR titles — the repo squash-merges, so the PR title
  becomes the permanent commit.
- **`gh` CLI for GitHub, Atlassian MCP for Jira.** No GitHub MCP server
  (ADR-0007, scoped by ADR-0011). `.mcp.json` needs the Atlassian entry:
  ```json
  { "mcpServers": { "atlassian": { "type": "http", "url": "https://mcp.atlassian.com/v1/mcp/authv2" } } }
  ```

**ADR numbering — important.** The skills cite **20 distinct ADR numbers in plain
text**, 14 of them `ADR-0020` alone. Nothing validates those citations. So this
repo **keeps the inherited numbers** for the decisions it inherits (0001 POM,
0019 portability, 0020 no-red-PR, 0022 obstacles, 0030 triage…) and opens new
mobile decisions from **0040**. Renumbering from 0001 would silently repoint
every citation.

**The 5 dangling references** to fix in Phase 2 — rules stated only by pointing at
a `CLAUDE.md` that does not exist here:

- `from-issue/references/test-template.md` lines 79, 108, 114 (fixture import, tag
  table, `waitForTimeout`)
- `from-issue/references/workflow.md` line 226 (tag selection)
- `refine-ticket/references/sources.md` line 15

Seven other mentions are self-aware — they state the rule locally and cite
`CLAUDE.md` only as "the repository-side copy". Those are fine.

---

## 10. How Diego wants this work done

- **Measure before asserting, and cite the source.** If you do not know, say so.
  Executing beats reasoning about the code.
- **Validate a grep before trusting it.** A pattern that returns nothing may be
  broken rather than the tree being clean. Run it against a known-positive first.
- **Interleave benchmarks, never block them.** Block ordering has inverted a
  timing result here before.
- **A failing test is not yours to classify.** Report the readings — app bug,
  ticket wrong, or our own automation — with the evidence, and stop. Diego decides.
- **Say when something is not worth doing.**
- **Everything in the repository is English** — code, comments, commit messages,
  docs, test titles, lint messages. The conversation with Diego is in Spanish.
  The failure mode is contagion: dragging the chat's language into the files.
- **Lessons go inside the skill directory**, which is the portability boundary.
  A lesson written into `CLAUDE.md` does not travel. That is the mother lesson of
  this whole port.
- **Commit only when asked.**

---

## 11. Next steps, in order

**Phase 2 — adapt (not started):**

1. Write this repo's `CLAUDE.md` from §9. Nothing else can be checked until the
   rules are written down somewhere in this repo.
2. Build the `step` helper. `report-bug` is blocked on it.
3. Close the 5 dangling `CLAUDE.md` references.
4. Rewrite `playwright-conventions.md` → `wdio-conventions.md`. Best done with a
   real ticket in view rather than in the abstract.
5. Adapt `scaffold-page-object` to Appium page source XML.
6. Redesign tag routing (no Playwright projects).
7. Write the mobile ADRs from 0040.

**Phase 3 — the three tickets**, one at a time, measuring the fix-loop cost of each.

**Phase 4 — verdict**, then iOS as the second probe, where the XPath decision gets
its real evidence.

**Success is not "3 green PRs".** It is: how many lines of the QA-judgment layer
had to change, and whether `/refine-ticket` and `/report-bug` — the two the
measurement says are almost pure judgment — worked without being rewritten.

---

## 12. Still open

- **The first two tickets' implementation.** OR-1, OR-2 and OR-3 exist in Jira and
  are written to the house standard (Context / Measured before writing /
  Acceptance criteria / Notes / Out of scope), but no test has been generated from
  any of them yet. That is Phase 3.
- **Two findings are parked in tickets, waiting on a human**, per ADR-0030:
  the credential validation in OR-1, and cart loss on process death in OR-3.
  Neither is an acceptance criterion. Neither is for the agent to settle.
