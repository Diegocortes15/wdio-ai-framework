// Answers the counting half of "A green test is not yet evidence", from what a
// run captured (AUDIT_ASSERTIONS=1) plus the literals a spec asserts.
//
// Two questions, two reports per test:
//   AMBIGUOUS — the value it asserts appears more than once on screen at the end.
//               The assertion may be reading a different element that happens to
//               hold the same text. Prove the locator where the candidates differ.
//   PRE-EXISTING — the value was already on screen before the test acted, so the
//               assertion could hold with the Act step deleted.
//
// Neither is a verdict: a duplicate value can be asserted correctly, and a test
// may legitimately re-check something that was already there. They are the two
// questions a reviewer would otherwise have to ask by hand, answered for them.
//
// Usage: npm run audit:assertions -- tests/cart/cart.spec.ts

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const AUDIT_ROOT = join('test-results', 'assertion-audit');

interface AuditRecord {
  title: string;
  before: string[];
  after: string[];
}

// A test block starts at it( / itFails( / itOn( and ends where the next one does.
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

function loadRecords(platform: string): AuditRecord[] {
  const dir = join(AUDIT_ROOT, platform);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as AuditRecord);
}

const count = (haystack: string[], needle: string) => haystack.filter((t) => t === needle).length;

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
  const records = loadRecords(platform);
  console.log(`\n=== ${platform} — ${records.length} test(s) captured ===`);
  for (const spec of specs) {
    for (const { title, literals } of testBlocks(readFileSync(spec, 'utf8'))) {
      const record = records.find((r) => r.title.includes(longestFragment(title)));
      if (!record) {
        console.log(`  ? ${title}\n      no record — skipped on this platform, or it did not run`);
        continue;
      }
      const lines: string[] = [];
      for (const literal of [...new Set(literals)]) {
        const after = count(record.after, literal);
        if (after > 1) {
          lines.push(
            `      AMBIGUOUS: "${literal}" appears ${after}× on screen at the end — prove the locator where the candidates differ`,
          );
        }
        if (after > 0 && count(record.before, literal) > 0) {
          lines.push(
            `      PRE-EXISTING: "${literal}" was already on screen before the test acted — would this pass with the Act deleted?`,
          );
        }
      }
      findings += lines.length;
      if (lines.length) console.log(`  ! ${title}\n${lines.join('\n')}`);
    }
  }
}
console.log(`\n${findings} question(s) for the reviewer. None of them is a failure.`);
