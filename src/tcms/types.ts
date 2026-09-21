// Tool-agnostic TCMS contracts. No Qase specifics leak here, so a future
// Xray/Zephyr/Kiwi client implements the same TcmsSeam.
//
// Ported from the web repository's catalogue half only. Run results are not
// mirrored here: there is no CI run of the suite to read them from (ADR-0041).

export type TcmsBucket = 'Positive' | 'Negative' | 'Edge';

// A Jira ticket a case traces back to. A case can cover more than one ticket
// over its lifetime, so provenance is an array — and it lives per record, not
// per records file, because one feature file holds tests from several tickets.
export interface JiraRef {
  key: string; // e.g. 'OR-1'
  url: string; // e.g. 'https://…/browse/OR-1'
}

export interface TcmsStep {
  action: string;
  expected: string; // '' when the step has no specific expected result
}

export interface TcmsCase {
  suitePath: string[]; // e.g. ['login', 'no auth', 'Negative'] — the suite tree
  title: string; // the test title — the case title within the leaf suite
  steps: TcmsStep[];
  description: string; // provenance + AC text
  preconditions: string;
  tags: string[];
}

// The defect a test is locked to with itFails (ADR-0024).
export interface ExpectedFailure {
  key: string; // e.g. 'OR-4'
  url: string;
  reason: string; // one plain sentence: what the application does that it should not
}

// One per-test record written by /from-issue (Step 11.5) to .tcms/records/<feature>.json.
export interface TestRecord {
  title: string; // the test title as written in the spec
  acText: string; // the AC text → the case's expected result
  user: string; // the account the test signs in as, or 'no-auth'
  tags: string[];
  bucket: TcmsBucket;
  feature: string; // suite root, e.g. 'login'
  contextLabel: string; // e.g. 'no auth'
  jira: JiraRef[];
  // The step titles the test ran, copied from its run record when /from-issue
  // executed it. The catalogue sync has no run of its own to read them from.
  steps: string[];
  expectedFailure?: ExpectedFailure;
}

// The seam every TCMS backend implements. qase-client.ts is the first impl.
export interface TcmsSeam {
  ensureSuitePath(path: string[]): Promise<number>; // create-as-needed → leaf suite id
  // `knownId` comes from the committed qase-map.json; when given, the case is updated
  // directly and the find-by-title search is skipped.
  upsertCase(suiteId: number, c: TcmsCase, knownId?: number): Promise<number>;
  archiveCase(caseId: number): Promise<void>; // remove a case whose test was removed
}

// qase-map.json shape: logical test key → Qase case id. Written by suite-sync,
// read by humans as a test ↔ case index. Never hand-edited.
export type QaseMap = Record<string, number>;
