// The only place that knows which platform a test is running on.
//
// A locator that differs between platforms is a two-key map, not an `if`: the
// map's type makes a missing platform a COMPILE error, and `npm run typecheck`
// runs in CI without a device (ADR-0044). An `if (driver.isIOS)` cannot be
// checked that way — the missing branch returns undefined and fails at runtime,
// on someone else's machine.
//
// Everything here reads `driver` when it is CALLED, never at module load: a
// Page Object's locators are getters for exactly this reason.

export type Platform = 'android' | 'ios';

export function currentPlatform(): Platform {
  return driver.isAndroid ? 'android' : 'ios';
}

export function isPlatform(platform: Platform): boolean {
  return currentPlatform() === platform;
}

/** The value for the platform under test. Both keys are required. */
export function byPlatform<T>(map: Record<Platform, T>): T {
  return map[currentPlatform()];
}

/**
 * A value that exists on ONE platform, with the reason it does not exist on the
 * other. Reading it from the wrong platform throws instead of returning
 * something plausible — a test that reaches it is asserting on an element the
 * app does not have, and should say so loudly.
 */
export function onlyOn<T>(platform: Platform, value: T, reason: string): T {
  if (!isPlatform(platform)) {
    throw new Error(`This exists only on ${platform}: ${reason}`);
  }
  return value;
}
