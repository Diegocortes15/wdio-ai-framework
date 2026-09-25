import { join } from 'node:path';
import { APP_IDS } from '../../src/app';

// The simulator is named, not pinned by udid, so another machine only has to
// have a simulator with this name. Both values are overridable (ADR-0044).
//
// Xcode 16.2 ships only the iPhoneSimulator18.2 SDK: a runtime older than that
// fails the session with a bare "code 70" (docs/failure-modes.md). The default
// below is the runtime this machine downloaded for that reason.
export const iosCapability: WebdriverIO.Capabilities = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:deviceName': process.env.IOS_DEVICE ?? 'iPhone 16',
  'appium:platformVersion': process.env.IOS_VERSION ?? '18.3',
  'appium:app': join(process.cwd(), process.env.IOS_APP ?? 'apps/Payload/My Demo App.app'),
  'appium:bundleId': APP_IDS.ios,
  // Same reasoning as Android: the per-test reset is terminate + activate
  // (measured on iOS 2026-09-25: it clears cart and session), not a reinstall.
  'appium:noReset': false,
  'appium:fullReset': false,
  'appium:newCommandTimeout': 240,
};
