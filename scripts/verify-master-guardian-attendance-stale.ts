/**
 * Master audit F6 — guardian portal attendance tab goes stale —
 * self-check. Run: npx tsx scripts/verify-master-guardian-attendance-stale.ts
 *
 * The attendanceSummary memo read the non-reactive
 * dailyAttendanceService singleton and depended only on
 * [linkedStudent], so it never recomputed after cloud hydration.
 * It must use the reactive context array (dailyStudentAttendance)
 * with calculateStudentAttendanceForExamFromRecords, with the array
 * in the memo deps.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

check('GuardianPortal computes attendance from the reactive context array', () => {
  const src = readSource('components/GuardianPortal.tsx');
  assert.ok(src.includes('dailyStudentAttendance'), 'GuardianPortal must read dailyStudentAttendance from useApp()');
  assert.ok(src.includes('calculateStudentAttendanceForExamFromRecords'), 'GuardianPortal must use the FromRecords helper');
  const start = src.indexOf('const attendanceSummary = useMemo');
  assert.ok(start > -1, 'attendanceSummary memo must exist');
  const body = src.slice(start, src.indexOf(']);', start));
  assert.ok(body.includes('calculateStudentAttendanceForExamFromRecords(dailyStudentAttendance, linkedStudent.id)'), 'memo must compute from the context array');
  assert.ok(body.includes('dailyStudentAttendance'), 'memo deps must include dailyStudentAttendance');
  assert.ok(!body.includes('dailyAttendanceService.calculateStudentAttendanceForExam('), 'memo must not read the non-reactive singleton');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F6 guardian-attendance-stale self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
