// Mocha has no expected-failure marker (Playwright's `test.fail()`). This is
// the equivalent ADR-0024 relies on: a test blocked by a filed application
// defect runs for real and asserts for real, the suite stays green while the
// defect lives, and the run turns red the day the defect is fixed.
//
// The defect key is a required argument, so an unattributed expected failure
// cannot be written. Applying it is a human decision, never the agent's own
// (ADR-0024): it lands only after a person has confirmed the defect.
//
// Two costs, both inherited from `test.fail()`:
// - It passes on ANY failure, not only the defect's. The key is what lets a
//   reader check the failure still matches the bug.
// - A failing wait costs its full timeout on every run.

const DEFECT_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

export function itFails(defect: string, title: string, fn: () => Promise<void>): Mocha.Test {
  if (!DEFECT_KEY.test(defect)) {
    throw new Error(`itFails needs a defect key like "OR-4", got "${defect}".`);
  }

  return it(`${title} [expected failure: ${defect}]`, async () => {
    try {
      await fn();
    } catch {
      return;
    }
    throw new Error(
      `Expected to fail because of ${defect}, but passed. If ${defect} is fixed, ` +
        `replace itFails with it and close the loop on the ticket.`,
    );
  });
}
