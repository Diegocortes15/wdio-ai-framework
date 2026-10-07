// Everything that does not depend on the platform. The two platform configs
// spread this and add one capability each (ADR-0044).
//
// Measured 2026-09-25: `specs`, `suites` AND `mochaOpts.require` are resolved
// relative to THIS FILE — a require of './src/hooks/…' was looked up under
// `config/src/hooks/…` and the run died before the first test. Paths used at
// runtime by Node itself (onPrepare's rmSync) are relative to the working
// directory, which is the project root.
import { rmSync } from 'node:fs';
import { captureAfter, captureBefore, recordLookup } from '../src/hooks/assertion-audit';
import { captureFailure } from '../src/hooks/failure-evidence';
import {
  platformOfCapability,
  startStepRecord,
  stepsDirFor,
  writeStepRecord,
} from '../src/hooks/record-steps';

// The Mocha context carries the full title; WDIO's own test object does not.
const fullTitleOf = (test: { parent?: string; title: string }, context: unknown): string => {
  const mocha = context as { test?: { fullTitle?: () => string } } | undefined;
  return mocha?.test?.fullTitle?.() ?? `${test.parent ?? ''} ${test.title}`.trim();
};

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

  // The per-test step records the skills read. A run's records describe that run
  // only, so they are cleared when it starts — but only this platform's, because
  // `npm test` is two runs and the second used to erase the first's.
  onPrepare: (_config, capabilities) => {
    const [capability] = capabilities as WebdriverIO.Capabilities[];
    rmSync(stepsDirFor(platformOfCapability(capability)), { recursive: true, force: true });
  },
  // The audit captures the screen before and after each test, for
  // `npm run audit:assertions`. It is off unless AUDIT_ASSERTIONS=1, because two
  // page-source reads per test cost real seconds on iOS.
  beforeTest: async (test, context) => {
    startStepRecord();
    await captureBefore(fullTitleOf(test, context));
  },
  // Every element lookup, and what it resolved to — the one thing that answers
  // "which element did this test actually read?", and the difference between
  // counting a duplicated value and explaining it. `findElements` is included
  // because a query over rows resolves through it.
  afterCommand: async (commandName, args, result) => {
    if (commandName !== 'findElement' && commandName !== 'findElements') return;
    // One lookup, two shapes: the protocol's W3C key for a single element, and
    // `elementId` on the objects WDIO hands back for a collection. Reading only
    // the first traced every `$` and no `$$` — and a row query is exactly a `$$`.
    const W3C = 'element-6066-11e4-a52e-4f735466cecf';
    const found = (Array.isArray(result) ? result : [result]) as (
      Record<string, string> | undefined
    )[];
    for (const element of found) {
      const elementId = element?.[W3C] ?? element?.elementId;
      if (elementId) await recordLookup(JSON.stringify(args), elementId);
    }
  },
  afterTest: async (test, context, result) => {
    const title = fullTitleOf(test, context);
    await captureAfter(title);
    // A failed test leaves its screen behind: diagnosing it should not start by
    // reproducing it. Always on — a failure is rare and the capture is cheap.
    if (!result.passed) await captureFailure(title, result.error);
    writeStepRecord(test, context, result);
  },
};
