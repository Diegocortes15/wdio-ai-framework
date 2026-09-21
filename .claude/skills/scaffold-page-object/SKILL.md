---
name: scaffold-page-object
description: Generate a draft Page Object class from a live page snapshot, composing framework components when detected.
allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(rm:*) Bash(.claude/skills/scaffold-page-object/scripts/check-component-signatures.sh:*) Bash(.claude/skills/scaffold-page-object/scripts/typecheck-generated.sh:*) Read Glob Grep Write Edit
---

# scaffold-page-object

Given a URL + page name + optional storageState, this skill produces a draft Page Object class file at `src/pages/<Name>.ts` (or `scratch/<Name>.ts` for experimentation). The output follows the framework's POM-by-component conventions: `readonly` locator fields, constructor wiring, action methods inferred from the live page, and composition of framework components detected on the page.

## How to use it

Tell Claude what you want:

> Use the scaffold-page-object skill to create a `CheckoutCompletePage` from `https://www.saucedemo.com/checkout-complete.html` using `auth/standard.json`.

Or for experimentation, send the output to `scratch/`:

> Use the scaffold-page-object skill to create a `LoginPage` from `https://www.saucedemo.com` — no auth needed. Write to `scratch/LoginPage.ts`.

## Workflow

The full 12-step procedural workflow is in [`references/workflow.md`](references/workflow.md). Read that file before executing the skill.

## References

- [`references/workflow.md`](references/workflow.md) — the 12-step procedural workflow
- [`references/page-object-template.md`](references/page-object-template.md) — canonical TS template for generated files
- [`references/component-detection.md`](references/component-detection.md) — signatures for recognizing framework components in a page

## Scripts

- [`scripts/check-component-signatures.sh`](scripts/check-component-signatures.sh) — reconciles `src/components/*.ts` against the signature table in both directions, and prints the detection set. Used by workflow Step 4; see ADR-0025.
- [`scripts/typecheck-generated.sh`](scripts/typecheck-generated.sh) — typechecks a generated Page Object against the project's own `tsconfig.json`, path aliases included, resolving `tsc` from `node_modules/.bin` only. Used by workflow Step 11.

## See also

- `docs/scaffold-page-object.md` — learning guide with worked examples
- ADR-0008 — why custom skills follow this layout
- [ADR index (origin repo)](https://github.com/Diegocortes15/playwright-ai-framework/tree/main/docs/adr) — rationale for every `ADR-NNNN` cited above. Paths like `docs/…` and `src/…` are relative to that repo, not to this skill.
