// Mocha and WDIO have no `test.step`. This is the equivalent the skills rely on:
// Page Object action methods wrap their body in one named step, and the titles
// become the repro steps of a failed run (/report-bug) and the steps of a Qase
// case (the /from-issue records artifact).
//
// Steps are recorded per test and written to disk by the `record-steps` root
// hook. A step called inside another step is folded into the outer one, so a
// composed action that calls a stepped Component method still reads as one step.

export interface StepEntry {
  title: string;
  status: 'passed' | 'failed';
  durationMs: number;
}

let steps: StepEntry[] = [];
let depth = 0;

export function resetSteps(): void {
  steps = [];
  depth = 0;
}

export function recordedSteps(): StepEntry[] {
  return [...steps];
}

export async function step<T>(title: string, fn: () => Promise<T>): Promise<T> {
  if (depth > 0) return fn();

  depth++;
  const start = Date.now();
  try {
    const result = await fn();
    steps.push({ title, status: 'passed', durationMs: Date.now() - start });
    return result;
  } catch (error) {
    steps.push({ title, status: 'failed', durationMs: Date.now() - start });
    throw error;
  } finally {
    depth--;
  }
}
