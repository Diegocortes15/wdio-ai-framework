// Writes one JSON file per test under test-results/steps/<platform>/: its full
// title, spec file, outcome, the steps it ran and the error. This is the run
// record the skills read — /from-issue copies the step titles into the TCMS
// records artifact, and /report-bug turns a failed test's steps into repro steps.
//
// The records are kept PER PLATFORM, and each platform's run clears only its own
// directory. `npm test` is two WDIO runs, and while they shared one directory the
// second erased the first: a test that runs on Android only (itOn) had no record
// left by the time the skills read them, and two platforms' records of the same
// test overwrote each other anyway, since the file name comes from the title.
//
// Called from WDIO's beforeTest/afterTest hooks, not a Mocha root hook: a Mocha
// afterEach never sees the test's error, and WDIO's hooks swallow their own
// exceptions — which is right for a recorder. Recording must never fail a test.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Frameworks } from '@wdio/types';
import { recordedSteps, resetSteps } from '../utils/step';
import { type Platform, currentPlatform } from '../utils/platform';

export const STEPS_ROOT = join('test-results', 'steps');

export function stepsDirFor(platform: Platform): string {
  return join(STEPS_ROOT, platform);
}

/**
 * The platform a config targets, for `onPrepare` — which runs before any session
 * exists, so it cannot ask the driver. Throws rather than guessing: records
 * written to the wrong platform's directory are worse than a run that stops.
 */
export function platformOfCapability(capability: { platformName?: unknown }): Platform {
  const name = String(capability?.platformName ?? '').toLowerCase();
  if (name === 'android') return 'android';
  if (name === 'ios') return 'ios';
  throw new Error(
    `Cannot tell which platform this config targets: platformName=${name || '(none)'}`,
  );
}

export function startStepRecord(): void {
  resetSteps();
}

// The Mocha context carries the full title (every enclosing describe). WDIO's
// own test object only has the test's title and its immediate parent, and two
// tests with the same title in different describes would overwrite each other.
interface MochaContext {
  test?: { fullTitle?: () => string };
}

export function writeStepRecord(
  test: Frameworks.Test,
  context: MochaContext | undefined,
  result: Frameworks.TestResult,
): void {
  const title = context?.test?.fullTitle?.() ?? `${test.parent} ${test.title}`;
  const dir = stepsDirFor(currentPlatform());
  mkdirSync(dir, { recursive: true });
  const record = {
    title,
    file: test.file,
    state: result.passed ? 'passed' : 'failed',
    steps: recordedSteps(),
    error: result.error instanceof Error ? result.error.message : result.error,
  };
  const fileName = `${title.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 150)}.json`;
  writeFileSync(join(dir, fileName), JSON.stringify(record, null, 2));
}
