# PR Description Template

The `/from-issue` skill writes its PR body using this template. Section order is mandatory; reviewers expect to find each section in this position.

## Template

```markdown
## What I understood from the ticket

> Automated WebdriverIO + Appium coverage for `<KEY>` (`<feature>`): <N> tests, all passing.

**Source ticket:** [<KEY>](<jira-issue-url>) — <issue-type>: "<summary>"
**Feature:** <feature>
**Requirement (as written):** <restatement shaped by `requirement_form` — restate the narrative if present; summarize the GWT scenarios; paraphrase prose into intent>

**Acceptance Criteria (normalized):**
- AC 1: <normalized text>
- AC 2: <normalized text>
- ...

**⚠️ Assumptions & open questions:** <render this block ONLY when `assumptions[]` is non-empty; omit entirely otherwise>

- <each inference/ambiguity, one per bullet, inviting reviewer confirmation — e.g. "Ticket didn't name an account → used `bod@example.com`, the one the login screen documents. Reviewer: confirm.">

## AC coverage

| AC | Test | Bucket | Status |
|----|------|--------|--------|
| AC 1: <truncated text> | `<test title>` | Positive | ✅ generated |
| AC 2: <truncated text> | `<test title>` | Negative | ✅ generated |
| AC 3: <truncated text> | — | — | ⚠️ skipped: <LLM rationale> |

## Verification

- **Typecheck:** ✅ PASS
- **Test run:**
  - `<test title 1>` — ✅ PASS
  - `<test title 2>` — ✅ PASS
- 🗂️ **TCMS records:** `.tcms/records/<feature>.json` written + committed (Qase syncs at merge — see `tcms-sync.md`).

## Notes for reviewer

(omit this section entirely if no notes)

- ⚠️ **Side effect:** the workflow modified `<file>` to make the generated test runnable. Verify the change is reasonable.
- ⚠️ **Side effect (externalized data):** per [`data-placement.md`](data-placement.md), N `<feature>` scenario(s) were externalized to `data/scenarios/<feature>/` + a loader in `data/fixtures.ts` (reused/large/named-scenario data). Reviewer: verify the loader + payloads. _(Omit when data stayed inline — the default for small, test-local parameterization.)_
- 🔁 **Augment:** this PR **augmented** an existing spec `tests/<feature>/<feature>.spec.ts` (prior contributors: `<KEY-list>`) rather than creating a new file. AC-coverage rows below are marked `added` or `skipped (already covered)`.
- ➕ **Page Object additions:** appended `<members>` to `<PageObject>` for the new tests (existing members untouched).
- ⚠️ **Smoke overlap:** `<new test>` covers the same failure as `<existing test>`, which is currently `@smoke`. Nothing was changed on the existing test — see `smoke-policy.md`. Reviewer: consider whether the older one still earns the tag.
- ⚠️ **Page Object modification:** modified existing method `<Method>` on `<PageObject>`. Because other specs may call it, the verification scope widened to every spec the resolver maps to that file (see Verification). Reviewer: confirm no dependent spec regressed.
- ⏭️ **Skipped (duplicate):** AC <id> maps to a test already present (`<existing test>`); not re-added. Reviewer: push back if the existing test doesn't actually cover it.
- 🐞 **Expected failure:** `<test>` is locked to `<DEFECT-KEY>` with `itFails`, as the ticket records. First run as a plain test, it failed with `<one line: the failure seen>`, which matches the defect. Reviewer: confirm it is the defect's failure and not another one.
- _(Include only the augment notes that apply; omit this whole group for plain CREATE-NEW runs.)_
- 📝 **LLM judgment (MERGE):** AC X and AC Y were merged into one parameterized test because both share the same setup + flow with different inputs. Reviewer: push back if you want them split.
- 📝 **LLM judgment (SPLIT):** AC Z contained compound behaviors and was split into N tests. Reviewer: push back if you wanted one mega-test.
- 📝 **LLM judgment (SKIP):** AC W was skipped because <rationale per qa-analysis.md>. Reviewer: push back if you want it generated.

## Collision warnings

(omit this section entirely if no collisions)

- ⚠️ **Page Name collision** — `<PageName>` already exists at `<resolved-path>` (e.g., `src/pages/<PageName>.ts` or `src/pages/checkout/<PageName>.ts`). Reused the existing Page Object; did NOT call `/scaffold-page-object`. Reviewer: verify the existing Page Object exposes the methods this PR's tests rely on, or refile the ticket with a different Page Name.

## Obstacles encountered

(ALWAYS render this section — when there were none it is exactly: `None.`)

- 🎯 **Selector downgrade** — `<element>`: wanted `<preferred level>`, used `<actual level>` because `<reason>`. Reviewer: this one is a fallback, not a first choice.
- 🔧 **Tooling friction** — `<what failed>`; `<what you did instead>`.
- 📚 **Reference gap** — `<case the instructions didn't cover>`; improvised `<what you did>`. Should be covered by `references/<file>.md`.
```

## Rules

- **Section order is mandatory** — `What I understood` → `AC coverage` → `Verification` → `Notes for reviewer` (optional) → `Collision warnings` (optional) → `Obstacles encountered` (**never optional**). (No `## Source` footer — the `Source ticket:` line in "What I understood" already names + links the ticket.)
- **"What I understood" block** (adaptive, per ADR-0012):
  - **Summary** lead (`> `) — one TL;DR line: `Automated WebdriverIO + Appium coverage for <KEY> (<feature>): N tests, all passing.`
  - **`Source ticket:`** — mandatory: `[<KEY>](<jira-url>) — <issue-type>: "<summary>"`. This is the key the GitHub-for-Jira app matches in the PR body to link the PR onto the ticket — so no separate `## Source` footer is needed.
  - **`Source ticket:` for a `--from-file` run** — render it as `` `<KEY>` — from local file `<path>` (not a Jira ticket) ``, unlinked. Add one line at the top of the PR body: `> ⚠️ Generated from a local ticket file, not a Jira ticket. The GitHub-for-Jira link will not appear.` A reviewer must never have to work out why a plausible-looking key resolves to nothing.
  - **`Feature:`** — the snake_case feature.
  - **`Requirement (as written):`** — restate the requirement in whatever form the ticket used (`requirement_restated` from Step 4): the narrative if present, a scenario summary for GWT, a paraphrase for prose. Never assert a fixed structure.
  - **`⚠️ Assumptions & open questions:`** — render ONLY when Step 4's `assumptions[]` is non-empty; one bullet per inference/ambiguity, each inviting reviewer confirmation. Omit the whole block when the ticket was fully explicit.
  - There is no `Page Name` or `User Story` line — the Page Object is covered by the Notes-for-reviewer scaffold/collision note, and the requirement is conveyed by `Requirement (as written)`.
