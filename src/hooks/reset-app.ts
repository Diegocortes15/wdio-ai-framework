// Every test starts from the same known state: a fresh process on the catalog,
// logged out, with an empty cart (ADR-0040). The app keeps both session and
// cart in memory only, so killing the process is the whole reset — measured
// 2026-09-21, median 2.6 s. A test that needs a session logs in itself.
//
// This is a Mocha root hook, not WDIO's `beforeTest`: an error thrown from
// `beforeTest` is logged and swallowed, and the test then runs on whatever
// state the previous one left. A reset that fails has to fail the test.

export const APP_PACKAGE = 'com.saucelabs.mydemoapp.android';

export const mochaHooks = {
  async beforeEach(): Promise<void> {
    await driver.terminateApp(APP_PACKAGE);
    await driver.activateApp(APP_PACKAGE);
    // Poll, never sleep: splash-to-catalog time varies between runs.
    try {
      await $('~View menu').waitForDisplayed({ timeout: 15_000 });
    } catch (error) {
      // A system dialog on top hides the app's whole tree and reads as
      // "element not found" — name what is actually in the foreground.
      const foreground = await driver.getCurrentPackage();
      throw new Error(`App reset did not reach the catalog. Foreground package: ${foreground}.`, {
        cause: error,
      });
    }
  },
};
