import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { APP_PACKAGE } from './src/hooks/reset-app';
import { STEPS_DIR, startStepRecord, writeStepRecord } from './src/hooks/record-steps';

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
      'appium:appPackage': APP_PACKAGE,
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
  // The app reset before every test is a Mocha root hook (ADR-0040): a reset
  // that fails has to fail the test, and WDIO's own hooks swallow errors.
  mochaOpts: { ui: 'bdd', timeout: 120_000, require: ['./src/hooks/reset-app.ts'] },

  // The per-test step record the skills read. A run's records describe that
  // run only, so they are cleared when it starts.
  onPrepare: () => {
    rmSync(STEPS_DIR, { recursive: true, force: true });
  },
  beforeTest: () => startStepRecord(),
  afterTest: (test, context, result) => writeStepRecord(test, context, result),
};
