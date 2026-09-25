import { Navigation } from '@components/Navigation';
import { byPlatform, onlyOn } from '@utils/platform';
import { step } from '@utils/step';

const PKG = 'com.saucelabs.mydemoapp.android:id';

class CatalogPage {
  readonly navigation = new Navigation();

  /**
   * The arrival signal, and the one the reset hook polls. Android: the product
   * list's content-desc, which is unique to this screen (its resource-id is the
   * cart list's too). iOS: the screen container's accessibility id.
   */
  get screen() {
    return $(byPlatform({ android: '~Displays all products of catalog', ios: '~Catalog-screen' }));
  }

  /**
   * The "Products" heading. Android only: on iOS the heading element is named
   * `title` and carries no text, so there is nothing to assert (measured
   * 2026-09-25). Reading this on iOS throws rather than returning a locator
   * that would quietly match nothing.
   */
  get heading() {
    return $(
      onlyOn(
        'android',
        `id=${PKG}/productTV`,
        'iOS renders the catalog heading as an element named "title" with no readable text',
      ),
    );
  }

  /**
   * The tappable product. Android: the image is the only clickable element in a
   * card, and there are six identical ones, so the discriminator is the sibling
   * title — UiSelector resolves it with fromParent() in 1 match / ~26 ms, no
   * XPath needed. iOS: every product name is a StaticText named "Product Name"
   * whose label is the product, and tapping the label opens the detail.
   */
  productImageFor(productName: string) {
    return $(
      byPlatform({
        android:
          `android=new UiSelector().text("${productName}")` +
          `.fromParent(new UiSelector().resourceId("${PKG}/productIV"))`,
        ios: `-ios predicate string:name == "Product Name" AND label == "${productName}"`,
      }),
    );
  }

  async openProduct(productName: string): Promise<void> {
    await step(`Open the product "${productName}"`, () =>
      this.productImageFor(productName).click(),
    );
  }

  /** Query: returns data, never a Locator (composition rule 8). */
  async getProductNames(): Promise<string[]> {
    return $$(
      byPlatform({
        android: `id=${PKG}/titleTV`,
        ios: '-ios predicate string:name == "Product Name"',
      }),
    ).map((e) => e.getText());
  }

  /**
   * Query: whether the catalog appears within `ms`. For asserting that a
   * navigation does NOT happen — an absence is true the instant before the
   * screen arrives, so it has to be watched for a bounded window.
   */
  async opensWithin(ms: number): Promise<boolean> {
    try {
      await this.screen.waitForDisplayed({ timeout: ms });
      return true;
    } catch {
      return false;
    }
  }
}

export default new CatalogPage();
