# scaffold-page-object Workflow

The 11-step procedural workflow Claude follows when the `scaffold-page-object` skill is invoked.

## Inputs

- **Page name** (required) — e.g. `CartPage` (PascalCase, no `.ts` suffix)
- **How to reach the screen** (required) — the taps from the app's launch screen, e.g. "open a product from the catalog, then tap the header's cart button". A mobile screen has no URL; if the user did not say, ask. Do not guess a navigation.
- **Output path** (optional) — defaults to `src/pages/<Name>.ts`; `scratch/<Name>.ts` for experimentation

## Steps

### 1. Validate inputs

Check that the page name and the navigation are present. If either is missing, ask the user; don't guess.

### 2. Confirm the device and the exploration server

```bash
adb devices                              # expect one "<serial>  device" line
curl -s http://127.0.0.1:4725/status     # expect "ready":true
```

- **No device** → abort: _"No emulator or device is attached. Run `npm run emulator`, then re-run."_
- **No Appium on 4725** → abort: _"The exploration Appium is not running. Run `npm run appium:explore`, then re-run."_

The exploration server is deliberately **not** the one the test run uses (4723): running the suite kills an open exploration session, and sharing one port makes that collision silent.

### 3. Refuse to overwrite

If the resolved output path already exists (use `Glob` or `Read` to check), abort with:

> _"`<path>` exists. `rm` it and re-run, or pick a different output path."_

No merging, no overwriting. Predictable safety.

### 4. Hybrid auto-discover of framework components

Run the check — do NOT eyeball the two lists:

```bash
.claude/skills/scaffold-page-object/scripts/check-component-signatures.sh
```

| Exit | Meaning                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------- |
| 0    | Reconciled. Stdout lists each component as `detect: <Name>` or `nested: <Name>` — the `detect:` set is what Step 6 looks for |
| 1    | Mismatch. The message names the file or the row to fix; abort and report it verbatim                             |
| 66   | `references/component-detection.md` not found — restore the skill                                                |
| 67   | `src/components/` not found — wrong directory, or the framework is not bootstrapped                              |

The two sources it reconciles are the **canonical list** (`src/components/*.ts`, by filename) and the **signature table** in `references/component-detection.md`. It reconciles in BOTH directions (ADR-0025). This step runs before the app is opened, so a failure here aborts every run regardless of the target screen. That is deliberate: a stale table generates a Page Object that does not compile.

A row whose Root signature reads **Nested** satisfies the file→row direction without being added to the detection set — the script reports it as `nested:` — because it is composed by a parent component and never looked for on its own. Compose the parent; never compose a nested component directly from a Page Object.

### 5. Open the app and navigate to the screen

Use the `wdio-mcp` MCP server. Start the session against the exploration Appium:

```
start_session({ platform: 'android', deviceName: '<serial>', automationName: 'UiAutomator2',
                appPath: '<absolute path to the APK>', appWaitActivity: '*',
                autoAcceptAlerts: false, appiumConfig: { host: '127.0.0.1', port: 4725 } })
```

**`autoAcceptAlerts: false` is not a detail.** Its default accepts system dialogs silently, and a system dialog covering the app is exactly what you need to see: it hides the app's whole tree and reads as "the element does not exist".

Then walk the navigation from the input with `tap_element`, one tap at a time. **After every tap that changes screens, poll**: call `get_elements` again until an element that identifies the destination appears, up to about five attempts. Nothing in the tool waits — `get_elements` is a snapshot and `tap_element` does not wait either — and a tree read mid-transition comes back as two root containers, which reads exactly like a missing element. If the destination never appears, take `get_screenshot` and look before concluding anything.

**Close the session when the run ends** (`close_session`), including on an abort. An abandoned session holds the device.

### 6. Snapshot the screen and detect components

```
get_elements({ includeContainers: true, inViewportOnly: false })
```

Pass both flags explicitly rather than trusting the defaults — the tool's README and its own schema disagree about `inViewportOnly`, and a count taken over part of the screen is not a count. `includeContainers: true` is what surfaces labels and layout nodes, which is where validation messages and titles live.

Walk the snapshot for each component signature loaded in Step 4. For each match, mark the component for composition — do **not** re-generate its constituent locators; the signature table's last column says which elements it covers.

### 7. Generate locators for non-component elements

For each remaining element the tests need (excluding any covered by detected components), read its `accessibilityId`, `resourceId` and `text` straight from the snapshot rows and choose the highest level that is **unique**:

1. `~accessibility id` → 2. `id=<package>:id/<resource-id>` → 3. `UiSelector` / predicate string → 4. class chain. Never XPath.

Pick a semantic field name from the accessible name: normalize to camelCase, strip filler words (`to`, `the`, `and`, `a`, `of`), favour brevity — `"Tap to add product to cart"` → `addToCart`, `"Removes product from cart"` → `removeItem`.

