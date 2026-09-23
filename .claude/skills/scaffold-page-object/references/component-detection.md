# Component Detection Signatures

This file holds the **per-component root-selector signatures** the `scaffold-page-object` skill uses to recognize framework components in a live screen snapshot.

The **canonical list of components** is `src/components/*.ts` — this doc holds the per-component "how to spot it on a screen" details. The skill reconciles the two at step 4 of its workflow, in **both** directions: a component file with no row here, and a row here with no component file, are both errors. See ADR-0025.

## Signatures

Every file in `src/components/` MUST have a row. A component that is **nested** — composed by a parent component and never detected on its own — says so in the Root signature column instead of carrying a selector; that satisfies the step 4 reconciliation without making the detector look for it.

| Component | Import path          | Root signature                                       | When detected, skip these elements                                                              |
| --------- | -------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Header`  | `@components/Header` | `~View menu` AND `~View cart` both present, 1 each    | the menu button, the app logo, the cart button, and the cart badge (`cartTV` and `cartCircleRL`) |

**The cart badge belongs to `Header`, not to a component of its own.** It is part of the header on every screen that has one, and no second parent needs it. Extract it the moment one does (composition rule #10), and add its row here in the same commit.

## Adding a new component

When a new component lands in `src/components/`, **append a row here BEFORE running the skill against any screen that contains it** — or, if it is nested under a parent, mark it `Nested` per the note above. Otherwise the skill aborts at step 4, listing the file and pointing here.

The same applies in reverse: **when a component is deleted, delete its row.** A row whose file no longer exists makes the detector compose an import that does not resolve, and the generated Page Object will not compile. In the sibling web repository two such rows outlived their files by three months, and a third component landed with no row and silently aborted every run of this skill for the same period. Neither was noticed, because the skill was never executed in between — which is why the check is a script and not a glance.

## Parallel-array queries vs a discriminator component

When a screen holds many similar elements (product cards, cart rows), choose by **what the tests do with them**, not by how many there are:

- **Uniform assertions across all N** (every product's name, every row's price) → **page-direct parallel-array queries** returning data: `getProductNames(): Promise<string[]>`. Simpler than a component, and the right default.
- **Per-instance interaction or state** (open _this_ product, remove _this_ row) → a **Component with a discriminator** (composition rule #9), or a page-direct locator helper that takes the discriminator.

**No discriminator component exists in this framework today.** The per-instance case is served page-direct: `CatalogPage.productImageFor(productName)` scopes to one card, and `openProduct(name)` acts through it. That is a legitimate shape — extract a real component only when a **second** page needs the same per-instance interaction (composition rule #10), and add its row here in the same commit.

Rule of thumb: reach for the component the first time a **second screen** must act on one of the N. Until then, page-direct is correct; don't pre-build it (YAGNI).

## What a discriminator looks like on Android

The catalog card is the reference case, and it is the hard one: a card has no `resource-id` and no `content-desc` of its own, and its only tappable element is the product image, whose `content-desc` is `Product Image` on all six cards. The sibling title discriminates it:

```ts
$(`android=new UiSelector().text("${productName}").fromParent(new UiSelector().resourceId("${PKG}/productIV"))`);
```

Measured: 1 match, ~26 ms. **Never use `.instance(N)` as the final locator** — the snapshot tool suggests it, and it is positional: it says "the third one on screen today", which is not what the test means. Use it only to read the count, then discriminate by text or hierarchy.
