/**
 * Master audit F5 — Friday must not be a working day — self-check.
 * Run: npx tsx scripts/verify-master-friday-attendance.ts
 *
 * One rule, in the service: Friday is the weekly holiday, so Friday
 * records are excluded from every attendance summary (exam calc,
 * monthly summary, day summary) — the same rule the register already
 * applies when it skips Friday columns. The Hub also blocks Friday
 * at the date picker and in both save handlers, with a clear message.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  isFridayDate,
  calculateStudentAttendanceForExamFromRecords,
  getStudentMonthlySummaryFromRecords,
  summarizeStudentRecords,
  summarizeStaffRecords,
} = await import('../services/dailyAttendanceService');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

// 2026-11-13 is a Friday; 2026-11-12 and 2026-11-14 are not.
check('isFridayDate identifies Fridays', () => {
  assert.strictEqual(isFridayDate('2026-11-13'), true);
  assert.strictEqual(isFridayDate('2026-11-06'), true);
  assert.strictEqual(isFridayDate('2026-11-12'), false);
  assert.strictEqual(isFridayDate('2026-11-14'), false);
  assert.strictEqual(isFridayDate(''), false);
});

const fridayRec = { studentId: 's1', date: '2026-11-13', status: 'PRESENT', classLevel: 'Class 1' } as any;
const thursdayRec = { studentId: 's1', date: '2026-11-12', status: 'PRESENT', classLevel: 'Class 1' } as any;
const fridayStaff = { staffId: 't1', date: '2026-11-13', status: 'PRESENT' } as any;

check('exam calc excludes Friday records', () => {
  const r = calculateStudentAttendanceForExamFromRecords([fridayRec, thursdayRec], 's1');
  assert.strictEqual(r.workingDays, 1, 'only the Thursday record counts');
  assert.strictEqual(r.totalPresent, 1);
  assert.strictEqual(r.attendancePercentage, 100);
  const onlyFriday = calculateStudentAttendanceForExamFromRecords([fridayRec], 's1');
  assert.strictEqual(onlyFriday.workingDays, 0);
});

check('monthly summary excludes Friday records', () => {
  const r = getStudentMonthlySummaryFromRecords([fridayRec, thursdayRec], 's1', 2026, 11);
  assert.strictEqual(r.workingDays, 1);
  assert.strictEqual(r.presentDays, 1);
});

check('day summaries exclude Friday records', () => {
  const day = summarizeStudentRecords([fridayRec, thursdayRec], '2026-11-13', 'Class 1');
  assert.strictEqual(day.totalStudents, 0);
  assert.strictEqual(day.attendancePercentage, 0);
  const staff = summarizeStaffRecords([fridayStaff], '2026-11-13');
  assert.strictEqual(staff.total, 0);
});

check('Hub blocks Friday at the date picker and in both saves', () => {
  const src = readSource('components/attendance/DailyAttendanceHub.tsx');
  assert.ok(src.includes('isFridayDate'), 'Hub must use isFridayDate');
  const studentSave = src.slice(src.indexOf('const handleSaveStudentAttendance'), src.indexOf('const handleSaveStaffAttendance'));
  assert.ok(studentSave.includes('isFridayDate(selectedDate)'), 'student save must refuse Friday');
  const staffSave = src.slice(src.indexOf('const handleSaveStaffAttendance'), src.indexOf('const handleRetryStaffAttendanceSave'));
  assert.ok(staffSave.includes('isFridayDate(selectedDate)'), 'staff save must refuse Friday');
  assert.ok(src.includes('শুক্রবার'), 'the Friday block must show a clear Bangla message');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F5 friday-attendance self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
