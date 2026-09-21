import { Header } from '@components/Header';
import { step } from '@utils/step';

const PKG = 'com.saucelabs.mydemoapp.android:id';

class CatalogPage {
  readonly header = new Header();

  get title() {
    return $(`id=${PKG}/productTV`);
  }

  /**
   * The product image is the only clickable element in a card, and there are six
   * identical ones (content-desc "Product Image"). The card itself carries no
   * resource-id and no content-desc, so the discriminator is the sibling title:
   * UiSelector resolves it with fromParent() in 1 match / ~26 ms. No XPath needed.
   */
  productImageFor(productName: string) {
    return $(
      `android=new UiSelector().text("${productName}")` +
        `.fromParent(new UiSelector().resourceId("${PKG}/productIV"))`,
    );
  }

  async openProduct(productName: string): Promise<void> {
    await step(`Open the product "${productName}"`, () =>
      this.productImageFor(productName).click(),
    );
  }

  /** Query: returns data, never a Locator (composition rule 8). */
  async getProductNames(): Promise<string[]> {
    return $$(`id=${PKG}/titleTV`).map((e) => e.getText());
  }

  /**
   * Query: whether the catalog appears within `ms`. For asserting that a
   * navigation does NOT happen — an absence is true the instant before the
   * screen arrives, so it has to be watched for a bounded window.
   */
  async opensWithin(ms: number): Promise<boolean> {
    try {
      await this.title.waitForDisplayed({ timeout: ms });
      return true;
    } catch {
      return false;
    }
  }
}

export default new CatalogPage();
