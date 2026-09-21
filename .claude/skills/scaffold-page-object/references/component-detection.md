# Component Detection Signatures

This file holds the **per-component root-selector signatures** the `scaffold-page-object` skill uses to recognize framework components in a live page snapshot.

The **canonical list of components** is `src/components/*.ts` — this doc holds the per-component "how to spot it on a page" details. The skill reconciles the two at step 4 of its workflow, in **both** directions: a component file with no row here, and a row here with no component file, are both errors. See ADR-0025.

## Signatures

Every file in `src/components/` MUST have a row. A component that is **nested** — composed by a parent component and never detected on its own — says so in the Root signature column instead of carrying a selector; that satisfies the step 4 reconciliation without making the detector look for it.

| Component    | Import path              | Root signature                                                | When detected, skip these elements                                          |
| ------------ | ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Header`     | `@components/Header`     | `#react-burger-menu-btn` AND `.app_logo` present              | burger menu, logo, cart icon, logout link, navigation links                 |
| `CartBadge`  | `@components/CartBadge`  | **Nested** — never detected standalone; composed by `Header`   | (covered by `Header`)                                                       |
| `BurgerMenu` | `@components/BurgerMenu` | **Nested** — never detected standalone; composed by `Header`   | (covered by `Header`)                                                       |
| `Footer`     | `@components/Footer`     | `[data-test="footer"]`                                        | the social links (twitter/facebook/linkedin) and the copyright line         |

`Header` composes both `CartBadge` and `BurgerMenu` (nesting depth 2, ADR-0001 rule #11). Compose `Header` and you get both; never compose a nested component directly from a Page Object.

## Adding a new component

When a new component lands in `src/components/`, **append a row here BEFORE running the skill against any page that contains it** — or, if it is nested under a parent, mark it `Nested` per the note above. Otherwise the skill aborts at step 4, listing the file and pointing here.

The same applies in reverse: **when a component is deleted, delete its row.** A row whose file no longer exists makes the detector compose an import that does not resolve, and the generated Page Object will not compile. `ProductCard` and `SortDropdown` rows outlived their files by three months for exactly this reason (removed 2026-05-24 in `63fae8e` / `755b4a9`; rows removed 2026-09-06).

## Parallel-array queries vs a discriminator component

When a feature involves many similar elements (product cards, table rows), choose by **what the tests do with them**, not by how many there are:

- **Uniform assertions across all N** (every product's name / price / image) → **page-direct parallel-array queries** on the Page Object that return `T[]`: `getProductNames(): Promise<string[]>`, `getProductPrices(): Promise<string[]>`. Simpler than a component, reads clearly (`expect(await inventoryPage.getProductNames()).toEqual(...)`), and is the right default.
- **Per-instance interaction or state** (add _this_ product to the cart, assert _this_ card's badge/button state) → a **Component with a discriminator** (`new ProductCard(page, productName)`, composition rule #9 / ADR-0001).

**No discriminator component exists in this framework today.** The per-instance case is currently served page-direct: `InventoryPage` holds a private `productCard(productName)` locator helper that scopes to one card, and its public methods (`addToCart`, `getProductButtonLabel`) act through it. That is a legitimate shape — extract a real `ProductCard` component only when a **second** page needs the same per-card interaction (composition rule #10), and add its row here in the same commit.

Rule of thumb: reach for the discriminator component the first time a **second page** must act on one of the N. Until then, page-direct is correct; don't pre-build the component (YAGNI).
