/**
 * RC audit 2026-11-13 — Student Report shows 0 Active / no class-chart
 * bars — self-check. Run: npx tsx scripts/verify-rc-students-report.ts
 *
 * The count/badge fix (Batch F) is live and correct for canonical
 * 'Active' status, but the SAME view still reads a field the Student
 * model does not have — `s.class` — for its class filter, class
 * chart, class column and CSV export. Students carry `classLevel`
 * (often the Bangla spelling, e.g. 'শিশু'), so the chart counted
 * every class as 0 (no bars), picking a class filtered everything
 * out, and the class column was blank. The status filter had the same
 * shape of bug: dropdown values are lowercase 'active'/'inactive'
 * while stored status is 'Active'/'Inactive', so picking "সক্রিয়"
 * returned 0 rows.
 *
 * The fix reads `classLevel` through the existing classNames helpers
 * (canonical English name, so 'শিশু' matches 'Play') and compares
 * the status filter case-insensitively. The count/badge logic is
 * unchanged — this script guards it as a regression check.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classNamesMatch, canonicalClassName } from '../services/classNames';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

// Fixture shaped like live data: classLevel in Bangla for Play,
// canonical English elsewhere; canonical 'Active' status.
const students = [
  { id: 's1', name: 'A', classLevel: 'শিশু', status: 'Active' },
  { id: 's2', name: 'B', classLevel: 'শিশু', status: 'Active' },
  { id: 's3', name: 'C', classLevel: 'Class 4', status: 'Active' },
  { id: 's4', name: 'D', classLevel: 'Class 4', status: 'Inactive' },
];
const classes = [{ name: 'Play' }, { name: 'Class 4' }];

// The component's chart math, as fixed: count by canonical class name.
const chartCounts = (rows: typeof students, cls: typeof classes) => {
  const counts: Record<string, number> = {};
  rows.forEach(s => {
    const key = canonicalClassName((s as any).classLevel);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return cls.map(c => ({ name: c.name, count: counts[canonicalClassName(c.name)] || 0 }));
};

check('class chart renders bars for Bangla-spelled classLevel', () => {
  const dist = chartCounts(students, classes);
  assert.strictEqual(dist.find(d => d.name === 'Play')?.count, 2, 'Play must count the 2 শিশু students');
  assert.strictEqual(dist.find(d => d.name === 'Class 4')?.count, 2, 'Class 4 must count 2');
});

check('class filter matches Bangla classLevel against the English option', () => {
  assert.ok(classNamesMatch('শিশু', 'Play'));
  assert.ok(classNamesMatch('Class 4', 'Class 4'));
  assert.ok(!classNamesMatch('শিশু', 'Class 4'));
  const filtered = students.filter(s => classNamesMatch(s.classLevel, 'Play'));
  assert.strictEqual(filtered.length, 2);
});

check('status filter is case-insensitive (stored Active vs option active)', () => {
  const selectedStatus = 'active';
  const filtered = students.filter(s => s.status?.toLowerCase() === selectedStatus);
  assert.strictEqual(filtered.length, 3, '3 Active students must survive the active filter');
  assert.ok(!students.some(s => s.status === 'Inactive' && s.status?.toLowerCase() === selectedStatus));
});

check('report no longer reads the non-existent s.class field', () => {
  const src = readSource('components/StudentReportView.tsx');
  assert.ok(!/s\.class(?![a-zA-Z])/.test(src), 'no s.class read may remain (Student has classLevel, not class)');
  assert.ok(src.includes('classNamesMatch(s.classLevel, selectedClass)'), 'class filter must use classNamesMatch on classLevel');
  assert.ok(src.includes('canonicalClassName(s.classLevel)') || src.includes('canonicalClassName(s?.classLevel)'), 'chart must count by canonicalClassName(classLevel)');
  assert.ok(src.includes('canonicalClassName(c.name)'), 'chart must look up by canonicalClassName(c.name)');
  assert.ok(src.includes('{s.classLevel}'), 'table class cell must show s.classLevel');
  assert.ok(src.includes('"${s.classLevel}"'), 'CSV export must use s.classLevel');
});

check('status filter compares case-insensitively', () => {
  const src = readSource('components/StudentReportView.tsx');
  assert.ok(src.includes("s.status?.toLowerCase() !== selectedStatus"), 'status filter must lowercase the stored status');
  assert.ok(!src.includes('s.status !== selectedStatus'), 'exact-case status filter must be gone');
});

check('active count/badge still use the case-insensitive check (regression guard)', () => {
  const src = readSource('components/StudentReportView.tsx');
  const uses = (src.match(/s\.status\?\.toLowerCase\(\) === 'active'/g) || []).length;
  assert.ok(uses >= 2, `count + badge need at least 2 case-insensitive checks, found ${uses}`);
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: rc-students-report self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