- **AC coverage table**:
  - Truncate long AC text to ≤80 chars; reviewers can click through to the ticket for full text.
  - "Test" column: backtick-wrapped test title for generated ACs, exactly as written in the spec (a smoke test's title ends in ` @smoke`); em-dash `—` for skipped. Prepend `⚡ ` INSIDE the backticks for smoke tests, e.g., `` `⚡ alice@example.com is rejected as locked out @smoke` ``. Non-smoke tests have no prefix.
  - "Bucket" column: exactly one of `Positive` / `Negative` / `Edge` for generated tests; em-dash `—` for skipped ACs. Classification follows [`bucket-classification.md`](bucket-classification.md).
  - "Status" column: `✅ generated` or `⚠️ skipped: <one-line rationale>`. **For AUGMENT runs:** use `✅ added` for tests inserted into an existing file, and `⏭️ skipped (already covered)` for duplicate-guard skips.
- **Verification — bucket warnings**: If workflow Step 6 emitted any "invalid bucket" soft warnings (per [`bucket-classification.md`](bucket-classification.md)), append them as additional bullets at the END of the Verification section, after the Test run list. Example: `- ⚠️ LLM emitted invalid bucket "Boundary" for test "<title>" — defaulted to Edge. Reviewer: verify classification.`
- **Verification — smoke warnings**: If workflow Step 6 emitted any "invalid smoke value" soft warnings (per [`smoke-policy.md`](smoke-policy.md)), append them as additional bullets at the END of the Verification section, after any bucket warnings. Example: `- ⚠️ LLM emitted invalid smoke value "maybe" for test "<title>" — defaulted to false. Reviewer: verify classification.`
- **Verification — say what ran**: Step 10 runs the smoke set and the target spec. Name both in the Test run list — `- **Scope:** smoke (N tests) + `<testfile>`.` A reader must never have to infer from the number of lines whether a narrow run was a decision or an oversight.
- **Notes for reviewer**: include this section ONLY when the skill made side-effect file changes OR LLM-judgment calls (merge/split/skip per [`qa-analysis.md`](qa-analysis.md)) that the reviewer might disagree with. Each note is a bullet starting with an emoji marker (⚠️ for side effects, 🐞 for expected failures, 📝 for judgment calls). If the workflow produced no side effects and no merge/split/skip decisions, OMIT this section entirely. Position: between `Verification` and `Collision warnings` per the Section order rule.
- **Verification — fix attempts**: a PR only exists when the run is green (ADR-0020: a blocked run reports itself and opens nothing). So `❌ FAIL` never appears as a final state. What DOES belong here is the **fix log**, when workflow Step 10.5 ran: the reviewer needs to know the first run was red and what changed to fix it — a spec that needed three attempts deserves a closer read than one that passed first try. Append after the Test run list:

    ```markdown
    - **Fix attempts:** 2 (first run red)
      <details>
      <summary>What changed</summary>

      1. `Add to cart` button not found — selector guessed from the AC text; verified against a live page source dump and corrected to `~Tap to add product to cart`.
      2. Cart badge assertion read the wrong element — pointed at `Header`'s `CartBadge` component instead of the page-direct locator.

      </details>
    ```

    Omit the whole item when the first run was green.

- **Obstacles encountered is ALWAYS rendered** (ADR-0022) — the one section that is never omitted. With nothing to report its entire body is `None.` A section that can be dropped is a section the agent learns to drop, and the empty state only carries meaning because it cannot be. It holds exactly three things:
  1. **Selector downgrades** — only XPath fails lint, so a locator written below the highest level *available on the page* is caught by nothing else. Name the element, the level available, the level used, and why. A stable unique id is a good locator; the point is that the reviewer learns you checked rather than guessed.
  2. **Tooling friction** — a command or MCP call that failed and was retried or worked around.
  3. **Reference gaps** — where this skill's `references/` didn't cover the case. **Name the file that should have.**

  Do NOT restate what other sections already carry: ticket inferences go in `⚠️ Assumptions & open questions`, failed runs in the fix log, and collisions / harness growth / skipped ACs in their own notes. A section that repeats what the reader just read is a section they learn to skip.

- **Collision warnings section is omitted entirely when no collisions occur** — don't render an empty header.

## Example: an augmenting PR with an expected failure

```markdown
## What I understood from the ticket

> Automated WebdriverIO + Appium coverage for `OR-1` (`login`): 3 tests, all passing.

**Source ticket:** [OR-1](https://your-site.atlassian.net/browse/OR-1) — Story: "[OR][QA][Login] A shopper signs in from the menu and returns to the catalog"
**Feature:** login
**Requirement (as written):** refined EARS criteria — the menu opens the login screen, a valid sign-in returns to the catalog, and invalid input is rejected; a wrong password is a filed defect (OR-4).

**Acceptance Criteria (normalized):**
- AC 1: The menu's "Log In" opens the login screen with both fields and the Login button.
- AC 2: `bod@example.com` / `10203040` returns to the catalog titled "Products".
- AC 5: `alice@example.com` is rejected as locked out.
- AC 6: A wrong password keeps the shopper on the login screen (contradicted by OR-4).

## AC coverage

| AC | Test | Bucket | Status |
|----|------|--------|--------|
| AC 1: The menu's "Log In" opens the login screen… | `the menu opens the login screen with both fields and the Login button` | Positive | ✅ added |
| AC 2: `bod@example.com` returns to the catalog… | — | — | ⏭️ skipped (already covered) |
| AC 5: `alice@example.com` is rejected as locked out. | `⚡ alice@example.com is rejected as locked out @smoke` | Negative | ✅ added |
| AC 6: A wrong password keeps the shopper on login… | `a wrong password does not open the catalog` | Negative | ✅ added |

## Verification

- **Typecheck:** ✅ PASS
- **Scope:** smoke (1 test) + `tests/login/login.spec.ts`.
- **Test run:**
  - `the menu opens the login screen with both fields and the Login button` — ✅ PASS
  - `alice@example.com is rejected as locked out @smoke` — ✅ PASS
  - `a wrong password does not open the catalog [expected failure: OR-4]` — ✅ PASS (expected failure)

## Notes for reviewer

- 🔁 **Augment:** augmented `tests/login/login.spec.ts`, a hand-written file with no provenance block; `Augmented by:` added on line 1.
- ➕ **Page Object additions:** `usernameError`, `passwordError` on `LoginPage`; `opensWithin()` on `CatalogPage`.
- ⏭️ **Skipped (duplicate):** AC 2 maps to `bod@example.com logs in and lands on the catalog`; not re-added. Reviewer: push back if it doesn't actually cover it.
- 🐞 **Expected failure:** `a wrong password does not open the catalog` is locked to `OR-4` with `itFails`, as the ticket records. First run as a plain test, it failed with `Expected: false / Received: true` — the catalog opened — which matches the defect. Reviewer: confirm.

## Obstacles encountered

- 🎯 **Selector downgrade** — the login error labels (`nameErrorTV`, `passwordErrorTV`): no content-desc, so resource-id (level 2) instead of accessibility id (level 1).
```
