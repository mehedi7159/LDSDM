/**
 * Portal / merit list / ID card empty-list fix — self-check (12 Nov 2026,
 * base commit fba1bb8).
 *
 * Follows the scripts/verify-*.ts pattern: node:assert + tsx, no test
 * framework. Run: npx tsx scripts/verify-portal-idcard-lookup.ts
 * (or npm run test:portal-idcard-lookup).
 *
 * Bug: components/StudentIDCardGenerator.tsx:43 and
 * components/WebResultView.tsx:81 filtered `s.status === 'active'`, but
 * students are stored (and normalised by services/studentService.ts:
 * normalizeStudent / hydrateStudentLifecycle) as 'Active' — so nothing
 * matched and the ID card generator showed 0 students, the public result
 * portal was empty for all exams, and the merit list was empty, while the
 * admin result generator (components/ResultView.tsx, `=== 'Active'`)
 * worked.
 *
 * Fix (lookup expressions only, no calculation/layout/PDF/route change):
 * case-insensitive status comparison
 * `s.status?.toLowerCase() === 'active'` in both classStudents filters.
 * WebResultView's merit list (processedClassResults) maps over the same
 * classStudents, so the one portal fix covers the portal list AND the
 * merit list.
 *
 * Class names: NO Bangla-vs-English mismatch in these two lookups — both
 * dropdowns use option value={c.name} (canonical English names, e.g.
 * 'Class 6', from context/AppContext.tsx defaultClasses) and both
 * filters compare s.class / s.classLevel against that same selectedClass.
 * (The blank-marksheet Bangla-class clue is a separate, still-open issue
 * in BlankMarksheetView, whose status filter already uses 'Active'.)
 *
 * The check extracts the REAL filter predicate from each component's
 * source (paren-balanced, so it tests the shipped expression, not a
 * copy) and runs it against fixture students.
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

/** Extract the `s => ...` body of the classStudents `.filter(...)` call. */
function extractClassStudentsPredicate(src: string, file: string): string {
  const anchor = src.indexOf('const classStudents');
  assert.ok(anchor > -1, `${file}: classStudents must exist`);
  const f = src.indexOf('.filter(s =>', anchor);
  assert.ok(f > -1, `${file}: classStudents must filter with .filter(s => ...)`);
  const open = src.indexOf('(', f);
  let depth = 0;
  let inner = '';
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) { inner = src.slice(open + 1, i); break; }
    }
  }
  assert.ok(inner.startsWith('s =>'), `${file}: filter must be an (s => ...) predicate, got: ${inner.slice(0, 60)}`);
  return inner.slice('s =>'.length).trim();
}

function predicateFor(rel: string): (s: any, selectedClass: string) => boolean {
  const src = readSource(rel);
  const body = extractClassStudentsPredicate(src, rel);
  // eslint-disable-next-line no-new-func
  return new Function('s', 'selectedClass', `return (${body});`) as any;
}

const CLASS = 'Class 6';
const fixtures = {
  activeCapital: { id: 's1', name: 'Rahim', classLevel: 'Class 6', status: 'Active' },
  activeLower: { id: 's2', name: 'Karim', class: 'Class 6', status: 'active' },
  former: { id: 's3', name: 'Jamal', classLevel: 'Class 6', status: 'Former' },
  inactive: { id: 's4', name: 'Salma', classLevel: 'Class 6', status: 'Inactive' },
  formerFlag: { id: 's5', name: 'Nusrat', classLevel: 'Class 6', status: 'Active', isFormer: true },
  wrongClass: { id: 's6', name: 'Hasan', classLevel: 'Class 7', status: 'Active' },
  noStatus: { id: 's7', name: 'Ayesha', classLevel: 'Class 6' },
};

function checkPredicate(rel: string, label: string) {
  const pred = predicateFor(rel);
  check(`${label}: student stored as 'Active' appears`, () => {
    assert.strictEqual(pred(fixtures.activeCapital, CLASS), true);
  });
  check(`${label}: legacy lowercase 'active' still appears`, () => {
    assert.strictEqual(pred(fixtures.activeLower, CLASS), true);
  });
  check(`${label}: 'Former' student is excluded`, () => {
    assert.strictEqual(pred(fixtures.former, CLASS), false);
  });
  check(`${label}: 'Inactive' student is excluded`, () => {
    assert.strictEqual(pred(fixtures.inactive, CLASS), false);
  });
  check(`${label}: 'Active' + isFormer is excluded`, () => {
    assert.strictEqual(pred(fixtures.formerFlag, CLASS), false);
  });
  check(`${label}: student of another class is excluded`, () => {
    assert.strictEqual(pred(fixtures.wrongClass, CLASS), false);
  });
  check(`${label}: student with no status is excluded (and does not throw)`, () => {
    assert.strictEqual(pred(fixtures.noStatus, CLASS), false);
  });
}

console.log('--- ID card generator (components/StudentIDCardGenerator.tsx) ---');
checkPredicate('components/StudentIDCardGenerator.tsx', 'ID card');

console.log('--- Public result portal + merit list (components/WebResultView.tsx) ---');
checkPredicate('components/WebResultView.tsx', 'Portal');

check('Merit list derives from the same classStudents (so the portal fix covers it)', () => {
  const src = readSource('components/WebResultView.tsx');
  assert.ok(src.includes('const list = classStudents.map(student =>'), 'processedClassResults must map over classStudents');
});

console.log('--- No strict lowercase comparison left in either lookup ---');

check('no `s.status === \'active\'` left in StudentIDCardGenerator.tsx', () => {
  assert.ok(!readSource('components/StudentIDCardGenerator.tsx').includes("s.status === 'active'"));
});
check('no `s.status === \'active\'` left in WebResultView.tsx', () => {
  assert.ok(!readSource('components/WebResultView.tsx').includes("s.status === 'active'"));
});

console.log('--- Class-name guard (no Bangla/English mismatch in these lookups) ---');

check('both class dropdowns use the canonical class name as the option value', () => {
  for (const rel of ['components/StudentIDCardGenerator.tsx', 'components/WebResultView.tsx']) {
    const src = readSource(rel);
    assert.ok(src.includes('<option key={c.id} value={c.name}>'), `${rel}: option value must be c.name`);
  }
});
check('both selectedClass defaults come from classes[].name', () => {
  assert.ok(readSource('components/StudentIDCardGenerator.tsx').includes("classes[0]?.name"), 'ID card selectedClass must default to classes[0]?.name');
  assert.ok(readSource('components/WebResultView.tsx').includes('classes[0].name'), 'portal selectedClass must default to classes[0].name');
});

console.log('--- npm script ---');

check('package.json exposes the verify script', () => {
  const pkg = JSON.parse(readSource('package.json'));
  assert.strictEqual(pkg.scripts['test:portal-idcard-lookup'], 'tsx scripts/verify-portal-idcard-lookup.ts', 'npm run test:portal-idcard-lookup must run this script');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: portal / ID card lookup self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
