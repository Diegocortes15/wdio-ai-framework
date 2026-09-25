// Augmented by: OR-1 (2026-09-21). Ported to both platforms 2026-09-25 (ADR-0044).
// Manual edits are welcome — this file is not regenerated automatically.
// Re-running /from-issue against a contributing issue will refuse to overwrite.

import CatalogPage from '@pages/CatalogPage';
import LoginPage from '@pages/LoginPage';
import { STANDARD_USER, LOCKED_OUT_USER } from '@data/users';
import { itFails } from '@utils/expected-failure';
import { itOn } from '@utils/platform-only';

const NAVIGATION_WINDOW_MS = 5_000; // measured 2026-09-21: a sign-in reaches the catalog 1.2–1.35 s after the tap

// Why the rejected-credentials tests run on Android only. Measured 2026-09-25:
// on iOS the keyboard covers the submit button and this build dismisses it for
// nothing — not `mobile: hideKeyboard`, not the Return key, not a tap outside,
// not a swipe. The only path that reaches the button is tapping an account's
// chip, which fills the listed credentials, so no rejected submit can be
// produced there at all.
const NO_TYPED_SUBMIT_ON_IOS =
  'iOS cannot submit typed credentials: the keyboard covers the submit button and this build dismisses it for nothing (measured 2026-09-25)';

describe('Login — no auth', () => {
  describe('Positive', () => {
    it('the listed user logs in and lands on the catalog @smoke', async () => {
      await LoginPage.open();
      await expect(LoginPage.usernameInput).toBeDisplayed();

      await LoginPage.loginAs(STANDARD_USER.username, STANDARD_USER.password);

      await expect(CatalogPage.screen).toBeDisplayed();
    });

    it('"Log In" in the menu opens the login screen with its username, password and Login controls', async () => {
      await LoginPage.open();

      await expect(LoginPage.usernameInput).toBeDisplayed();
      await expect(LoginPage.passwordInput).toBeDisplayed();
      await expect(LoginPage.loginButton).toBeDisplayed();
    });

    itOn(
      'android',
      'iOS renders the catalog heading as an element named "title" that carries no text (measured 2026-09-25)',
      'the catalog reached after signing in is headed "Products"',
      async () => {
        await LoginPage.open();
        await LoginPage.loginAs(STANDARD_USER.username, STANDARD_USER.password);

        await expect(CatalogPage.heading).toHaveText('Products');
      },
    );
  });

  describe('Negative', () => {
    const missingFields = [
      {
        input: 'an empty username',
        username: '',
        password: '10203040',
        error: 'usernameError',
        message: 'Username is required',
      },
      {
        input: 'an empty password',
        username: 'bod@example.com',
        password: '',
        error: 'passwordError',
        message: 'Enter Password',
      },
    ] as const;

    for (const { input, username, password, error, message } of missingFields) {
      itOn(
        'android',
        NO_TYPED_SUBMIT_ON_IOS,
        `${input} is rejected with "${message}"`,
        async () => {
          await LoginPage.open();
          await LoginPage.loginAs(username, password);

          await expect(LoginPage[error]).toHaveText(message);
        },
      );
    }

    // Measured 2026-09-25: on iOS 2.2.2 this account signs in and reaches the
    // catalog. The lockout does not exist there — reported, not filed.
    itOn(
      'android',
      'iOS 2.2.2 signs this account in instead of locking it out (measured 2026-09-25, reported)',
      'alice@example.com is rejected as locked out @smoke',
      async () => {
        await LoginPage.open();
        await LoginPage.loginAs(LOCKED_OUT_USER.username, LOCKED_OUT_USER.password);

        await expect(LoginPage.passwordError).toHaveText(LOCKED_OUT_USER.message);
      },
    );

    // OR-7 — iOS signs this account in; Android locks it out. The Android test
    // above asserts the lockout through an error label iOS does not have, so the
    // iOS half asserts the behaviour it CAN observe: the catalog must not open.
    // Replace itFails with it when OR-7 is fixed; this test turning red is the
    // notification.
    itOn(
      'ios',
      'Android covers the lockout through its error message, in the test above',
      'alice@example.com does not reach the catalog',
      async () => {
        await LoginPage.open();
        await LoginPage.loginAs(LOCKED_OUT_USER.username, LOCKED_OUT_USER.password);

        expect(await CatalogPage.opensWithin(NAVIGATION_WINDOW_MS)).toBe(false);
      },
      (title, fn) => itFails('OR-7', title, fn),
    );

    const wrongCredentials = [
      { input: 'a wrong password', username: 'bod@example.com', password: 'xxxxxxxx' },
      { input: 'a username with no account', username: 'nadie@example.com', password: '10203040' },
    ] as const;

    for (const { input, username, password } of wrongCredentials) {
      // OR-4 — the app signs in with any password and any unknown username.
      // Replace itFails with it when OR-4 is fixed; this test turning red is the
      // notification. Android only: see NO_TYPED_SUBMIT_ON_IOS.
      itOn(
        'android',
        NO_TYPED_SUBMIT_ON_IOS,
        `${input} does not open the catalog`,
        async () => {
          await LoginPage.open();
          await LoginPage.loginAs(username, password);

          expect(await CatalogPage.opensWithin(NAVIGATION_WINDOW_MS)).toBe(false);
        },
        (title, fn) => itFails('OR-4', title, fn),
      );
    }
  });

  describe('Edge', () => {
    itOn(
      'android',
      'iOS 2.2.2 signs this account in instead of locking it out (measured 2026-09-25, reported)',
      'the lockout message wins over a wrong password for alice@example.com',
      async () => {
        await LoginPage.open();
        await LoginPage.loginAs(LOCKED_OUT_USER.username, 'xxxxxxxx');

        await expect(LoginPage.passwordError).toHaveText(LOCKED_OUT_USER.message);
      },
    );
  });
});
