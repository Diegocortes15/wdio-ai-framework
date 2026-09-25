// Every test starts from the same known state: a fresh process on the catalog,
// logged out, with an empty cart (ADR-0040). Both builds keep session and cart
// in memory only, so killing the process is the whole reset — measured on
// Android 2026-09-21 (median 2.6 s) and on iOS 2026-09-25 (3.0–3.5 s, n=4). A
// test that needs a session logs in itself.
//
// This is a Mocha root hook, not WDIO's `beforeTest`: an error thrown from
// `beforeTest` is logged and swallowed, and the test then runs on whatever
// state the previous one left. A reset that fails has to fail the test.
//
// The arrival anchor is asked of CatalogPage, so the selector for "the catalog
// is up" lives in exactly one place.

import { appId } from '../app';
import CatalogPage from '../pages/CatalogPage';
import { byPlatform } from '../utils/platform';

export const mochaHooks = {
  async beforeEach(): Promise<void> {
    const id = appId();
    await driver.terminateApp(id);
    await driver.activateApp(id);
    // Poll, never sleep: splash-to-catalog time varies between runs.
    try {
      await CatalogPage.screen.waitForDisplayed({ timeout: 20_000 });
    } catch (error) {
      // A system dialog on top hides the app's whole tree and reads as
      // "element not found" — name what is actually in the foreground.
      const foreground = await byPlatform({
        android: () => driver.getCurrentPackage(),
        ios: async () => `${id} app state ${await driver.queryAppState(id)}`,
      })();
      throw new Error(`App reset did not reach the catalog. Foreground: ${foreground}.`, {
        cause: error,
      });
    }
  },
};
