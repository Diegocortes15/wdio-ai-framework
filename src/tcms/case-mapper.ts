import type { TcmsCase, TcmsStep, TestRecord } from './types';

const NO_STEPS_ACTION = 'Automated test (no granular steps recorded)';

// Tags live at the end of a test title because Mocha has no tag option. They are
// not part of the behaviour the case describes, and the case's identity is its
// title — so a tag inside the title would make adding or removing @smoke delete
// the case and create another one. Strip them here and send them as Qase tags.
const TRAILING_TAGS = /(\s+@[\w-]+)+\s*$/;

export function caseTitle(testTitle: string): string {
  return testTitle.replace(TRAILING_TAGS, '').trim();
}

// Map a /from-issue record → a TcmsCase. Pure: no I/O, no Qase knowledge.
export function mapToCase(record: TestRecord): TcmsCase {
  return {
    suitePath: [record.feature, record.contextLabel, record.bucket],
    title: caseTitle(record.title),
    steps: toSteps(record.steps, record.acText),
    description: buildDescription(record),
    preconditions:
      record.user === 'no-auth'
        ? 'Starts logged out, on the app launch screen'
        : `Starts logged out; signs in as ${record.user}`,
    // Qase tags are plain labels; the leading @ is a Mocha-grep artifact. The
    // platforms join them, so a filter in Qase answers "what does iOS cover".
    tags: [...record.tags.map((t) => t.replace(/^@/, '')), ...record.platforms],
  };
}

// One "Covers Jira <KEY> — <url>" line per ticket, the defect a test is locked
// to when there is one, then the AC text.
function buildDescription(record: TestRecord): string {
  const lines = record.jira.map((j) => `Covers Jira ${j.key} — ${j.url}`);
  if (record.platforms.length === 1) {
    const note = record.platformNote ? `: ${record.platformNote}` : '';
    lines.push(`Runs on ${record.platforms[0]} only${note}`);
  }
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
