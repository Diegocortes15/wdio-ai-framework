import { Header } from '@components/Header';

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
    await this.productImageFor(productName).click();
  }

  /** Query: returns data, never a Locator (composition rule 8). */
  async getProductNames(): Promise<string[]> {
    return $$(`id=${PKG}/titleTV`).map((e) => e.getText());
  }
}

export default new CatalogPage();
