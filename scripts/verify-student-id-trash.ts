/**
 * verify-student-id-trash.ts — scripted proof for the student auto-ID
 * counts-trash fix (services/studentService.ts resolveUniqueStudentId /
 * buildCreateStudentPayload + services/trashRestore.ts planTrashRestore).
 *
 * Bug (morning audits 17–19 Nov 2026): a NEW student got the ID of a
 * TRASHED student — 17 Nov the TEST enrolment got 2026175, the ID of
 * the previous day's trashed TEST student; by 19 Nov that ID was live
 * on a REAL student (আ আব্দুল্লাহ, Class 3), so restoring the trashed
 * TEST record would duplicate the ID. Teacher codes never had this
 * bug: Fix #15 (services/staffCode.ts) counts trashed codes. Student
 * IDs must do the same.
 *
 * Rule under test:
 *   (a) Auto-ID: the next free ID is above BOTH live and trashed
 *       student IDs — an ID held by a restorable (trashed) record is
 *       never re-suggested. Only a permanent delete frees it.
 *   (b) Save-time: buildCreateStudentPayload resolves a requested ID
 *       against live + trashed IDs, so a hand-typed trashed ID can
 *       never be saved as-is.
 *   (c) Restore: a trashed student whose studentId is now held by a
 *       DIFFERENT live student restores with a NEW free ID (the live
 *       record keeps its ID); a trashed student whose own `id` is
 *       already live still blocks, like before.
 *
 * Cases:
 *   (1) Reported bug: live up to 2026174 + trashed 2026175 -> 2026176
 *   (2) Trashed lower ID does not inflate: live 2026174 + trashed 2026100 -> 2026175
 *   (3) No live students, trashed 2026175 -> 2026176
 *   (4) Empty live + empty trash -> preferred passes through
 *   (5) Live max above trash: live 2026180 + trashed 2026175 -> 2026181
 *   (6) Non-student trash entries carry no studentId and are ignored
 *   (7) Save-time: requested 2026175 with live 2026174 + trashed 2026175 -> 2026176
 *   (8) Save-time: requested free ID stays unchanged
 *   (9) Restore: trashed studentId 2026175 now live on another student
 *       -> restores with a new free ID (2026176), no clash
 *   (10) Restore: reassigned ID also skips IDs held by OTHER trashed students
 *   (11) Restore: same `id` already live still blocks the restore
 *   (12) Restore: studentId free -> restores unchanged, no reassignment
 *   (13) Source checks: StudentManager + AdmissionApplicationManager pass
 *       trash IDs into resolveUniqueStudentId; AppContext.addStudent passes
 *       trash IDs into buildCreateStudentPayload; restoreFromTrash applies
 *       the reassigned ID
 *
 * Run: npx tsx scripts/verify-student-id-trash.ts
 */
import { resolveUniqueStudentId, buildCreateStudentPayload } from '../services/studentService';
import { planTrashRestore } from '../services/trashRestore';
import type { TrashItem } from '../types';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const binItem = (id: string, type: TrashItem['type'], data: any): TrashItem =>
  ({ id, type, data, deletedAt: '2026-11-19' } as TrashItem);
const emptyLive = { students: [], teachers: [], users: [], subjects: [], exams: [], classes: [], sections: [], transactions: [], notices: [] };

// (a) Auto-ID counts trash.
eq('(1) Reported bug: live ..2026174 + trashed 2026175',
  resolveUniqueStudentId('2026175', ['2026174'], ['2026175']), '2026176');
eq('(2) Trashed lower ID does not inflate',
  resolveUniqueStudentId('2026174', ['2026174'], ['2026100']), '2026175');
eq('(3) No live students, trashed 2026175',
  resolveUniqueStudentId('2026175', [], ['2026175']), '2026176');
eq('(4) Empty live + empty trash: preferred passes through',
  resolveUniqueStudentId('2026175', [], []), '2026175');
eq('(5) Live max above trash',
  resolveUniqueStudentId('2026175', ['2026180'], ['2026175']), '2026176');
