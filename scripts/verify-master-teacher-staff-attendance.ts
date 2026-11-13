/**
 * Master audit F1 — staff attendance admin-only — self-check.
 *
 * Enforces the principal's 25-Oct-2026 rule (staff attendance is
 * admin-only) which the teacher template broke by granting
 * 'attendance.*' in full. Run: npx tsx scripts/verify-master-teacher-staff-attendance.ts
 *
 *  - 'staff.attendance.manage' sits outside the 'attendance.*'
 *    wildcard, so no 'attendance.*' grant can ever open it.
 *  - Teacher template grants only the enumerated student-attendance
 *    keys (view/create/edit/delete), never 'attendance.*'.
 *  - App.tsx staff_attendance route gates on 'staff.attendance.manage'.
 *  - AttendanceManager hides the Staff tab without that permission.
 *  - DailyAttendanceHub re-checks the permission inside
 *    handleSaveStaffAttendance, and the save writes ONLY teachers
 *    the admin explicitly marked — never a PRESENT default for the
 *    unmarked.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { permissionMatches } = await import('../services/authorization');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${(e as Error).message}`); }
};

// The teacher template block of services/rbac.ts (templateKey 'teacher'
// up to the next templateKey).
const teacherTemplateBlock = (src: string) => {
  const start = src.indexOf("templateKey: 'teacher'");
  assert.ok(start > -1, 'teacher template must exist');
  const end = src.indexOf('templateKey:', start + 10);
  return src.slice(start, end === -1 ? undefined : end);
};

check("'staff.attendance.manage' is outside the 'attendance.*' wildcard", () => {
  assert.strictEqual(permissionMatches('attendance.*', 'staff.attendance.manage'), false);
  assert.strictEqual(permissionMatches('attendance.*', 'attendance.view'), true);
});

check('teacher template no longer grants attendance.*', () => {
  const block = teacherTemplateBlock(readSource('services/rbac.ts'));
  // Only the permissions array counts — the comment above it explains
  // the removal and mentions the wildcard by name.
  const permStart = block.indexOf('permissions: [');
  assert.ok(permStart > -1, 'teacher template must have a permissions array');
  const perms = block.slice(permStart, block.indexOf(']', permStart));
  assert.ok(!perms.includes("'attendance.*'"), 'teacher template must not contain attendance.*');
  for (const key of ['attendance.view', 'attendance.create', 'attendance.edit', 'attendance.delete']) {
    assert.ok(perms.includes(`'${key}'`), `teacher template must keep ${key} (student attendance)`);
  }
});

check('App.tsx staff_attendance route gates on staff.attendance.manage', () => {
  const src = readSource('App.tsx');
  // The file has more than one 'staff_attendance' case label (nav
  // mapping + render switch) — take the render one, which mounts
  // AttendanceManager with initialSubTab="staff".
  const start = src.indexOf('initialSubTab="staff"');
  assert.ok(start > -1, 'staff_attendance render must exist');
  const caseStart = src.lastIndexOf("case 'staff_attendance':", start);
  const body = src.slice(caseStart, start);
  assert.ok(body.includes("hasPermission('staff.attendance.manage')"), 'route must gate on staff.attendance.manage');
  assert.ok(!body.includes("hasPermission('attendance.view')"), 'route must not pass on plain attendance.view');
});

check('AttendanceManager hides the Staff tab without the permission', () => {
  const src = readSource('components/attendance/AttendanceManager.tsx');
  assert.ok(src.includes("hasPermission('staff.attendance.manage')"), 'AttendanceManager must check staff.attendance.manage');
  assert.ok(src.includes('canManageStaffAttendance'), 'AttendanceManager must derive a canManageStaffAttendance flag');
});

check('Hub save re-checks admin and never defaults unmarked staff to PRESENT', () => {
  const src = readSource('components/attendance/DailyAttendanceHub.tsx');
  const start = src.indexOf('const handleSaveStaffAttendance');
  assert.ok(start > -1, 'handleSaveStaffAttendance must exist');
  const body = src.slice(start, src.indexOf('\n  };', start));
  assert.ok(body.includes("hasPermission('staff.attendance.manage')"), 'save must re-check staff.attendance.manage');
  assert.ok(!body.includes("|| { status: 'PRESENT' }"), 'save must not default unmarked staff to PRESENT');
  assert.ok(body.includes('staffAttendanceMap[teacher.id]'), 'save must build only from explicitly marked entries');
  // Load effect: unmarked teachers get no map entry (no PRESENT pre-fill).
  const loadStart = src.indexOf('// Load staff attendance for selectedDate');
  assert.ok(loadStart > -1, 'staff load effect must exist');
  const loadBody = src.slice(loadStart, src.indexOf('}, [selectedDate, teachers]);', loadStart));
  assert.ok(!loadBody.includes("status: 'PRESENT'"), 'staff load must not pre-fill PRESENT for unmarked teachers');
});

console.log(`\n--- ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  console.error('FAIL: master F1 staff-attendance self-check has failing checks.');
  process.exitCode = 1;
} else {
  console.log('--- ALL CHECKS PASSED ---');
}
