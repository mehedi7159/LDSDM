/**
 * verify-marksentry-builder-source.ts — proof for fix/master-marksentry-builder-source.
 *
 * Bug: MarksEntry validated typed marks against the Subject, while
 * buildUpsertMarkPayload validated against the Exam Assignment — and the
 * two diverge when the subject is edited after the exam was scheduled
 * (ExamManager copies the subject's marks into the assignment at
 * schedule time). The fix resolves one effective subject — the exam
 * assignment when one exists, else the subject — in
 * services/examService.ts resolveEffectiveSubject, and MarksEntry
 * validates, saves and displays against it, so both layers agree.
 *
 * Run: npx tsx scripts/verify-marksentry-builder-source.ts
 */
import { readFileSync } from 'node:fs';
import { buildUpsertMarkPayload } from '../services/examService';
import type { Exam, ExamSubjectAssignment, Subject } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// (1) Source: the shared resolver exists and MarksEntry uses it everywhere it validates.
const svc = read('services/examService.ts');
check('examService exports resolveEffectiveSubject', svc.includes('export function resolveEffectiveSubject'));
const entry = read('components/MarksEntry.tsx');
check('MarksEntry imports resolveEffectiveSubject', entry.includes('resolveEffectiveSubject'));
check('MarksEntry validates against effectiveSubject (flush)', !entry.includes('validateStudentMark(markData, currentSubject'));
check('MarksEntry validates against effectiveSubject (typing)', !entry.includes('validateStudentMark(updated, currentSubject'));
check('MarksEntry validates against effectiveSubject (row)', !entry.includes('validateStudentMark(mark, currentSubject'));
check('MarksEntry payload uses effective fullMarks', !entry.includes('total: currentSubject.fullMarks'));
check('MarksEntry header shows effective fullMarks', entry.includes('মোট নম্বর ({effectiveSubject?.fullMarks'));

// (2) Behaviour: the resolver prefers the assignment, else the subject.
const { resolveEffectiveSubject } = await import('../services/examService');
const subject: Subject = {
  id: 'sub-1', name: 'Bangla', classLevel: 'Class 6', fullMarks: 100, passMarks: 33,
  hasCQ: true, cqMarks: 70, cqPassMarks: 23, hasMCQ: true, mcqMarks: 30, mcqPassMarks: 10,
  isOptional: false, order: 1,
} as Subject;
const assignment: ExamSubjectAssignment = {
  id: 'es-1', examId: 'ex-1', academicYearId: 'ay-1', classId: 'Class 6',
  subjectId: 'sub-1', fullMarks: 70, passMarks: 24,
  cqFullMarks: 50, cqPassMarks: 17, mcqFullMarks: 20, mcqPassMarks: 7, status: 'ACTIVE',
} as ExamSubjectAssignment;
const eff = resolveEffectiveSubject(subject, assignment);
check('assignment wins: fullMarks 70', eff?.fullMarks === 70, JSON.stringify(eff));
check('assignment wins: cqMarks 50', eff?.cqMarks === 50, JSON.stringify(eff));
check('subject flags preserved', eff?.hasCQ === true && eff?.id === 'sub-1');
const eff2 = resolveEffectiveSubject(subject, undefined);
check('no assignment: subject fullMarks 100', eff2?.fullMarks === 100 && eff2?.cqMarks === 70);
check('no subject: undefined', resolveEffectiveSubject(undefined, assignment) === undefined);

// (3) Both layers now agree: assignment full 70 refuses 75 and accepts 65.
const exam: Exam = { id: 'ex-1', name: 'Midterm', category: 'Term', academicYear: '2026', status: 'SCHEDULED' } as Exam;
const base = { studentId: 'st-1', subjectId: 'sub-1', examId: 'ex-1' };
const over = buildUpsertMarkPayload({ ...base, obtained: 75 }, undefined, subject, assignment, exam);
check('builder refuses 75 against assignment 70', over.mark === null, JSON.stringify(over));
const ok = buildUpsertMarkPayload({ ...base, obtained: 65 }, undefined, subject, assignment, exam);
check('builder accepts 65 against assignment 70', ok.mark !== null && ok.mark?.total === 70, JSON.stringify(ok.mark));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
