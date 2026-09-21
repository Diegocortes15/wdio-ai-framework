// Reused by Catalog, Login, Detail and Cart — four pages need it, so it is born
// a Component rather than a page-direct locator (composition rule 10).
// A Component knows Locators and, at most, child Components. Never Pages.

export class Header {
  // Measured in the page source (2026-09-18): all three are unique
  // content-desc values on every screen where the header appears.
  get menuButton() {
    return $('~View menu');
  }

  get cartButton() {
    return $('~View cart');
  }

  async openMenu(): Promise<void> {
    await this.menuButton.click();
  }

  async openCart(): Promise<void> {
    await this.cartButton.click();
  }
}
