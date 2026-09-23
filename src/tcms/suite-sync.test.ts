import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { caseTitle, mapToCase } from './case-mapper';
import { loadRecords, logicalKey, runSuiteSync } from './suite-sync';
import type { RemoteCase, TcmsCase, TcmsSeam, TestRecord } from './types';

// Hands out one id per suite path (1, 2, …) and answers listCases from what a test
// says the backend already holds, keyed by that id.
class FakeSeam implements TcmsSeam {
  nextCaseId = 100;
  upserts: { suiteId: number; title: string }[] = [];
  archived: number[] = [];
  private readonly suiteIds = new Map<string, number>();
  private nextSuiteId = 1;

  constructor(private readonly remote: Map<number, RemoteCase[]> = new Map()) {}

  async ensureSuitePath(path: string[]): Promise<number> {
    const key = path.join(' › ');
    const existing = this.suiteIds.get(key);
    if (existing !== undefined) return existing;
    const id = this.nextSuiteId++;
    this.suiteIds.set(key, id);
    return id;
  }
  async listCases(suiteId: number): Promise<RemoteCase[]> {
    return this.remote.get(suiteId) ?? [];
  }
  async upsertCase(suiteId: number, c: TcmsCase): Promise<number> {
    this.upserts.push({ suiteId, title: c.title });
    return this.nextCaseId++;
  }
  async archiveCase(caseId: number): Promise<void> {
    this.archived.push(caseId);
  }
}

const record = (title: string, overrides: Partial<TestRecord> = {}): TestRecord => ({
  title,
  acText: `AC for ${title}`,
  user: 'no-auth',
  tags: [],
  bucket: 'Negative',
  feature: 'login',
  contextLabel: 'no auth',
  jira: [{ key: 'OR-1', url: 'https://x/browse/OR-1' }],
  steps: ['Open the login screen from the menu', 'Submit credentials for "bod@example.com"'],
  ...overrides,
});

const KEY = (title: string) => `login › no auth › Negative › ${title}`;
const titles = (seam: FakeSeam) => seam.upserts.map((u) => u.title);

test('every record is upserted into its suite', async () => {
  const seam = new FakeSeam();
  const out = await runSuiteSync([record('a'), record('b')], seam);
  assert.deepEqual(titles(seam), ['a', 'b']);
  assert.deepEqual(out.synced, [KEY('a'), KEY('b')]);
  assert.deepEqual(out.archived, []);
});

test('a case the records no longer describe is removed', async () => {
  const seam = new FakeSeam(
    new Map([
      [
        1,
        [
          { id: 7, title: 'a' },
          { id: 8, title: 'gone' },
        ],
      ],
    ]),
  );
  const out = await runSuiteSync([record('a')], seam);
  assert.deepEqual(seam.archived, [8]);
  assert.deepEqual(out.archived, [8]);
});

test('a case renamed by hand in the backend is removed, so the records win', async () => {
  const seam = new FakeSeam(new Map([[1, [{ id: 7, title: 'a — renamed in Qase by a person' }]]]));
  await runSuiteSync([record('a')], seam);
  assert.deepEqual(titles(seam), ['a']);
  assert.deepEqual(seam.archived, [7]);
});

test('a suite no record mentions is left alone', async () => {
  const seam = new FakeSeam(
    new Map([
      [1, [{ id: 7, title: 'a' }]],
      [2, [{ id: 9, title: 'a test in another feature' }]],
    ]),
  );
  const out = await runSuiteSync([record('a')], seam);
  assert.deepEqual(out.archived, []);
});

test('records in two suites reconcile independently', async () => {
  const seam = new FakeSeam(
    new Map([
      [1, [{ id: 7, title: 'a' }]],
      [2, [{ id: 9, title: 'stale in the other bucket' }]],
    ]),
  );
  const out = await runSuiteSync([record('a'), record('b', { bucket: 'Edge' })], seam);
  assert.deepEqual(out.archived, [9]);
  assert.equal(out.synced.length, 2);
});

test("steps become case steps, with the AC as the last step's expected result", () => {
  const c = mapToCase(record('a'));
  assert.deepEqual(c.steps, [
    { action: 'Open the login screen from the menu', expected: '' },
    { action: 'Submit credentials for "bod@example.com"', expected: 'AC for a' },
  ]);
});

test('an expected failure names its defect in the case description', () => {
  const c = mapToCase(
    record('a', {
      expectedFailure: {
        key: 'OR-4',
        url: 'https://x/browse/OR-4',
        reason: 'accepts any password',
      },
    }),
  );
  assert.match(c.description, /Expected failure — locked to OR-4 .*: accepts any password/);
});

test('a trailing tag is stripped from the case title, and an email at the end is not', () => {
  assert.equal(
    caseTitle('alice@example.com is rejected as locked out @smoke'),
    'alice@example.com is rejected as locked out',
  );
  // A title may END with an email — it must survive untouched.
  assert.equal(
    caseTitle('the lockout message wins over a wrong password for alice@example.com'),
    'the lockout message wins over a wrong password for alice@example.com',
  );
  assert.equal(caseTitle('no tags here'), 'no tags here');
});

test('tags reach the backend as labels, without the grep @', () => {
  const c = mapToCase(record('a @smoke', { tags: ['@smoke'] }));
  assert.equal(c.title, 'a');
  assert.deepEqual(c.tags, ['smoke']);
});

test('tagging a test does not change the case it reconciles to', async () => {
  const seam = new FakeSeam(new Map([[1, [{ id: 7, title: 'a' }]]]));
  await runSuiteSync([record('a @smoke', { tags: ['@smoke'] })], seam);
  assert.deepEqual(titles(seam), ['a']);
  assert.deepEqual(seam.archived, []);
});

function recordsDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'records-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), JSON.stringify(body));
  }
  return dir;
}

test('loadRecords rejects a record with no jira ticket', () => {
  const dir = recordsDir({ 'login.json': { records: [record('a', { jira: [] })] } });
  assert.throws(() => loadRecords(dir), /missing a non-empty "jira" array/);
});

test('loadRecords rejects a record with no steps array', () => {
  const bad = { ...record('a') } as Partial<TestRecord>;
  delete bad.steps;
  const dir = recordsDir({ 'login.json': { records: [bad] } });
  assert.throws(() => loadRecords(dir), /missing its "steps" array/);
});

test('loadRecords rejects two records that map to one case', () => {
  const dir = recordsDir({
    // Same behaviour, one of them tagged: both map to the case title "a".
    'login.json': { records: [record('a')] },
    'other.json': { records: [record('a @smoke', { tags: ['@smoke'] })] },
  });
  assert.throws(() => loadRecords(dir), /Duplicate record/);
});

test('loadRecords returns nothing for a missing directory', () => {
  assert.deepEqual(loadRecords(join(tmpdir(), 'does-not-exist-records')), []);
});

test('logicalKey is the suite path plus the title', () => {
  assert.equal(logicalKey(['login', 'no auth', 'Edge'], 'a'), 'login › no auth › Edge › a');
});
