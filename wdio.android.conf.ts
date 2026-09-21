import { join } from 'node:path';

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',

  specs: ['./tests/**/*.spec.ts'],
  maxInstances: 1,

  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'emulator-5554',
      'appium:app': join(process.cwd(), 'apps', 'mda-2.2.0-25.apk'),
      'appium:appPackage': 'com.saucelabs.mydemoapp.android',
      'appium:appActivity': '.view.activities.SplashActivity',
      // Measured 2026-09-18: neither the cart nor the session survives process
      // death. fullReset=false avoids reinstalling the APK for every spec (slow);
      // real isolation comes from terminate+activate, not from reinstalling.
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:newCommandTimeout': 240,
    },
  ],

  logLevel: 'warn',
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  // The service starts Appium from the project root, which is where the
  // package.json that resolves the drivers lives (Appium 3 looks them up
  // against the working directory, not against APPIUM_HOME).
  services: [
    [
      'appium',
      {
        args: { address: '127.0.0.1', port: 4723, relaxedSecurity: true },
        logPath: './logs',
      },
    ],
  ],
  port: 4723,

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 120_000 },
};
