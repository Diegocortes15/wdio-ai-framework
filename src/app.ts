// The application under test, per platform. The capabilities and the reset hook
// both read from here so the identifier is written once.
import { byPlatform } from './utils/platform';

export const APP_IDS = {
  android: 'com.saucelabs.mydemoapp.android',
  ios: 'com.saucelabs.mydemo.app.ios',
} as const;

/** The id the driver terminates and activates: appPackage on Android, bundleId on iOS. */
export function appId(): string {
  return byPlatform(APP_IDS);
}
