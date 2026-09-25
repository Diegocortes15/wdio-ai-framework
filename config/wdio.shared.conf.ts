// Everything that does not depend on the platform. The two platform configs
// spread this and add one capability each (ADR-0044).
//
// Measured 2026-09-25: `specs`, `suites` AND `mochaOpts.require` are resolved
// relative to THIS FILE — a require of './src/hooks/…' was looked up under
// `config/src/hooks/…` and the run died before the first test. Paths used at
// runtime by Node itself (onPrepare's rmSync) are relative to the working
// directory, which is the project root.
import { rmSync } from 'node:fs';
import { STEPS_DIR, startStepRecord, writeStepRecord } from '../src/hooks/record-steps';

export const sharedConfig: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',

  specs: ['../tests/**/*.spec.ts'],
  // Named groups, so a feature can be run without typing a glob:
  //   npm run test:android -- --suite cart
  suites: {
    login: ['../tests/login/**/*.spec.ts'],
    cart: ['../tests/cart/**/*.spec.ts'],
  },
  maxInstances: 1,

  logLevel: 'warn',
  waitforTimeout: 10_000,
  connectionRetryTimeout: 180_000,
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
  mochaOpts: { ui: 'bdd', timeout: 120_000, require: ['../src/hooks/reset-app.ts'] },

  // The per-test step record the skills read. A run's records describe that
  // run only, so they are cleared when it starts.
  onPrepare: () => {
    rmSync(STEPS_DIR, { recursive: true, force: true });
  },
  beforeTest: () => startStepRecord(),
  afterTest: (test, context, result) => writeStepRecord(test, context, result),
};
