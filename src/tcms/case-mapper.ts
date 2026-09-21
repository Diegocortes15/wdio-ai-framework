import type { TcmsCase, TcmsStep, TestRecord } from './types';

const NO_STEPS_ACTION = 'Automated test (no granular steps recorded)';

// Map a /from-issue record → a TcmsCase. Pure: no I/O, no Qase knowledge.
export function mapToCase(record: TestRecord): TcmsCase {
  return {
    suitePath: [record.feature, record.contextLabel, record.bucket],
    title: record.title,
    steps: toSteps(record.steps, record.acText),
    description: buildDescription(record),
    preconditions:
      record.user === 'no-auth'
        ? 'Starts logged out, on the app launch screen'
        : `Starts logged out; signs in as ${record.user}`,
    tags: record.tags,
  };
}

// One "Covers Jira <KEY> — <url>" line per ticket, the defect a test is locked
// to when there is one, then the AC text.
function buildDescription(record: TestRecord): string {
  const lines = record.jira.map((j) => `Covers Jira ${j.key} — ${j.url}`);
  if (record.expectedFailure) {
    const d = record.expectedFailure;
    lines.push(`Expected failure — locked to ${d.key} (${d.url}): ${d.reason}`);
  }
  return lines.length ? `${lines.join('\n')}\n\n${record.acText}` : record.acText;
}

// Step actions = the recorded step titles; the AC text is the expected outcome,
// attached to the LAST step. A test with no steps still yields one step.
function toSteps(stepTitles: string[], acText: string): TcmsStep[] {
  if (stepTitles.length === 0) return [{ action: NO_STEPS_ACTION, expected: acText }];
  return stepTitles.map((action, i) => ({
    action,
    expected: i === stepTitles.length - 1 ? acText : '',
  }));
}