**Read ambiguity off the snapshot, then discriminate.** The tool suggests `.instance(N)` for any selector that matches more than one element — that suffix is the count, not the answer. Never ship it, and never `$$(sel)[0]`: WebdriverIO's `$()` takes the first match **silently**, so an ambiguous locator acts on the wrong element and the test can still pass. There is no strict-mode violation to catch it, which is why counting matters more here than on the web.

**Count each locator on the screens a test arrives from, too.** A `content-desc` can be unique on the screen you are scaffolding and ambiguous on the one before it. A measured example from this app: `~Displays number of items in your cart` matches **one** element while the cart is empty and **two** once the badge appears (`cartIV` and `cartCircleRL`) — so the badge's number is read from `id=…/cartTV`, not from that description.

**Where the count is above one, scope rather than downgrade**: discriminate by sibling text (`fromParent`) or by hierarchy (`childSelector`), at the highest level that yields one match, and say which level you took and why in a comment at the call site. A scoping container is **not** a downgrade and does not belong in Step 11's downgrade list.

Note every genuine downgrade — a level below the highest available — as you make the call, for Step 11 (ADR-0022).

### 8. Render the Page Object

Following `references/page-object-template.md`:

- Top-of-file comment block (mandatory; `YYYY-MM-DD` = today's date in the user's local time)
- Imports: the detected component classes from `@components/*`, and `step` from `@utils/step`
- A `PKG` constant for the app's package prefix when any `id=` locator needs it
- Composed components as `readonly` fields first (composition rule #6), then page-direct locators **as getters** — a stored element goes stale across a screen transition
- Action methods, each wrapping its body in exactly one `step(...)`:
  - Button / tappable → `<name>(): Promise<void>`
  - Text field → `fill<Name>(value: string): Promise<void>` using `setValue`
  - One of many → takes the discriminator as its first argument
- Queries returning data (`get<Name>s(): Promise<string[]>`) — not steps
- `export default new <Name>Page();`

### 9. Write the file

Default output path:

- If the user gave one explicitly, use it
- Else write to `src/pages/<Name>.ts`

Use the `Write` tool. (Step 3 already confirmed the path didn't exist.)

### 10. Isolated typecheck of the generated file

Run the check — do NOT hand-roll a tsconfig, and never `npx tsc`:

```bash
.claude/skills/scaffold-page-object/scripts/typecheck-generated.sh src/pages/<Name>.ts
```

| Exit  | Meaning                                                                                      |
| ----- | -------------------------------------------------------------------------------------------- |
| 0     | Clean → record the pass for Step 11                                                          |
| 64    | Bad usage — you passed no files                                                               |
| 66    | No `tsconfig.json` at the repo root                                                           |
| 69    | TypeScript not installed → tell the user to run `npm install`, and stop                        |
| other | Type errors, printed verbatim → leave the file in place and capture them for Step 11          |

The script writes a throwaway tsconfig that extends the project's own (so `@components/*` and `@utils/*` resolve), typechecks through it, and always cleans up. It resolves `tsc` from `node_modules/.bin` and refuses to run otherwise: with `node_modules` absent or stale, `npx tsc` silently fetches `tsc@2.0.4` from the registry — a deprecated squatter package that is not the TypeScript compiler — and hands back a PASS the run never earned.

**There is no fixture registration step.** WebdriverIO has no fixtures: the Page Object is a singleton and a spec imports it directly. The Playwright original edited `src/fixtures/test.ts` here; nothing in this framework needs editing for the generated Page Object to be usable.

### 11. Report what landed

Report to the user:

- Output file path
- List of composed components (if any)
- List of generated page-direct locators (field name → selector), and the match count each was verified at
- List of generated action methods and queries
- Isolated-typecheck result (PASS or the errors verbatim)
- Confirmation that the top-of-file comment block landed (the first lines of the file match the template)
- That the MCP session was closed
- Obstacles encountered (see below) — always, even if none

**Obstacles encountered** — ALWAYS render this section, even when there is nothing to report (then it is one line: `Obstacles encountered: none.`). It is a deliberate exception to the "omit empty sections" rule (ADR-0022): a section that can be dropped is one the agent learns to drop, and the empty state only means something because it cannot be.

It carries exactly three things:

1. **Selector downgrades.** The order is accessibility id → resource-id → `UiSelector` / predicate string → class chain, and only XPath fails lint. So when you write a locator below the highest level _available on the screen_, nothing catches it but this line. Name the element, the level available, the level you used, and why. A unique `resource-id` is a perfectly good locator — the point is not to apologise for it, it is that the reviewer learns you looked.
2. **Tooling friction** — a command or MCP call that failed and was retried or worked around. Say what failed and what you did instead.
3. **Reference gaps** — where this skill's own `references/` did not cover the case and you had to improvise. **Name the file that should have covered it.** This is the only signal that says what is stopping the skill from working as it should.

An obstacle that will outlive this run also goes into the repository's record, in the same change as the work — the failure-modes page if the repository keeps one, and, when the lesson changes how work is done, into the reference that should have covered it.
