import { Navigation } from '@components/Navigation';
import { byPlatform, isPlatform, onlyOn } from '@utils/platform';
import { step } from '@utils/step';

const PKG = 'com.saucelabs.mydemoapp.android:id';

// The password every listed account uses. On iOS it is never typed: see loginAs.
export const LISTED_PASSWORD = '10203040';

class LoginPage {
  // Composed Components first, page-direct locators second (composition rule 6).
  readonly navigation = new Navigation();

  // Android: resource-id — the fields carry no content-desc, a deliberate step
  // down one level. iOS: the inputs have no accessibility id at all, so the
  // class chain addresses them by type; there is exactly one of each.
  get usernameInput() {
    return $(
      byPlatform({
        android: `id=${PKG}/nameET`,
        ios: '-ios class chain:**/XCUIElementTypeTextField',
      }),
    );
  }

  get passwordInput() {
    return $(
      byPlatform({
        android: `id=${PKG}/passwordET`,
        ios: '-ios class chain:**/XCUIElementTypeSecureTextField',
      }),
    );
  }

  // iOS names the submit button "Login" — and so is the screen's heading, a
  // StaticText. The predicate pins the type, or `$` would return whichever
  // came first.
  get loginButton() {
    return $(
      byPlatform({
        android: '~Tap to login with given credentials',
        ios: '-ios predicate string:type == "XCUIElementTypeButton" AND name == "Login"',
      }),
    );
  }

  // Both error labels exist only after a rejected submit, and carry no
  // content-desc, so resource-id is the highest unique level. Verified
  // 2026-09-21: 1 match each; the locked-out message also renders in
  // passwordErrorTV.
  //
  // Android only, because on iOS no rejected submit can be produced at all —
  // see loginAs.
  private get IOS_CANNOT_SUBMIT() {
    return 'the iOS login form cannot be submitted with typed credentials: the keyboard hides the submit button and this build dismisses it for nothing (measured 2026-09-25)';
  }

  get usernameError() {
    return $(onlyOn('android', `id=${PKG}/nameErrorTV`, this.IOS_CANNOT_SUBMIT));
  }

  get passwordError() {
    return $(onlyOn('android', `id=${PKG}/passwordErrorTV`, this.IOS_CANNOT_SUBMIT));
  }

  /** Opens the login screen: Android through the drawer, iOS through the More tab. */
  async open(): Promise<void> {
    await step('Open the login screen from the menu', async () => {
      await this.navigation.openMenu();
      await $(byPlatform({ android: '~Login Menu Item', ios: '~Login Button' })).click();
      await this.usernameInput.waitForExist();
    });
  }

  /**
   * The step names the username and never the password: step titles are written
   * to disk and into bug reports.
   *
   * The two platforms submit differently, and this is the one interaction that
   * genuinely diverges (ADR-0044). Android types both fields. iOS taps the
   * account's chip on the screen, which fills both without opening the
   * keyboard — the only path that reaches the submit button on that build. It
   * therefore can only submit the listed password, and refuses anything else
   * instead of signing in with a password the caller did not ask for.
   */
  async loginAs(username: string, password: string): Promise<void> {
    await step(`Submit credentials for "${username}"`, async () => {
      if (isPlatform('ios')) {
        if (password !== LISTED_PASSWORD) {
          throw new Error(
            `iOS can only submit the listed password for "${username}" — ${this.IOS_CANNOT_SUBMIT}`,
          );
        }
        await $(`~${username}`).click();
      } else {
        await this.usernameInput.setValue(username);
        await this.passwordInput.setValue(password);
      }
      await this.loginButton.click();
    });
  }
}

// No Playwright fixtures here: Page Objects are exported as singletons.
export default new LoginPage();
