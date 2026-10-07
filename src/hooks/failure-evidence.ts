// What a failed test leaves behind, so diagnosing it does not start by
// reproducing it.
//
// A failure used to leave the error and nothing else: every diagnosis this week
// began by rebuilding the scenario in a throwaway spec to see the screen. The
// screen was there all along — it just was not kept. On a device that costs
// minutes, so this writes, per failed test:
//
//   screenshot.png   what the screen looked like when the assertion gave up
//   page-source.xml  the tree behind it, which is where "element not found"
//                    turns into "it is there, under a different name"
//   failure.json     the error, the platform, the app and the moment
//
// Always on: a failure is rare and the capture costs a second, which is the
// opposite trade from the assertion audit. It can never fail a test — every
// call is guarded, and a capture that throws is reported in the file it managed
// to write, or not at all.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appId } from '../app';
import { currentPlatform } from '../utils/platform';

export const FAILURES_ROOT = join('test-results', 'failures');

export function failureDirFor(platform: string, title: string): string {
  const slug = title.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 120);
  return join(FAILURES_ROOT, platform, slug);
}

export async function captureFailure(title: string, error: unknown): Promise<void> {
  const platform = currentPlatform();
  const dir = failureDirFor(platform, title);
  const notes: string[] = [];

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return; // nowhere to write: the run's result is what matters, not this
  }

  try {
    const png = await driver.takeScreenshot();
    writeFileSync(join(dir, 'screenshot.png'), Buffer.from(png, 'base64'));
  } catch (e) {
    notes.push(`screenshot unavailable: ${(e as Error).message}`);
  }

  try {
    writeFileSync(join(dir, 'page-source.xml'), await driver.getPageSource());
  } catch (e) {
    notes.push(`page source unavailable: ${(e as Error).message}`);
  }

  const failure = {
    title,
    platform,
    app: appId(),
    when: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error ?? 'unknown failure'),
    stack: error instanceof Error ? error.stack : undefined,
    // The steps this test ran are in test-results/steps/<platform>/, written by
    // the same afterTest. Named rather than copied: one record, one owner.
    steps: join('test-results', 'steps', platform),
    // The Appium server log covers the whole run, not this test, and it carries
    // session tokens — it inherits the confidentiality of the app under test,
    // so it is pointed at and never copied into an evidence folder.
    appiumLog: join('logs'),
    notes,
  };
  try {
    writeFileSync(join(dir, 'failure.json'), JSON.stringify(failure, null, 2));
  } catch {
    // nothing left to do: the test's own failure is already reported
  }
}
