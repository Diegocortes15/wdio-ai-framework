// Two questions decide whether a green test is evidence (wdio-conventions.md,
// "A green test is not yet evidence"): is the value it asserts unique on that
// screen, and would it still pass with its Act step deleted?
//
// A person answering those by hand is how two false positives shipped here, so
// the run answers what can be answered mechanically. It captures, per test:
//
//   - every readable string on screen BEFORE it ran, for the second question;
//   - every readable string AFTER, with the element's position and its path
//     down the tree, for the first;
//   - where each element lookup RESOLVED TO, so a duplicated value can be
//     traced to the element the test actually read, not merely counted.
//
// The last one is what turns a question into an answer: two elements can hold
// "5" — the cart badge and a row's quantity — and a test that reads the wrong
// one passes. Matching the lookup's rectangle against the candidates' says
// which one it was.
//
// It still never decides. A duplicated value can be asserted correctly, and a
// value present before the act may be exactly what the test means to re-check.
//
// Off by default: the page-source reads and one rectangle per lookup cost real
// seconds. The generation skill turns it on for the run that produces a PR.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentPlatform } from '../utils/platform';

export const AUDIT_ROOT = join('test-results', 'assertion-audit');
export const auditEnabled = (): boolean => process.env.AUDIT_ASSERTIONS === '1';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenElement extends Rect {
  text: string;
  /** Ancestors from the root down, e.g. `TabBar > Button[Cart-tab-item] > StaticText`. */
  path: string;
}

export interface Lookup extends Partial<Rect> {
  selector: string;
}

const ATTRIBUTE = /(?:text|content-desc|name|label|value)="([^"]*)"/g;
const NAME_ATTR = /(?:content-desc|name)="([^"]*)"/;
const number = (attributes: string, key: string): number =>
  Number((attributes.match(new RegExp(`${key}="(-?\\d+)"`)) ?? [])[1] ?? NaN);

/**
 * Where an element is. iOS spells it x/y/width/height; Android spells the same
 * thing `bounds="[x1,y1][x2,y2]"`, and reading only the first form is why the
 * first version of this traced every iOS lookup and no Android one.
 */
function rectOf(attributes: string): Rect {
  const bounds = attributes.match(/bounds="\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]"/);
  if (bounds) {
    const [, x1, y1, x2, y2] = bounds.map(Number);
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }
  return {
    x: number(attributes, 'x'),
    y: number(attributes, 'y'),
    width: number(attributes, 'width'),
    height: number(attributes, 'height'),
  };
}

/**
 * Every readable string in the tree, one entry per element that carries it,
 * with where it sits and what contains it.
 *
 * Per element is the whole point: on iOS a StaticText usually repeats its string
 * in name, label AND value, so counting attributes reported "No Items" three
 * times for one element on screen and buried the real duplicates in noise.
 */
export function parseScreen(source: string): ScreenElement[] {
  const elements: ScreenElement[] = [];
  const stack: string[] = [];
  const tokens = source.matchAll(/<(\/?)([A-Za-z_][\w.-]*)((?:\s[^>]*?)?)(\/?)>/g);
  for (const [, closing, tag, attributes = '', selfClosing] of tokens) {
    if (closing) {
      stack.pop();
      continue;
    }
    const label = (attributes.match(NAME_ATTR) ?? [])[1];
    const short = tag.replace(/^(XCUIElementType|android\.widget\.|android\.view\.)/, '');
    const node = label ? `${short}[${label}]` : short;
    const own = new Set(
      [...attributes.matchAll(ATTRIBUTE)].map((m) => m[1].trim()).filter((t) => t.length > 0),
    );
    const path = [...stack, node].join(' > ');
    for (const text of own) {
      elements.push({ text, path, ...rectOf(attributes) });
    }
    if (!selfClosing) stack.push(node);
  }
  return elements;
}

const beforeTexts = new Map<string, string[]>();
const lookups = new Map<string, Lookup[]>();
let current = '';

export async function captureBefore(title: string): Promise<void> {
  if (!auditEnabled()) return;
  current = title;
  lookups.set(title, []);
  const screen = await driver
    .getPageSource()
    .then(parseScreen)
    .catch(() => [] as ScreenElement[]);
  beforeTexts.set(
    title,
    screen.map((e) => e.text),
  );
}

/**
 * Where one element lookup resolved to, recorded from WDIO's command hook. The
 * rectangle is what ties it to a candidate on screen; a stale or detached
 * element simply has none, and the audit then says it could not tell.
 */
export async function recordLookup(selector: string, elementId: string): Promise<void> {
  if (!auditEnabled() || !current) return;
  const rect = await driver.getElementRect(elementId).catch(() => undefined);
  lookups.get(current)?.push({ selector, ...(rect ?? {}) });
}

export async function captureAfter(title: string): Promise<void> {
  if (!auditEnabled()) return;
  const dir = join(AUDIT_ROOT, currentPlatform());
  mkdirSync(dir, { recursive: true });
  const after = await driver
    .getPageSource()
    .then(parseScreen)
    .catch(() => [] as ScreenElement[]);
  const record = {
    title,
    before: beforeTexts.get(title) ?? [],
    after,
    lookups: lookups.get(title) ?? [],
  };
  beforeTexts.delete(title);
  lookups.delete(title);
  current = '';
  const fileName = `${title.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 150)}.json`;
  writeFileSync(join(dir, fileName), JSON.stringify(record));
}
