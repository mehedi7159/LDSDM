/**
 * verify-trash-restore-paired.ts — scripted proof for the paired
 * trash-restore fix (Fix master #5).
 *
 * Bug: restoreFromTrash restored exactly one bin item. deleteTeacher
 * trashes the teacher record AND the login (user) record as two
 * separate bin items, so restoring the teacher left the login in
 * trash (and vice versa). There was also no duplicate check, so a
 * restore could silently create two records with the same id/code/
 * email/studentId.
 *
 * Rule under test (services/trashRestore.ts planTrashRestore):
 * restoring a teacher also restores the bin 'user' item with the
 * same id or email (and vice versa), in one plan; before restoring
 * anything, the live lists are checked for the same id / employee
 * code / email / studentId, and on a clash NOTHING is restored and
 * the plan carries a message asking which record keeps the
 * identifier.
 *
 * Run: npx tsx scripts/verify-trash-restore-paired.ts
 */
import { planTrashRestore, findPairedTrashItem } from '../services/trashRestore';
import type { TrashItem } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const binItem = (id: string, type: TrashItem['type'], data: any): TrashItem =>
  ({ id, type, data, deletedAt: '2026-11-13' } as TrashItem);
const teacher = { id: 't1', name: 'Karim', employeeCode: 'MDR-T004', email: 'karim@example.com' };
const user = { id: 'usr_9', name: 'Karim', email: 'karim@example.com' };
const emptyLive = { students: [], teachers: [], users: [], subjects: [], exams: [], classes: [], sections: [], transactions: [], notices: [] };

// (1) Teacher restore also restores the login with the same email.
{
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', user)];
  const plan = planTrashRestore(bin, bin[0], emptyLive);
  eq('(1) teacher+login pair restores both', plan.toRestore.length, 2);
  check('(1) no clash', plan.clash === null);
  eq('(1) paired flag', plan.paired, true);
}
// (2) Pairing also matches on identical data id.
{
  const sameIdUser = { ...user, id: 't1', email: 'other@example.com' };
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', sameIdUser)];
  eq('(2) same-id pair restores both',
    planTrashRestore(bin, bin[0], emptyLive).toRestore.length, 2);
}
// (3) Teacher with no login in the bin restores alone.
{
  const bin = [binItem('b1', 'teacher', teacher)];
  const plan = planTrashRestore(bin, bin[0], emptyLive);
  eq('(3) lone teacher restores alone', plan.toRestore.length, 1);
  eq('(3) not paired', plan.paired, false);
}
// (4) Restoring the login also restores the teacher (vice versa).
{
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', user)];
  const plan = planTrashRestore(bin, bin[1], emptyLive);
  eq('(4) login restore pulls the teacher too', plan.toRestore.length, 2);
  eq('(4) paired flag', plan.paired, true);
}
// (5) A live teacher holding the same employee code blocks the restore.
{
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', user)];
  const live = { ...emptyLive, teachers: [{ id: 't9', employeeCode: 'MDR-T004', email: 'someone@example.com' }] };
  const plan = planTrashRestore(bin, bin[0], live);
  eq('(5) code clash restores nothing', plan.toRestore.length, 0);
  check('(5) clash names the code', (plan.clash || '').includes('MDR-T004'));
  check('(5) clash asks which record keeps it', (plan.clash || '').includes('কোন রেকর্ডটি'));
}
// (6) A live teacher holding the same email blocks the restore.
{
  const bin = [binItem('b1', 'teacher', teacher)];
  const live = { ...emptyLive, teachers: [{ id: 't9', employeeCode: 'MDR-T099', email: 'KARIM@example.com' }] };
  const plan = planTrashRestore(bin, bin[0], live);
  eq('(6) email clash (case-insensitive) restores nothing', plan.toRestore.length, 0);
  check('(6) clash names the email', (plan.clash || '').toLowerCase().includes('karim@example.com'));
}
// (7) A live student holding the same studentId blocks the restore.
{
  const stu = { id: 's1', studentId: '2026174', name: 'Abu Bakr' };
  const bin = [binItem('b1', 'student', stu)];
  const live = { ...emptyLive, students: [{ id: 's9', studentId: '2026174' }] };
  const plan = planTrashRestore(bin, bin[0], live);
  eq('(7) studentId clash restores nothing', plan.toRestore.length, 0);
  check('(7) clash names the studentId', (plan.clash || '').includes('2026174'));
}
// (8) A clash on the PAIRED login blocks both — atomic.
{
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', user)];
  const live = { ...emptyLive, users: [{ id: 'usr_1', email: 'karim@example.com' }] };
  const plan = planTrashRestore(bin, bin[0], live);
  eq('(8) paired-user clash restores nothing (atomic)', plan.toRestore.length, 0);
  check('(8) clash reported', plan.clash !== null);
}
// (9) An unrelated user in the bin is NOT paired with the teacher.
{
  const stranger = { id: 'usr_7', name: 'Rahim', email: 'rahim@example.com' };
  const bin = [binItem('b1', 'teacher', teacher), binItem('b2', 'user', stranger)];
  const plan = planTrashRestore(bin, bin[0], emptyLive);
  eq('(9) unrelated user stays in the bin', plan.toRestore.length, 1);
  eq('(9) findPairedTrashItem finds nothing', findPairedTrashItem(bin, bin[0]), null);
}
// (10) Same id in the live list blocks the restore.
{
  const bin = [binItem('b1', 'teacher', teacher)];
  const live = { ...emptyLive, teachers: [{ id: 't1', employeeCode: 'MDR-T001', email: 'x@example.com' }] };
  const plan = planTrashRestore(bin, bin[0], live);
  eq('(10) same-id clash restores nothing', plan.toRestore.length, 0);
}

console.log(failures === 0 ? '\nALL TRASH-RESTORE-PAIRED CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
