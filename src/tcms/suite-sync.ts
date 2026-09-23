import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TcmsSeam, TestRecord } from './types';
import { mapToCase } from './case-mapper';
import { QaseClient } from './qase-client';
import { qaseConfig } from './qase-env';

// Catalogue sync, driven by the committed records alone (ADR-0041). The web
// repository also read a run report here, to attach steps and statuses; this
// one has no CI run to read — the records carry the steps instead.
//
// It keeps no local id store (ADR-0043 supersedes ADR-0041's qase-map.json): for
// every suite the records cover, it asks the backend what that suite holds and
// reconciles. A case whose test is gone is removed; a case renamed by hand in the
// backend is removed and recreated from the records, because the records are the
// source of truth.

const SEP = ' › ';

export interface SuiteSyncOutcome {
  synced: string[]; // suite path + title, one per record
  archived: number[]; // case ids removed
}

export function logicalKey(suitePath: string[], title: string): string {
  return [...suitePath, title].join(SEP);
}

export async function runSuiteSync(
  records: TestRecord[],
  seam: TcmsSeam,
): Promise<SuiteSyncOutcome> {
  const outcome: SuiteSyncOutcome = { synced: [], archived: [] };
  // Titles the records want, per suite the records touch.
  const wanted = new Map<number, Set<string>>();

  for (const record of records) {
    const c = mapToCase(record);
    const suiteId = await seam.ensureSuitePath(c.suitePath);
    await seam.upsertCase(suiteId, c);
    outcome.synced.push(logicalKey(c.suitePath, c.title));
    const titles = wanted.get(suiteId) ?? new Set<string>();
    titles.add(c.title);
    wanted.set(suiteId, titles);
  }

  // Remove only inside the suites the records cover. A suite no record mentions
  // is left alone: this sync has no opinion about tests it was not given.
  for (const [suiteId, titles] of wanted) {
    for (const remote of await seam.listCases(suiteId)) {
      if (titles.has(remote.title)) continue;
      await seam.archiveCase(remote.id);
      outcome.archived.push(remote.id);
    }
  }
  return outcome;
}

// ---- records loader + CLI ----

interface RecordsFile {
  records: TestRecord[];
}

export function loadRecords(dir: string): TestRecord[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return []; // no records dir → nothing to sync
  }
  const all: TestRecord[] = [];
  const seen = new Map<string, string>();
  for (const f of files) {
    let parsed: RecordsFile;
    try {
      parsed = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as RecordsFile;
    } catch (e) {
      throw new Error(`Failed to parse records file ${join(dir, f)}: ${e}`);
    }
    for (const r of parsed.records) {
      if (!Array.isArray(r.jira) || r.jira.length === 0) {
        throw new Error(`Record "${r.title}" in ${f} is missing a non-empty "jira" array`);
      }
      if (!Array.isArray(r.steps)) {
        throw new Error(`Record "${r.title}" in ${f} is missing its "steps" array`);
      }
      // Two records with one logical key would fight over the same case forever.
      const c = mapToCase(r);
      const key = logicalKey(c.suitePath, c.title);
      const other = seen.get(key);
      if (other) throw new Error(`Duplicate record "${key}" in ${other} and ${f}`);
      seen.set(key, f);
    }
    all.push(...parsed.records);
  }
  return all;
}

async function main(): Promise<void> {
  const cfg = qaseConfig();
  if (!cfg) {
    console.log('TCMS off (QASE_API_TOKEN/QASE_PROJECT_CODE unset) — skipping Qase sync.');
    return;
  }
  const recordsDir = '.tcms/records';
  const records = loadRecords(recordsDir);
  // With no records every case in every touched suite would count as orphaned —
  // and no suite is touched, so nothing would happen anyway. Say so and stop:
  // an empty records directory is far more likely a bad checkout than a deletion.
  if (records.length === 0) {
    console.log(`No records under ${recordsDir} — nothing to sync, nothing removed.`);
    return;
  }
  const outcome = await runSuiteSync(records, new QaseClient(cfg));
  console.log(
    `Qase suite sync: ${outcome.synced.length} synced, ${outcome.archived.length} removed.`,
  );
}

if (process.argv[1]?.endsWith('suite-sync.ts')) {
  main().catch((err) => {
    // Qase is downstream: a mirror outage never fails the build. But in this repository
    // the sync is the whole CI job, so a swallowed failure would be a green check that
    // lies — `::warning::` surfaces it on the GitHub run instead.
    console.error(`::warning::Qase suite sync failed: ${err}`);
    process.exitCode = 0;
  });
}