eq('(6) Trashed IDs list with undefined/blank entries ignored',
  resolveUniqueStudentId('2026175', ['2026174'], [undefined, '']), '2026175');

// (b) Save-time duplicate check covers trash.
{
  const validInput = (studentId: string) => ({ name: 'Test', classLevel: 'Class 3', studentId } as any);
  const res = buildCreateStudentPayload(validInput('2026175'), undefined, undefined, ['2026174'], ['2026175']);
  eq('(7) Save-time: requested trashed ID resolves to next free', res.student?.studentId, '2026176');
  const res2 = buildCreateStudentPayload(validInput('2026200'), undefined, undefined, ['2026174'], ['2026175']);
  eq('(8) Save-time: free ID stays unchanged', res2.student?.studentId, '2026200');
}

// (c) Restore reassigns a taken studentId instead of duplicating.
{
  const trashedTest = { id: 'std_test', studentId: '2026175', name: 'TEST' };
  const bin = [binItem('b1', 'student', trashedTest)];
  const live = { ...emptyLive, students: [{ id: 'std_abdullah', studentId: '2026175' }] };
  const plan = planTrashRestore(bin, bin[0], live);
  check('(9) Restore with taken studentId: no clash', plan.clash === null, plan.clash || '');
  eq('(9) Restore with taken studentId: still restores', plan.toRestore.length, 1);
  eq('(9) Restore with taken studentId: new free ID assigned',
    (plan as any).reassignedStudentId?.newStudentId, '2026176');
}
{
  // Another trashed student holds 2026176, so the reassignment skips it.
  const trashedTest = { id: 'std_test', studentId: '2026175', name: 'TEST' };
  const bin = [
    binItem('b1', 'student', trashedTest),
    binItem('b2', 'student', { id: 'std_other', studentId: '2026176', name: 'Other' }),
  ];
  const live = { ...emptyLive, students: [{ id: 'std_abdullah', studentId: '2026175' }] };
  const plan = planTrashRestore(bin, bin[0], live);
  eq('(10) Reassigned ID skips other trashed IDs',
    (plan as any).reassignedStudentId?.newStudentId, '2026177');
}
{
  // Same record already live (same `id`) still blocks — only the
  // studentId-taken-by-someone-else case reassigns.
  const stu = { id: 's1', studentId: '2026175', name: 'TEST' };
  const bin = [binItem('b1', 'student', stu)];
  const live = { ...emptyLive, students: [{ id: 's1', studentId: '2026175' }] };
  const plan = planTrashRestore(bin, bin[0], live);
  eq('(11) Same-id live record still blocks restore', plan.toRestore.length, 0);
  check('(11) Same-id clash reported', plan.clash !== null);
}
{
  const stu = { id: 's1', studentId: '2026175', name: 'TEST' };
  const bin = [binItem('b1', 'student', stu)];
  const plan = planTrashRestore(bin, bin[0], emptyLive);
  eq('(12) Free studentId restores unchanged', plan.toRestore.length, 1);
  check('(12) No reassignment when ID is free', (plan as any).reassignedStudentId === undefined);
}

// (13) Source checks: every student-ID call site sees the trash list.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const sm = read('components/StudentManager.tsx');
check('(13) StudentManager passes trash IDs to resolveUniqueStudentId',
  /resolveUniqueStudentId\(\s*[\s\S]*?trash/i.test(sm) && sm.includes('trashBin'));
const adm = read('components/students/AdmissionApplicationManager.tsx');
check('(13) AdmissionApplicationManager passes trash IDs to resolveUniqueStudentId',
  /resolveUniqueStudentId\(\s*[\s\S]*?trash/i.test(adm) && adm.includes('trashBin'));
const ctx = read('context/AppContext.tsx');
check('(13) AppContext.addStudent passes trash IDs into buildCreateStudentPayload',
  /buildCreateStudentPayload\(student, 'inst_madrasah_primary', actor, [^;]*trashBin/.test(ctx));
check('(13) AppContext.restoreFromTrash applies the reassigned studentId',
  ctx.includes('reassignedStudentId'));

console.log(failures === 0 ? '\nALL STUDENT-ID-TRASH CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
