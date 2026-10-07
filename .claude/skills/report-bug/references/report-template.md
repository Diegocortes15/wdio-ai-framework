# Bug report draft template

The `report-bug` skill renders this. Section order is mandatory — a reader scanning several
reports should find the same thing in the same place every time.

## Template

```markdown
**Summary:** <one line: what the app did that it should not have, in the user's words>

**Environment:** <platform and device, e.g. iOS 18.3 · iPhone 16 simulator> · <app and version, from the failure's `app` field and the capability> · <feature> · found by automated test

## Steps to reproduce

1. <reproSteps[0]>
2. <reproSteps[1]>
   …

## Expected Result

<the acceptance criterion verbatim when one is available; otherwise the test's assertion in plain words, preceded by the one-line reason it could not be resolved>

## Actual Result

<what happened — `received` when the script parsed one, otherwise the first line of the error>

## On the other platform

<one line per entry in `otherPlatforms`: passed there, failed there too, or did not run there —
and what that means. "Passed on Android" turns this from a product defect into a defect in one
build; "failed on both" removes the platform from the question entirely. Never omit this section:
a reader who is not told will assume one platform was never tried.>

## Which is wrong?

- **If the application:** <one sentence>
- **If the ticket:** <one sentence>
- **If the automation:** <one sentence — the app is fine and the test encodes a stale or over-loose assumption about it>
- <the repository's own documentation, cited, when it covers this — say whether it specifies intended behaviour or records a known defect; the second does not make the behaviour correct>

## Evidence

**Attach:** `<test-results/failures/<platform>/<slug>/>` — `screenshot.png`, `page-source.xml` and
`failure.json`, written by the run itself at the moment the assertion gave up. One folder per failed
test, per platform; drag it onto the ticket.

- Failing test: `<file>:<line>` — `<title>`
- The tree: `page-source.xml` is the element tree behind that screenshot. Read it beside the image,
  not instead of it — on iOS, XCUITest reports elements the application plainly draws as
  `visible="false"`, so a tree that looks empty is not proof the screen was.
- The steps the test ran: `test-results/steps/<platform>/`, named in `failure.json`.

**There is no video, no trace and no network log.** Appium records the screen only when asked to and
cannot see the application's traffic at all, so a network-shaped failure — a request that never
returns, a stale payload — is reported from what the screen showed, and the report says plainly that
is all the evidence there is. Inventing a cause from a blank screen is worse than naming the gap.

**Never publish this folder, or the Appium server log, to an unauthenticated host.** Not GitHub
Pages, not a public bucket, not a paste service, not a link anyone with the URL can open — however
convenient it would be for whoever reads the ticket. The log carries live session tokens, and a
screenshot carries whatever the screen held, so both inherit the confidentiality of the application
under test.

Attach the folder to the ticket, where it inherits the tracker's permissions, or ship the CI
artifact, which inherits the repository's. If someone asks for a public link, the answer is the
artifact plus access, not a copy on a host with no door.

**The Appium server log is pointed at, never copied.** It lives in `logs/`, covers the whole run
rather than this test, and is the first place to look when the failure is "element not found" and
the screenshot shows the element — the log says what the driver was actually asked for.
