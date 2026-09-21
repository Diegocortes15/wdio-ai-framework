# Harness resolution & growth

How `/from-issue` resolves and **grows** the authenticated-test harness (the Playwright project matrix + auth setup) when a ticket needs a user whose project isn't wired yet. Per ADR-0014. The harness is **data-driven and demand-driven**: autonomous, no mid-run questions, no recovering old config from git history.

## Single source of truth — `tests/users.ts`

```ts
// Single source of truth for the authenticated projects + auth setup.
// /from-issue appends a user here (and nowhere else) the first time a ticket
// needs that user's authenticated page (ADR-0014). Grows one user at
// a time — do NOT pre-populate unused users (ADR-0004).
export const AUTH_USERS = ['standard'] as const;
```

`playwright.config.ts` and `tests/auth.setup.ts` both derive from `AUTH_USERS`. Adding a user is a **one-line append** — nothing else changes.

## Canonical config shape

```ts
import { AUTH_USERS } from './tests/users';
// projects: setup, no-auth, then one chromium project per user:
//   ...AUTH_USERS.map((user) => ({
//     name: user,
//     testIgnore: /.*\.setup\.ts/,
//     grep: new RegExp(`@all-users|@${user}`),
//     dependencies: ['setup'],
//     use: { ...devices['Desktop Chrome'], storageState: `auth/${user}.json` },
//   }))
```

`tests/auth.setup.ts` loops `AUTH_USERS`, logging each `<user>_user` in and saving `auth/<user>.json`.

## The growth rule (Step 6.5)

After Step 6 assigns each test a `user` + tags, compute the **required user set**:

- `@no-auth` tests → no user.
- user-agnostic tests (`@all-users`, `@standard`) → require only `standard`.
- a test that targets a specific user (e.g. an AC about `problem_user`'s broken images → `@problem`) → requires that user.

For each required user **not** already in `AUTH_USERS`, **append it.** Then:

- **First-time creation** (fresh/blank-slate repo with no `tests/users.ts` / data-driven config / `auth.setup.ts`): create all three from the canonical shapes above, seeded with the required users (always include `standard` once any auth test exists).
- **Existing harness**: edit only `tests/users.ts` (append the user) — the config and auth setup already derive.

Record a side-effect note for the PR (Step 12 / `pr-description-template.md`):
`⚙️ Harness grew: wired the <user> project + auth setup (first ticket needing <user>). Reviewer: confirm.`

## Guardrail (ADR-0004)

- **Never** pre-create users no test targets.
- **Never** add `<browser>-<non-standard>` projects (`firefox-problem`, `webkit-error`, …). Cross-browser is standard-only smoke and stays **out** of `/from-issue`'s growth — it's a separate ADR-0004 decision. `@sort-functional` is **not** a routing tag and must never be emitted as one: no project greps it, so those tests would run in zero projects and the run would report green having executed nothing.

## Staging

Stage `tests/users.ts` (and, on first-time creation, `playwright.config.ts` + `tests/auth.setup.ts`) in the Step 11 commit alongside the spec + Page Object.
