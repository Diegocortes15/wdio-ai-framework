// Two questions decide whether a green test is evidence (wdio-conventions.md,
// "A green test is not yet evidence"): is the value it asserts unique on that
// screen, and would it still pass with its Act step deleted?
//
// A person answering those by hand is how two false positives shipped here. The
// counting half is mechanical, so this does it: the run captures every readable
// text on screen before and after each test, and `npm run audit:assertions`
// compares them against the literals the spec asserts. It reports; it never
// decides — a value that appears twice may still be asserted correctly, and a
// value present before the act may be exactly what the test means to re-check.
//
// Off by default: two page-source reads per test cost real seconds on iOS. The
// generation skill turns it on for the run that produces a pull request.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentPlatform } from '../utils/platform';

export const AUDIT_ROOT = join('test-results', 'assertion-audit');
export const auditEnabled = (): boolean => process.env.AUDIT_ASSERTIONS === '1';

/**
 * Every readable string in the tree, counted **per element**: Android's
 * text/content-desc, iOS's name/label/value. The per-element part is the whole
 * point — on iOS one StaticText usually carries the same string as its name, its
 * label AND its value, so counting attributes reported "No Items" three times
 * for a single element on screen and buried the real duplicates in noise.
 */
export async function readableTexts(): Promise<string[]> {
  const source = await driver.getPageSource();
  const texts: string[] = [];
  for (const [element] of source.matchAll(/<[A-Za-z_][\w.-]*\s[^>]*>/g)) {
    const own = new Set(
      [...element.matchAll(/(?:text|content-desc|name|label|value)="([^"]*)"/g)]
        .map((m) => m[1].trim())
        .filter((t) => t.length > 0),
    );
    texts.push(...own);
  }
  return texts;
}

const pending = new Map<string, string[]>();

export async function captureBefore(title: string): Promise<void> {
  if (!auditEnabled()) return;
  pending.set(title, await readableTexts().catch(() => []));
}

export async function captureAfter(title: string): Promise<void> {
  if (!auditEnabled()) return;
  const dir = join(AUDIT_ROOT, currentPlatform());
  mkdirSync(dir, { recursive: true });
  const record = {
    title,
    before: pending.get(title) ?? [],
    after: await readableTexts().catch(() => []),
  };
  pending.delete(title);
  const fileName = `${title.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 150)}.json`;
  writeFileSync(join(dir, fileName), JSON.stringify(record));
}
