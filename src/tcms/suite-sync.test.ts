import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { mapToCase } from './case-mapper';
import { loadRecords, runSuiteSync } from './suite-sync';
import type { TcmsCase, TcmsSeam, TestRecord } from './types';

class FakeSeam implements TcmsSeam {
  nextId = 100;
  upserts: { title: string; knownId?: number }[] = [];
  archived: number[] = [];
  async ensureSuitePath(): Promise<number> {
    return 1;
  }
  async upsertCase(_suiteId: number, c: TcmsCase, knownId?: number): Promise<number> {
    this.upserts.push({ title: c.title, knownId });
    return knownId ?? this.nextId++;
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

test('a new record creates a case and maps it', async () => {
  const seam = new FakeSeam();
  const out = await runSuiteSync([record('a')], {}, seam);
  assert.deepEqual(seam.upserts, [{ title: 'a', knownId: undefined }]);
  assert.deepEqual(out.newMap, { [KEY('a')]: 100 });
  assert.deepEqual(seam.archived, []);
});

test('a mapped record updates its known case instead of searching', async () => {
  const seam = new FakeSeam();
  const out = await runSuiteSync([record('a')], { [KEY('a')]: 7 }, seam);
  assert.deepEqual(seam.upserts, [{ title: 'a', knownId: 7 }]);
  assert.deepEqual(out.newMap, { [KEY('a')]: 7 });
});

test('a case whose record vanished is removed, and only that one', async () => {
  const seam = new FakeSeam();
  const out = await runSuiteSync([record('a')], { [KEY('a')]: 7, [KEY('gone')]: 8 }, seam);
  assert.deepEqual(seam.archived, [8]);
  assert.deepEqual(out.newMap, { [KEY('a')]: 7 });
});

test('renaming a test replaces its case: the old one is removed, a new one created', async () => {
  const seam = new FakeSeam();
  const out = await runSuiteSync([record('renamed')], { [KEY('a')]: 7 }, seam);
  assert.deepEqual(seam.archived, [7]);
  assert.deepEqual(out.newMap, { [KEY('renamed')]: 100 });
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

test('loadRecords rejects two records with the same logical key', () => {
  const dir = recordsDir({
    'login.json': { records: [record('a')] },
    'other.json': { records: [record('a')] },
  });
  assert.throws(() => loadRecords(dir), /Duplicate record/);
});

test('loadRecords returns nothing for a missing directory', () => {
  assert.deepEqual(loadRecords(join(tmpdir(), 'does-not-exist-records')), []);
});
