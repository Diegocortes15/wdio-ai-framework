// Reached from the catalog with CatalogPage.openProduct(name). There is no
// open() here: which product is shown is decided on the catalog.

import { Navigation } from '@components/Navigation';
import { byPlatform } from '@utils/platform';
import { step } from '@utils/step';

const PKG = 'com.saucelabs.mydemoapp.android:id';

class ProductDetailPage {
  readonly navigation = new Navigation();

  get screen() {
    return $(byPlatform({ android: `id=${PKG}/productIV`, ios: '~ProductDetails-screen' }));
  }

  /**
   * The product name. Android: no content-desc, so resource-id — and the same
   * id (productTV) is the catalog's "Products" title and the cart's "My Cart",
   * so assert its TEXT, never its presence. iOS: the name is its own
   * accessibility id, which cannot be a selector; the second StaticText inside
   * the screen container is it (the first is the "Products" breadcrumb) —
   * measured 2026-09-25.
   */
  get title() {
    return $(
      byPlatform({
        android: `id=${PKG}/productTV`,
        ios: '-ios class chain:**/XCUIElementTypeOther[`name == "ProductDetails-screen"`]/**/XCUIElementTypeStaticText[2]',
      }),
    );
  }

  /** The quantity chosen before adding. 1 match on each platform. */
  get quantity() {
    return $(byPlatform({ android: `id=${PKG}/noTV`, ios: '~Amount' }));
  }

  get increaseQuantityButton() {
    return $(byPlatform({ android: '~Increase item quantity', ios: '~AddPlus Icons' }));
  }

  get addToCartButton() {
    return $(byPlatform({ android: '~Tap to add product to cart', ios: '~AddToCart' }));
  }

  async increaseQuantity(times = 1): Promise<void> {
    await step(`Increase the quantity ${times} time(s)`, async () => {
      for (let i = 0; i < times; i++) {
        await this.increaseQuantityButton.click();
      }
    });
  }

  async addToCart(): Promise<void> {
    await step('Add the product to the cart', () => this.addToCartButton.click());
  }
}

export default new ProductDetailPage();
