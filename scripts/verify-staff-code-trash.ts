/**
 * verify-staff-code-trash.ts — scripted proof for the staff-code
 * suggestion fix (Fix #15, services/staffCode.ts nextEmployeeCode).
 *
 * Bug (morning audit 2026-11-13): the add-teacher form suggested
 * MDR-T004, which belongs to a TRASHED test teacher. The old
 * suggestion scanned only the live staff list, so a trashed record's
 * code was invisible — but restoreFromTrash puts the record back with
 * its original code, so suggesting it would collide on restore.
 *
 * Rule under test: the suggested code is max(live codes, trashed
 * teacher codes) + 1 — a code held by a restorable (trashed) record
 * is never re-suggested. Only a permanent delete frees the code.
 *
 * Cases:
 *   (1) Reported bug: live T001-T003 + trashed teacher T004 -> T005
 *   (2) Trashed lower code does not inflate: live T001-T003 + trashed T002 -> T004
 *   (3) No live staff, trashed T004 -> T005
 *   (4) Empty live + empty trash -> T001
 *   (5) Live max above trash: live T005 + trashed T003 -> T006
 *   (6) Non-teacher trash entries (no code) are ignored
 *   (7) Trashed teacher with no/blank code is ignored
 *   (8) Trashed higher code wins over a live gap: live T001 + trashed T007 -> T008
 *   (9) Several trashed teachers: highest trashed code wins
 *   (10) Live list keeps its old max+1 behaviour when trash is empty
 *
 * Run: npx tsx scripts/verify-staff-code-trash.ts
 */
import { nextEmployeeCode } from '../services/staffCode';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const staff = (...codes: (string | undefined)[]) =>
  codes.map((employeeCode, i) => ({ id: `s${i}`, employeeCode }));
const trash = (...codes: (string | undefined)[]) =>
  codes.map((employeeCode, i) => ({ id: `t${i}`, type: 'teacher' as const, data: { employeeCode }, deletedAt: '2026-11-13' }));

eq('(1) Reported bug: live T001-T003 + trashed T004',
  nextEmployeeCode(staff('MDR-T001', 'MDR-T002', 'MDR-T003'), trash('MDR-T004')), 'MDR-T005');
eq('(2) Trashed lower code: live T001-T003 + trashed T002',
  nextEmployeeCode(staff('MDR-T001', 'MDR-T002', 'MDR-T003'), trash('MDR-T002')), 'MDR-T004');
eq('(3) No live staff, trashed T004',
  nextEmployeeCode([], trash('MDR-T004')), 'MDR-T005');
eq('(4) Empty live + empty trash',
  nextEmployeeCode([], []), 'MDR-T001');
eq('(5) Live max above trash: live T005 + trashed T003',
  nextEmployeeCode(staff('MDR-T005'), trash('MDR-T003')), 'MDR-T006');
eq('(6) Non-teacher trash entries ignored',
  nextEmployeeCode(
    staff('MDR-T001', 'MDR-T002'),
    [{ id: 'x1', type: 'student', data: { name: 'Test' }, deletedAt: '' },
     { id: 'x2', type: 'user', data: { name: 'Test' }, deletedAt: '' }] as any), 'MDR-T003');
eq('(7) Trashed teacher with no/blank code ignored',
  nextEmployeeCode(staff('MDR-T001'), trash(undefined, '')), 'MDR-T002');
eq('(8) Trashed higher code wins: live T001 + trashed T007',
  nextEmployeeCode(staff('MDR-T001'), trash('MDR-T007')), 'MDR-T008');
eq('(9) Several trashed teachers: trashed T004 + T006, live T001-T003',
  nextEmployeeCode(staff('MDR-T001', 'MDR-T002', 'MDR-T003'), trash('MDR-T004', 'MDR-T006')), 'MDR-T007');
eq('(10) Old max+1 behaviour, trash empty',
  nextEmployeeCode(staff('MDR-T001', 'MDR-T003'), []), 'MDR-T004');

console.log(failures === 0 ? '\nALL STAFF-CODE-TRASH CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
