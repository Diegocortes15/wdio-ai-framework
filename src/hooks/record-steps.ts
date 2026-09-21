// Writes one JSON file per test under test-results/steps/: its full title, spec
// file, outcome, the steps it ran and the error. This is the run record the
// skills read — /from-issue copies the step titles into the TCMS records
// artifact, and /report-bug turns a failed test's steps into repro steps.
//
// Called from WDIO's beforeTest/afterTest hooks, not a Mocha root hook: a Mocha
// afterEach never sees the test's error, and WDIO's hooks swallow their own
// exceptions — which is right for a recorder. Recording must never fail a test.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Frameworks } from '@wdio/types';
import { recordedSteps, resetSteps } from '../utils/step';

export const STEPS_DIR = join('test-results', 'steps');

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
  mkdirSync(STEPS_DIR, { recursive: true });
  const record = {
    title,
    file: test.file,
    state: result.passed ? 'passed' : 'failed',
    steps: recordedSteps(),
    error: result.error instanceof Error ? result.error.message : result.error,
  };
  const fileName = `${title.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 150)}.json`;
  writeFileSync(join(STEPS_DIR, fileName), JSON.stringify(record, null, 2));
}
