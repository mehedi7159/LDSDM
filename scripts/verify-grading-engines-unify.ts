/**
 * verify-grading-engines-unify.ts — proof for fix/master-grading-engines-unify.
 *
 * Bug: the promotion engine (services/gradingEngine.ts
 * calculateStudentExamSummary, used only by promotionService) disagreed
 * with the display engine (services/utils.ts calculateTotalGPA, used by
 * every displayed result): the 4th-subject bonus was pushed as an extra
 * GPA-average element (five core 5.0s + 4th 5.0 -> 4.67, display says
 * 5.0 capped), optional subjects pushed their full grade point into the
 * average instead of only the excess over 2.0, and component (CQ/MCQ)
 * pass marks were not checked at all. The fix rewrites the promotion
 * engine to the display engine's rules exactly.
 *
 * The same student is run through both paths; they must agree on GPA,
 * grade and pass/fail in every case.
 *
 * Run: npx tsx scripts/verify-grading-engines-unify.ts
 */
import { calculateStudentExamSummary } from '../services/gradingEngine';
import { calculateTotalGPA } from '../services/utils';
import type { MarkRecord, Subject } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const sub = (id: string, name: string, extra: Partial<Subject> = {}): Subject => ({
  id, name, classLevel: 'Class 6', fullMarks: 100, passMarks: 33,
  isOptional: false, order: 1, ...extra,
} as Subject);
const mark = (studentId: string, subjectId: string, obtained: number, extra: Partial<MarkRecord> = {}): MarkRecord => ({
  id: `m-${studentId}-${subjectId}`, studentId, subjectId, examId: 'ex-1',
  obtained, total: 100, ...extra,
} as MarkRecord);

// Both engines on the same student: GPA, grade, pass must agree.
const both = (label: string, subjects: Subject[], marks: MarkRecord[]) => {
  const promo = calculateStudentExamSummary('st-1', marks, subjects);
  const shown = calculateTotalGPA(subjects, marks, 'st-1', 'ex-1');
  const agree = promo.gpa === shown.gpa && promo.overallGrade === shown.grade && promo.isPassed === !shown.isFail;
  check(`${label} — promotion ${promo.gpa}/${promo.overallGrade}/${promo.isPassed ? 'pass' : 'fail'} vs display ${shown.gpa}/${shown.grade}/${shown.isFail ? 'fail' : 'pass'}`,
    agree, `promotion=${JSON.stringify({ gpa: promo.gpa, grade: promo.overallGrade, pass: promo.isPassed })} display=${JSON.stringify(shown)}`);
  return { promo, shown };
};

// (1) Five core 5.0s + a 4th-subject 5.0: old promotion gave 4.67.
{
  const subjects = [1, 2, 3, 4, 5].map(i => sub(`c${i}`, `Core ${i}`));
  subjects.push(sub('fourth', 'Fourth', { isFourthSubject: true }));
  const marks = subjects.map(s => mark('st-1', s.id, 80));
  const { promo } = both('4th-subject 5.0', subjects, marks);
  check('4th-subject case is 5.0 capped', promo.gpa === 5.0, `gpa=${promo.gpa}`);
}

// (2) Optional subject: only the excess over 2.0 counts.
//     Core 80 (5.0) + 70 (4.0); optional 80 (5.0) -> (5+4+3)/2 = 6 -> 5.0 capped.
{
  const subjects = [sub('c1', 'Core 1'), sub('c2', 'Core 2'), sub('o1', 'Optional', { isOptional: true })];
  const marks = [mark('st-1', 'c1', 80), mark('st-1', 'c2', 70), mark('st-1', 'o1', 80)];
  const { promo } = both('optional excess-over-2.0', subjects, marks);
  check('optional case is 5.0 capped (not 4.67)', promo.gpa === 5.0, `gpa=${promo.gpa}`);
}

// (3) CQ fail: total 75/100 but CQ 20 < 23 pass — display fails the student.
{
  const subjects = [sub('c1', 'Bangla', { hasCQ: true, cqMarks: 70, cqPassMarks: 23 })];
  const marks = [mark('st-1', 'c1', 75, { obtainedCQ: 20 })];
  const { promo } = both('CQ component fail', subjects, marks);
  check('CQ-fail student fails with GPA 0', promo.gpa === 0 && !promo.isPassed, `gpa=${promo.gpa} pass=${promo.isPassed}`);
}

// (4) Plain pass: both agree on 4.5 / A.
{
  const subjects = [sub('c1', 'Core 1'), sub('c2', 'Core 2')];
  const marks = [mark('st-1', 'c1', 80), mark('st-1', 'c2', 70)];
  const { promo } = both('plain pass', subjects, marks);
  check('plain pass is 4.5 / A', promo.gpa === 4.5 && promo.overallGrade === 'A', `gpa=${promo.gpa} grade=${promo.overallGrade}`);
}

// (5) Absent in a core subject fails in both.
{
  const subjects = [sub('c1', 'Core 1'), sub('c2', 'Core 2')];
  const marks = [mark('st-1', 'c1', 80), mark('st-1', 'c2', 0, { isAbsent: true })];
  const { promo } = both('absent core subject', subjects, marks);
  check('absent core subject fails with GPA 0', promo.gpa === 0 && !promo.isPassed, `gpa=${promo.gpa} pass=${promo.isPassed}`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
