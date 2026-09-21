import { Header } from '@components/Header';
import { step } from '@utils/step';

const PKG = 'com.saucelabs.mydemoapp.android:id';

class LoginPage {
  // Composed Components first, page-direct locators second (composition rule 6).
  readonly header = new Header();

  // nameET / passwordET: resource-id is unique on this screen. The fields carry
  // no content-desc, so this is a deliberate step down one level
  // (accessibility id -> resource-id).
  get usernameInput() {
    return $(`id=${PKG}/nameET`);
  }

  get passwordInput() {
    return $(`id=${PKG}/passwordET`);
  }

  // The button's content-desc is unique — verified, 1 match.
  get loginButton() {
    return $('~Tap to login with given credentials');
  }

  /** Opens the login screen from any screen that shows the header. */
  async open(): Promise<void> {
    await step('Open the login screen from the menu', async () => {
      await this.header.openMenu();
      await $('~Login Menu Item').click();
      await this.usernameInput.waitForDisplayed();
    });
  }

  // The step names the username and never the password: step titles are
  // written to disk and into bug reports.
  async loginAs(username: string, password: string): Promise<void> {
    await step(`Submit credentials for "${username}"`, async () => {
      await this.usernameInput.setValue(username);
      await this.passwordInput.setValue(password);
      await this.loginButton.click();
    });
  }
}

// No Playwright fixtures here: Page Objects are exported as singletons.
export default new LoginPage();
