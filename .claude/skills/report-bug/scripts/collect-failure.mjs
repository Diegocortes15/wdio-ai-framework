#!/usr/bin/env node
// Gathers what a failed run left behind into one JSON document: the failure, its
// evidence folder, the steps the test ran, the acceptance criterion it traces
// to, and what the same test did on the other platform.
//
// Locating facts is lookup, not judgement, so it is a script rather than prose.
// It reads only what the run wrote — it never re-runs anything, and it never
// guesses a fact it cannot find: a missing field says why it is missing.
//
// There is no evidence-collecting step after this one. The framework writes each
// failure's screenshot, page source and error into a single folder as it
// happens, so there is nothing left to assemble — which is the opposite of the
// web framework this skill came from, where evidence landed in hashed
// directories and had to be gathered.
//
// Usage: node collect-failure.mjs [--grep "<substring of the test title>"]
// Exit:  0 JSON on stdout · 3 no failures in the last run · 4 nothing was run

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FAILURES = join('test-results', 'failures');
const STEPS = join('test-results', 'steps');
const RECORDS = join('.tcms', 'records');

const grepAt = process.argv.indexOf('--grep');
const grep = grepAt > -1 ? process.argv[grepAt + 1] : undefined;

const dirs = (path) =>
  existsSync(path) ? readdirSync(path).filter((d) => statSync(join(path, d)).isDirectory()) : [];
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

if (!existsSync(FAILURES)) {
  console.error(
    `No ${FAILURES}. Run the suite first — this reads what a run wrote, and re-running it is yours to decide.`,
  );
  process.exit(4);
}

// Every failure of the last run, on every platform it ran on.
const failures = [];
for (const platform of dirs(FAILURES)) {
  for (const slug of dirs(join(FAILURES, platform))) {
    const dir = join(FAILURES, platform, slug);
    const file = join(dir, 'failure.json');
    if (existsSync(file)) failures.push({ ...readJson(file), slug, evidence: dir });
  }
}
if (failures.length === 0) {
  console.error('The last run recorded no failures. There is nothing to report.');
  process.exit(3);
}

const selected = grep ? failures.filter((f) => f.title.includes(grep)) : failures;
if (selected.length === 0) {
  console.error(`No failure matched --grep "${grep}". Titles seen: ${failures.map((f) => f.title).join(' | ')}`);
  process.exit(3);
}

// The step titles the test ran, written by the same run. Never invented: a repro
// step nobody executed is how a report sends someone down a path that does not exist.
function stepsOf(platform, title) {
  const dir = join(STEPS, platform);
  if (!existsSync(dir)) return { missing: 'no step records for this platform' };
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const record = readJson(join(dir, file));
    if (record.title === title) {
      // `file` comes from the same record: a report has to name the test that
      // failed, and the run is the only thing that knows where it lives.
      return { steps: (record.steps ?? []).map((s) => s.title ?? s), file: record.file };
    }
  }
  return { missing: 'no step record matched this test' };
}

// The acceptance criterion, from the records /from-issue committed. A run blocked
// before those are written legitimately has none — that is not an error.
function criterionOf(title) {
  if (!existsSync(RECORDS)) return { missing: 'no records artifact in this repository' };
  for (const file of readdirSync(RECORDS).filter((f) => f.endsWith('.json'))) {
    for (const record of readJson(join(RECORDS, file)).records ?? []) {
      if (title.includes(record.title)) {
        return {
          acceptanceCriterion: record.acText,
          jira: record.jira,
          platforms: record.platforms,
          expectedFailure: record.expectedFailure,
        };
      }
    }
  }
  return { missing: 'no-matching-record' };
}

// What the same test did on the other platform. This is the question a mobile
// report has to answer and a web one never had: the same assertion can be a
// defect on one platform and correct behaviour on the other.
function elsewhere(platform, title) {
  return dirs(STEPS)
    .filter((other) => other !== platform)
    .map((other) => {
      if (stepsOf(other, title).missing) {
        return { platform: other, outcome: 'did not run, or was skipped there' };
      }
      const failedThere = dirs(join(FAILURES, other)).some((slug) => {
        const file = join(FAILURES, other, slug, 'failure.json');
        return existsSync(file) && readJson(file).title === title;
      });
      return { platform: other, outcome: failedThere ? 'failed there too' : 'passed there' };
    });
}

const report = selected.map((failure) => ({
  title: failure.title,
  platform: failure.platform,
  app: failure.app,
  when: failure.when,
  error: failure.error,
  evidence: failure.evidence,
  notes: failure.notes ?? [],
  ...stepsOf(failure.platform, failure.title),
  ...criterionOf(failure.title),
  otherPlatforms: elsewhere(failure.platform, failure.title),
}));

console.log(JSON.stringify(report, null, 2));
