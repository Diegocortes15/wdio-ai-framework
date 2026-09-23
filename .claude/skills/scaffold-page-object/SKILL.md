---
name: scaffold-page-object
description: Generate a draft Page Object class from a live app screen snapshot taken through Appium, composing framework components when detected.
allowed-tools: Bash(adb:*) Bash(curl:*) Bash(npm:*) Bash(npx:*) Bash(rm:*) Bash(.claude/skills/scaffold-page-object/scripts/check-component-signatures.sh:*) Bash(.claude/skills/scaffold-page-object/scripts/typecheck-generated.sh:*) Read Glob Grep Write Edit mcp__wdio-mcp__start_session mcp__wdio-mcp__get_elements mcp__wdio-mcp__tap_element mcp__wdio-mcp__set_value mcp__wdio-mcp__get_screenshot mcp__wdio-mcp__close_session
---

# scaffold-page-object

Given a page name and how to reach the screen, this skill produces a draft Page Object class file at `src/pages/<Name>.ts` (or `scratch/<Name>.ts` for experimentation). The output follows the framework's POM-by-component conventions: locators as getters, composed components as `readonly` fields, action methods inferred from the live screen and wrapped in named steps, and composition of framework components detected on the screen.

A mobile screen has no URL, so the input is a **navigation**: the taps that reach it from the app's launch screen. The snapshot comes from the `wdio-mcp` MCP server driving the app over the exploration Appium (`npm run appium:explore`), which is why the emulator has to be running before the skill is invoked.

## How to use it

Tell Claude what you want:

> Use the scaffold-page-object skill to create a `CartPage`. Reach it by opening a product from the catalog and tapping the header's cart button.

Or for experimentation, send the output to `scratch/`:

> Use the scaffold-page-object skill to create a `ProductDetailPage`, reached by tapping a product card on the catalog. Write to `scratch/ProductDetailPage.ts`.

## Workflow

The full 11-step procedural workflow is in [`references/workflow.md`](references/workflow.md). Read that file before executing the skill.

## References

- [`references/workflow.md`](references/workflow.md) — the 11-step procedural workflow
- [`references/page-object-template.md`](references/page-object-template.md) — canonical TS template for generated files
- [`references/component-detection.md`](references/component-detection.md) — signatures for recognizing framework components on a screen, and when a discriminator component earns its place

## Scripts

- [`scripts/check-component-signatures.sh`](scripts/check-component-signatures.sh) — reconciles `src/components/*.ts` against the signature table in both directions, and prints the detection set. Used by workflow Step 4; see ADR-0025.
- [`scripts/typecheck-generated.sh`](scripts/typecheck-generated.sh) — typechecks a generated Page Object against the project's own `tsconfig.json`, path aliases included, resolving `tsc` from `node_modules/.bin` only. Used by workflow Step 10.

## See also

- ADR-0008 — why custom skills follow this layout
- [ADR index (origin repo)](https://github.com/Diegocortes15/playwright-ai-framework/tree/main/docs/adr) — rationale for every `ADR-NNNN` cited above. Paths like `docs/…` and `src/…` are relative to that repo, not to this skill.
