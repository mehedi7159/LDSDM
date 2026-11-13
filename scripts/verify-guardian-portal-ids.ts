/**
 * Guardian portal student IDs — self-check (12 Nov 2026, base commit fba1bb8).
 *
 * Bug: the guardian portal's student list (PortalsServicesManager,
 * SUB-TAB 1 guardian_portal) showed the first 8 chars of the internal
 * Firestore document id — e.g. `h46k6fku`, `cn43cydd` — whenever a
 * student had no `studentId`, because the list line read
 * `{st.studentId || st.id.slice(0, 8)}`. The internal record id is
 * not a student ID number and must never be displayed as one.
 *
 * Fix: the list line renders the real `studentId`, and '—' when the
 * student has none (never an invented figure). The portal header in
 * the same tab already did `activeStudent.studentId || '—'` and is
 * asserted here as a no-regression guard.
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-guardian-portal-ids.ts
 * (or npm run test:guardian-portal-ids).
 *
 * The sample-record checks evaluate the ID expression taken from the
 * ACTUAL source line (not a copy of it), so they fail while the
 * `st.id.slice(0, 8)` fallback is still in the file and pass after.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
  }
}

// The guardian-portal student-list line, e.g.
//   {st.classLevel} • {st.studentId || '—'}
function guardianListIdExpression(): string {
  const src = readSource('components/portals/PortalsServicesManager.tsx');
  const start = src.indexOf("activeSubTab === 'guardian_portal'");
  assert.ok(start > -1, 'guardian_portal sub-tab must exist');
  const section = src.slice(start, src.indexOf('SUB-TAB 2', start));
  const line = section.split('\n').find(l => l.includes('st.classLevel') && l.includes('•'));
  assert.ok(line, 'guardian student-list line (class • id) must exist');
  const m = line.match(/\{st\.classLevel\} • \{([^}]+)\}/);
  assert.ok(m, `could not extract the displayed-ID expression from: ${line.trim()}`);
  return m[1].trim();
}

// Evaluate the real source expression against a sample student record.
function displayedId(expr: string, student: { id: string; studentId?: string }): unknown {
  return new Function('st', `return (${expr});`)(student);
}

const expr = guardianListIdExpression();
console.log(`--- Guardian list ID expression (from source): {${expr}} ---`);

check('list line never falls back to the internal record id', () => {
  assert.ok(!expr.includes('st.id'), 'displayed ID must not reference the internal record id (st.id)');
  assert.ok(!expr.includes('slice'), 'displayed ID must not slice the internal record id');
});

check('student with a real ID shows that ID (2026174)', () => {
  assert.strictEqual(displayedId(expr, { id: 'h46k6fku9x2q', studentId: '2026174' }), '2026174');
});

check('student with a real ID shows that ID, not the internal id', () => {
  assert.strictEqual(displayedId(expr, { id: 'cn43cydd7a1b', studentId: '2026175' }), '2026175');
});

check('student with no studentId shows "—", never a random string', () => {
  assert.strictEqual(displayedId(expr, { id: 'h46k6fku9x2q' }), '—');
  assert.strictEqual(displayedId(expr, { id: 'cn43cydd7a1b', studentId: '' }), '—');
});

console.log('--- Header (same tab) must stay correct ---');

check('portal header still shows studentId or "—" (no internal-id fallback)', () => {
  const src = readSource('components/portals/PortalsServicesManager.tsx');
  assert.ok(src.includes("{activeStudent.studentId || '—'}"), 'header must keep activeStudent.studentId || \'—\'');
});

check('GuardianPortal.tsx renders no internal id as a student ID', () => {
  const src = readSource('components/GuardianPortal.tsx');
  assert.ok(!src.includes('.id.slice'), 'GuardianPortal must not slice an internal id into view');
  assert.ok(!src.includes('studentId ||'), 'GuardianPortal must not fall back from studentId to an internal id');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:guardian-portal-ids'], 'tsx scripts/verify-guardian-portal-ids.ts', 'npm run test:guardian-portal-ids must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: guardian-portal student-ID self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
