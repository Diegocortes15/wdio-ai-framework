// The app's chrome, on both platforms. Named for what it does, not for where it
// sits: on Android it is a header with a drawer and a cart icon, on iOS a tab
// bar at the bottom (ADR-0044). A spec calls the same three verbs either way.
//
// A Component knows Locators and, at most, child Components. Never Pages.

import { byPlatform } from '@utils/platform';
import { step } from '@utils/step';

const PKG = 'com.saucelabs.mydemoapp.android:id';

export class Navigation {
  // Android: the drawer button. iOS: the More tab, which is where Login lives.
  get menuButton() {
    return $(byPlatform({ android: '~View menu', ios: '~More-tab-item' }));
  }

  get cartButton() {
    return $(byPlatform({ android: '~View cart', ios: '~Cart-tab-item' }));
  }

  /**
   * The number on the cart icon. On BOTH platforms it is absent from the view
   * tree while the cart is empty — not "0" — so its presence is the assertion
   * and `toExist` the operator.
   *
   * Android: the content-desc matches two elements and neither carries the
   * number, so resource-id is the highest level that reads it (2026-09-23).
   *
   * iOS: the badge is drawn inside the Cart tab item, but XCUITest reports it
   * `visible="false"` — as it does for the tab labels, which are plainly on
   * screen — so `toBeDisplayed` would be wrong here; the text is readable. Its
   * own name IS the count, so the name cannot be the selector.
   *
   * iOS is a class chain, not a predicate: a bare "StaticText whose name is a
   * number" also matches a cart row's quantity, and on the cart screen the two
   * can read the same number — 1 match on the product detail, 2 on the cart.
   * The badge is the numeric StaticText in the container beside the Cart tab's
   * button, and a predicate cannot say "beside". Anchored on `Cart-tab-item`,
   * not on the circle drawn behind the number: that image is `GreenRoundView`
   * while the Cart tab is selected and `GrayRoundView` otherwise. Measured
   * 2026-09-30: 1 match on the product detail and on the cart.
   */
  get cartBadge() {
    return $(
      byPlatform({
        android: `id=${PKG}/cartTV`,
        ios:
          '-ios class chain:**/XCUIElementTypeOther[$name == "Cart-tab-item"$]' +
          '/XCUIElementTypeOther/XCUIElementTypeStaticText[`name MATCHES "[0-9]+"`]',
      }),
    );
  }

  /**
   * Query: whether the cart badge appears within `ms`. For asserting that an
   * action does NOT add to the cart — an absence is true the instant before the
   * badge arrives, so it has to be watched for a bounded window.
   */
  async cartBadgeAppearsWithin(ms: number): Promise<boolean> {
    try {
      await this.cartBadge.waitForExist({ timeout: ms });
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
