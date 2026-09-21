import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { QaseMap } from './types';

const SEP = ' › ';

// Stable logical key for a test: its full suite path + title. It is the test's
// identity in Qase — there are no hand-written case ids. Renaming a test, or
// moving it to another bucket, therefore makes it a NEW case and removes the
// old one, with its history.
export function logicalKey(suitePath: string[], title: string): string {
  return [...suitePath, title].join(SEP);
}

export function loadMap(path: string): QaseMap {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8')) as QaseMap;
}

export function saveMap(path: string, map: QaseMap): void {
  // Sorted keys for a stable, diff-friendly committed file.
  const sorted: QaseMap = {};
  for (const key of Object.keys(map).sort()) sorted[key] = map[key];
  writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
}

// Case ids present in the old map whose key no current record produces.
export function orphanedIds(oldMap: QaseMap, currentKeys: string[]): number[] {
  const present = new Set(currentKeys);
  return Object.entries(oldMap)
    .filter(([key]) => !present.has(key))
    .map(([, id]) => id);
}
