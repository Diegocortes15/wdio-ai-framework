// Test data that differs between platforms (ADR-0044). The same product is
// named differently by each build, and the cart's total renders with a space on
// Android and without one on iOS — measured 2026-09-25, not a formatting choice
// of ours.
//
// These are getters, not constants: `byPlatform` reads the session, so the
// value has to be resolved when the test asks for it, not when the module loads.

import { byPlatform } from '@utils/platform';

export const RED_BACKPACK = {
  get name(): string {
    return byPlatform({
      android: 'Sauce Labs Backpack (red)',
      ios: 'Sauce Labs Backpack - Red',
    });
  },
  unitPrice: '$ 29.99',
  get totalPriceForSix(): string {
    return byPlatform({ android: '$ 179.94', ios: '$179.94' });
  },
  totalItemsForSix: '6 Items',
};
