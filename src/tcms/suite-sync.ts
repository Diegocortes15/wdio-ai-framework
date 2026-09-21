import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { QaseMap, TcmsSeam, TestRecord } from './types';
import { mapToCase } from './case-mapper';
import { loadMap, logicalKey, orphanedIds, saveMap } from './map-store';
import { QaseClient } from './qase-client';
import { qaseConfig } from './qase-env';

// Catalogue sync, driven by the committed records alone (ADR-0041). The web
// repository also read a run report here, to attach steps and statuses; this
// one has no CI run to read — the records carry the steps instead.

export interface SuiteSyncOutcome {
  synced: string[]; // logical keys upserted
  archived: number[]; // case ids removed
  newMap: QaseMap;
}

export async function runSuiteSync(
  records: TestRecord[],
  oldMap: QaseMap,
  seam: TcmsSeam,
): Promise<SuiteSyncOutcome> {
  const outcome: SuiteSyncOutcome = { synced: [], archived: [], newMap: {} };

  for (const record of records) {
    const c = mapToCase(record);
    const key = logicalKey(c.suitePath, c.title);
    const suiteId = await seam.ensureSuitePath(c.suitePath);
    outcome.newMap[key] = await seam.upsertCase(suiteId, c, oldMap[key]);
    outcome.synced.push(key);
  }

  // Remove ONLY cases whose record no longer exists. Records drive existence.
  for (const id of orphanedIds(oldMap, Object.keys(outcome.newMap))) {
    await seam.archiveCase(id);
    outcome.archived.push(id);
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
      // Two records with one logical key would overwrite each other's case on every sync.
      const key = logicalKey([r.feature, r.contextLabel, r.bucket], r.title);
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
  const mapPath = 'qase-map.json';
  const records = loadRecords(recordsDir);
  const oldMap = loadMap(mapPath);
  // With no records, every mapped case would count as orphaned and be removed. That is far
  // more likely a missing directory or a bad checkout than a deliberate deletion of the suite.
  if (records.length === 0) {
    console.log(`No records under ${recordsDir} — nothing to sync, nothing removed.`);
    return;
  }
  const outcome = await runSuiteSync(records, oldMap, new QaseClient(cfg));
  saveMap(mapPath, outcome.newMap);
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
