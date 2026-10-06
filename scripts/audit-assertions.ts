// Answers what can be answered mechanically about a green test, from what a run
// captured (AUDIT_ASSERTIONS=1) plus the literals a spec asserts.
//
// For every value a test asserts:
//   AMBIGUOUS    — more than one element on screen carries it at the end. When the
//                  run also recorded which element the test's locator resolved to,
//                  the report names it and the rivals, which is the answer rather
//                  than the question.
//   PRE-EXISTING — the value was already on screen before the test acted, so the
//                  assertion could hold with the Act step deleted.
//
// Neither is a verdict: a duplicated value can be asserted correctly, and a test
// may mean to re-check something already present. This removes the counting and
// the tracing, not the judgement.
//
// Usage: npm run audit:assertions -- tests/cart/cart.spec.ts

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const AUDIT_ROOT = join('test-results', 'assertion-audit');

interface ScreenElement {
  text: string;
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Lookup {
  selector: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
interface AuditRecord {
  title: string;
  before: string[];
  after: ScreenElement[];
  lookups: Lookup[];
}

const TEST_START = /\b(it|itFails|itOn)\s*\(/g;
// Single characters count: the value that hid the worst false positive here was
// the digit 5. Anything without a letter or digit is punctuation, and noise.
const STRING_LITERAL = /'([^'\\\n]+)'|"([^"\\\n]+)"|`([^`\\\n]+)`/g;
const MEANINGFUL = /[A-Za-z0-9]/;

// A parameterized title is a template literal; its static fragments are what a
// run's recorded title still contains.
const longestFragment = (title: string): string =>
  title
    .split(/\$\{[^}]*\}/)
    .map((part) => part.trim())
    .sort((a, b) => b.length - a.length)[0] ?? title;

function testBlocks(spec: string): { title: string; literals: string[] }[] {
  const starts = [...spec.matchAll(TEST_START)].map((m) => ({ index: m.index ?? 0, kind: m[1] }));
  return starts.map(({ index, kind }, i) => {
    const body = spec.slice(index, starts[i + 1]?.index ?? spec.length);
    const literals = [...body.matchAll(STRING_LITERAL)]
      .map((m) => m[1] ?? m[2] ?? m[3])
      .filter((literal) => MEANINGFUL.test(literal));
    // it(title, …) / itFails(key, title, …) / itOn(platform, reason, title, …)
    const titleAt = kind === 'itOn' ? 2 : kind === 'itFails' ? 1 : 0;
    return { title: literals[titleAt] ?? '(unknown test)', literals: literals.slice(titleAt + 1) };
  });
}

// A raw path is "AppiumAUT > Application[…] > Window > Other > Other > Other > …",
// which nobody reads. Keep what distinguishes one candidate from another — a
// named node, or a container type that means something — and collapse the rest.
const STRUCTURAL =
  /^(Table|Cell|CollectionView|ScrollView|TabBar|NavigationBar|Button|ListView|RecyclerView|ViewGroup)/;
function readablePath(path: string): string {
  const nodes = path
    .split(' > ')
    .filter((n) => !/^(AppiumAUT|Application|Window|hierarchy)/.test(n));
  const kept: string[] = [];
  for (const node of nodes) {
    if (node.includes('[') || STRUCTURAL.test(node)) kept.push(node);
    else if (kept[kept.length - 1] !== '…') kept.push('…');
  }
  return kept.join(' > ');
}

const sameRect = (element: ScreenElement, lookup: Lookup): boolean =>
  lookup.x === element.x &&
  lookup.y === element.y &&
  lookup.width === element.width &&
  lookup.height === element.height;

function report(record: AuditRecord, literals: string[]): string[] {
  const lines: string[] = [];
  for (const literal of [...new Set(literals)]) {
    const candidates = record.after.filter((e) => e.text === literal);
    if (candidates.length > 1) {
      const read = candidates.filter((c) => record.lookups.some((l) => sameRect(c, l)));
      const rivals = candidates.filter((c) => !read.includes(c));
      lines.push(`      AMBIGUOUS: "${literal}" is on ${candidates.length} elements`);
      if (read.length === 1) {
        lines.push(`        the test read:  ${readablePath(read[0].path)}`);
        for (const rival of rivals)
          lines.push(`        also on screen: ${readablePath(rival.path)}`);
      } else {
        for (const c of candidates) lines.push(`        candidate: ${readablePath(c.path)}`);
        lines.push(
          `        (no lookup matched one of them — prove the locator where the candidates differ)`,
        );
      }
    }
    if (candidates.length > 0 && record.before.includes(literal)) {
      lines.push(
        `      PRE-EXISTING: "${literal}" was on screen before the test acted — would it pass with the Act deleted?`,
      );
    }
  }
  return lines;
}

const specs = process.argv.slice(2);
if (specs.length === 0) {
  console.error('usage: npm run audit:assertions -- <spec file> [...]');
  process.exit(64);
}
const platforms = existsSync(AUDIT_ROOT) ? readdirSync(AUDIT_ROOT) : [];
if (platforms.length === 0) {
  console.error(
    `No audit records under ${AUDIT_ROOT}. Run the spec with AUDIT_ASSERTIONS=1 first — the audit is off by default.`,
  );
  process.exit(65);
}

let findings = 0;
for (const platform of platforms) {
  const dir = join(AUDIT_ROOT, platform);
  const records: AuditRecord[] = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as AuditRecord);
  console.log(`\n=== ${platform} — ${records.length} test(s) captured ===`);
  for (const spec of specs) {
    for (const { title, literals } of testBlocks(readFileSync(spec, 'utf8'))) {
      const record = records.find((r) => r.title.includes(longestFragment(title)));
      if (!record) {
        console.log(`  ? ${title}\n      no record — skipped on this platform, or it did not run`);
        continue;
      }
      const lines = report(record, literals);
      findings += lines.filter((l) => l.includes('AMBIGUOUS') || l.includes('PRE-EXISTING')).length;
      if (lines.length) console.log(`  ! ${title}\n${lines.join('\n')}`);
    }
  }
}
console.log(`\n${findings} question(s) for the reviewer. None of them is a failure.`);
