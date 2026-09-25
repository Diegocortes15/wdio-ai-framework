// A test for behaviour that exists on one platform only (ADR-0044).
//
// The bar is high on purpose: when the behaviour exists on both platforms and
// only the observation differs, the test stays single and `byPlatform` resolves
// the locator. `itOn` is for behaviour the other platform does not have.
//
// The reason is required, the way `itFails` requires a defect key: a skipped
// test that does not say why is a coverage hole nobody can audit. It is printed
// in the report, and it belongs in the test's record so Qase carries it too.
//
// The decision is made when the spec is LOADED, not while it runs: measured
// 2026-09-25, `driver` is already defined when a worker loads a spec, so a
// skipped test costs no app relaunch and the reporter prints one line for it
// instead of two.

import { type Platform, isPlatform } from './platform';

/** How the test gets registered when it DOES apply. Defaults to plain `it`. */
type Register = (title: string, fn: () => Promise<void>) => Mocha.Test;

export function itOn(
  platform: Platform,
  reason: string,
  title: string,
  fn: () => Promise<void>,
  // A test can carry two markers at once: "Android only" and "expected to fail
  // because of a defect". Pass `itFails(...)` here rather than nesting helpers.
  register: Register = it,
): Mocha.Test {
  if (!reason.trim()) {
    throw new Error(
      `itOn('${platform}', …) needs a reason: what the other platform does not have.`,
    );
  }

  // The platform tag goes at the END of the title, where @smoke lives, so the
  // TCMS mapper strips it with the other tags and the case identity is stable.
  const tagged = `${title} @${platform}`;
  const d = (globalThis as { driver?: WebdriverIO.Browser }).driver;

  if (d) {
    return isPlatform(platform) ? register(tagged, fn) : it.skip(`${tagged} — ${reason}`, fn);
  }

  // Fallback: no session yet at load time. Skip at runtime instead, which costs
  // the reset but still reports the test as skipped rather than passed.
  return register(tagged, async function (this: Mocha.Context) {
    if (!isPlatform(platform)) {
      this.skip();
    }
    await fn();
  } as () => Promise<void>);
}
