// Reused by Catalog, Login, Detail and Cart — four pages need it, so it is born
// a Component rather than a page-direct locator (composition rule 10).
// A Component knows Locators and, at most, child Components. Never Pages.

import { step } from '@utils/step';

const PKG = 'com.saucelabs.mydemoapp.android:id';

export class Header {
  // Measured in the page source (2026-09-18): all three are unique
  // content-desc values on every screen where the header appears.
  get menuButton() {
    return $('~View menu');
  }

  get cartButton() {
    return $('~View cart');
  }

  // The number on the cart icon. Absent from the view tree while the cart is
  // empty — not "0". Its content-desc ("Displays number of items in your cart")
  // matches two elements once it appears (cartIV and cartCircleRL) and neither
  // carries the number, so resource-id is the highest level that reads it.
  // Verified 2026-09-23: 1 match on the product detail and the cart screens.
  get cartBadge() {
    return $(`id=${PKG}/cartTV`);
  }

  /**
   * Query: whether the cart badge appears within `ms`. For asserting that an
   * action does NOT add to the cart — an absence is true the instant before the
   * badge arrives, so it has to be watched for a bounded window.
   */
  async cartBadgeAppearsWithin(ms: number): Promise<boolean> {
    try {
      await this.cartBadge.waitForDisplayed({ timeout: ms });
      return true;
    } catch {
      return false;
    }
  }

  async openMenu(): Promise<void> {
    await step('Open the menu', () => this.menuButton.click());
  }

  async openCart(): Promise<void> {
    await step('Open the cart', () => this.cartButton.click());
  }
}
