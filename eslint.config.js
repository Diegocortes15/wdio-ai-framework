import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'logs/**', 'apps/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // XPath stays forbidden, as in the web repo — but here the argument is
          // not fragility, it is measured cost (2026-09-18, API 35, Apple
          // Silicon): ~accessibility id 10 ms, resource-id 9 ms, UiSelector
          // 13 ms, XPath 26-28 ms. And the case Appium's own docs name as
          // XPath's legitimate niche — navigating to a sibling — is resolved by
          // UiSelector().fromParent() with 1 match. Across 4 screens of the SUT:
          // 55 clickables, 27 ambiguous, 0 that require XPath.
          // Order: ~accessibility id -> id/resource-id -> -android uiautomator
          // / -ios predicate string -> -ios class chain.
          selector:
            'CallExpression[callee.name=/^\\$\\$?$/] > Literal:first-child[value=/^(\\/\\/|\\(|xpath=)/]',
          message:
            'XPath is not allowed. Use ~accessibility id, then id/resource-id, then -android uiautomator / -ios predicate string, then -ios class chain.',
        },
        {
          // Mobile equivalent of the page.waitForTimeout() ban. WDIO does
          // auto-wait: measured, a click on a non-existent selector takes
          // exactly waitforTimeout (10,026 ms) before it fails.
          selector: "CallExpression[callee.object.name='browser'][callee.property.name='pause']",
          message:
            'browser.pause() is not used. WDIO auto-waits: use waitForDisplayed/waitForExist or an expect-webdriverio assertion.',
        },
      ],
    },
  },
  {
    // A spec never branches by platform (ADR-0044). The difference belongs in
    // the Page Object (byPlatform), in the data, or — when the behaviour does
    // not exist at all on the other platform — in itOn(), which says why.
    // Only the runner and the object model know the platform; the test does not.
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='driver'][property.name=/^is(Android|IOS)$/]",
          message:
            'A spec never branches by platform. Put the difference in the Page Object (byPlatform) or in the data, or declare the test with itOn(platform, reason, …).',
        },
        {
          selector: "CallExpression[callee.name='byPlatform']",
          message:
            'byPlatform belongs in a Page Object, a Component or the data — not in a spec. A test knows Pages and Data only.',
        },
      ],
    },
  },
);
