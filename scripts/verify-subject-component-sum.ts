/**
 * verify-subject-component-sum.ts — proof for fix/master-subject-component-sum.
 *
 * Bug: services/subjectValidation.ts validateSubject checked each of
 * CQ/MCQ/practical against full marks but never their sum, so CQ 70 +
 * MCQ 30 + Practical 25 = 125 could be saved against full marks 100
 * (and the same gap existed in the exam-assignment validation). The fix
 * requires the present components to sum to exactly fullMarks, with a
 * message naming the mismatch. Existing bad subjects are NOT repaired
 * in code — they are listed for the principal (see report).
 *
 * Run: npx tsx scripts/verify-subject-component-sum.ts
 */
import { validateSubject } from '../services/subjectValidation';
import { validateExamSubjectAssignment } from '../services/examValidation';
import type { Subject } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const subjectBase = (extra: Partial<Subject> = {}): Partial<Subject> => ({
  name: 'Mathematics', classLevel: 'Class 6', fullMarks: 100, passMarks: 33, ...extra,
});

// (1) CQ 70 + MCQ 30 + Practical 25 = 125 vs full 100 -> invalid, named.
{
  const r = validateSubject(subjectBase({
    hasCQ: true, cqMarks: 70, cqPassMarks: 23,
    hasMCQ: true, mcqMarks: 30, mcqPassMarks: 10,
    hasPractical: true, practicalMarks: 25, practicalPassMarks: 8,
  }));
  check('subject 70+30+25 vs 100 rejected', !r.isValid && !!r.errors.componentSum, JSON.stringify(r.errors));
  check('error names the mismatch', /125/.test(r.errors.componentSum || '') && /100/.test(r.errors.componentSum || ''), r.errors.componentSum);
}

// (2) CQ 70 + MCQ 30 = 100 -> valid.
check('subject 70+30 vs 100 valid', validateSubject(subjectBase({
  hasCQ: true, cqMarks: 70, cqPassMarks: 23, hasMCQ: true, mcqMarks: 30, mcqPassMarks: 10,
})).isValid);

// (3) CQ-only 70 vs 100 -> invalid (components must sum to full).
check('subject CQ-only 70 vs 100 rejected',
  validateSubject(subjectBase({ hasCQ: true, cqMarks: 70, cqPassMarks: 23 })).errors.componentSum !== undefined);

// (4) CQ-only 100 vs 100 -> valid.
check('subject CQ-only 100 vs 100 valid',
  validateSubject(subjectBase({ hasCQ: true, cqMarks: 100, cqPassMarks: 33 })).isValid);

// (5) No components at all -> valid (simple total subject).
check('subject with no components valid', validateSubject(subjectBase()).isValid);

// (6) Exam assignment: same sum rule.
const asgBase = (extra: Record<string, unknown> = {}) => ({
  examId: 'ex-1', classId: 'Class 6', subjectId: 'sub-1',
  fullMarks: 100, passMarks: 33, ...extra,
});
const exams = [{ id: 'ex-1', name: 'Midterm', category: 'Term', academicYear: '2026', status: 'SCHEDULED' }] as never[];
const subjects = [{ id: 'sub-1', status: 'ACTIVE' }] as never[];
const classes = [{ id: 'Class 6', name: 'Class 6', status: 'ACTIVE' }] as never[];
{
  const r = validateExamSubjectAssignment(
    asgBase({ cqFullMarks: 70, mcqFullMarks: 30, practicalFullMarks: 25 }),
    [], exams, subjects, classes, [], [], [],
  );
  check('assignment 70+30+25 vs 100 rejected', !r.isValid && !!r.errors.componentSum, JSON.stringify(r.errors));
}
check('assignment 70+30 vs 100 valid',
  validateExamSubjectAssignment(asgBase({ cqFullMarks: 70, mcqFullMarks: 30 }), [], exams, subjects, classes, [], [], []).isValid);
check('assignment with no components valid',
  validateExamSubjectAssignment(asgBase({}), [], exams, subjects, classes, [], [], []).isValid);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
