import { join } from 'node:path';
import { APP_IDS } from '../../src/app';

// Device and version come from the environment, with this machine's values as
// defaults (ADR-0044): a client's CI never has our AVD.
export const androidCapability: WebdriverIO.Capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': process.env.ANDROID_DEVICE ?? 'emulator-5554',
  'appium:app': join(process.cwd(), process.env.ANDROID_APP ?? 'apps/mda-2.2.0-25.apk'),
  'appium:appPackage': APP_IDS.android,
  'appium:appActivity': '.view.activities.SplashActivity',
  // Measured 2026-09-18: neither the cart nor the session survives process
  // death. fullReset=false avoids reinstalling the APK for every spec (slow);
  // real isolation comes from terminate+activate, not from reinstalling.
  'appium:noReset': false,
  'appium:fullReset': false,
  'appium:newCommandTimeout': 240,
};
