/**
 * verify-finalization-completeness.ts — proof for fix/master-finalization-completeness.
 *
 * Bug: services/examValidation.ts validateExamFinalization checked only
 * negative marks and marks exceeding the record's stored m.fullMarks —
 * never unmarked students/subjects, component excess, or absent
 * contradictions. An exam could be finalized with half the class
 * unmarked. The fix reports counts of students/subjects with no marks
 * and blocks finalization when either is non-zero, checks component
 * excess against the assignment's full marks (not the stored record
 * value), and flags absent-with-marks. Sole caller ExamManager passes
 * subjects so group-applicability is honoured.
 *
 * Run: npx tsx scripts/verify-finalization-completeness.ts
 */
import { validateExamFinalization } from '../services/examValidation';
import type { Exam, ExamSubjectAssignment, MarkRecord, Subject } from '../types';
import type { Student } from '../types/student';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const exam: Exam = { id: 'ex-1', name: 'Midterm', category: 'Term', academicYear: '2026', status: 'SCHEDULED' } as Exam;
const asg = (subjectId: string, extra: Partial<ExamSubjectAssignment> = {}): ExamSubjectAssignment => ({
  id: `es-${subjectId}`, examId: 'ex-1', academicYearId: 'ay-1', classId: 'Class 6',
  subjectId, fullMarks: 100, passMarks: 33, status: 'ACTIVE', ...extra,
} as ExamSubjectAssignment);
const student = (id: string, extra: Partial<Student> = {}): Student => ({
  id, studentId: id, name: `Student ${id}`, classLevel: 'Class 6',
  status: 'Active', group: 'General', ...extra,
} as Student);
const mark = (studentId: string, subjectId: string, obtained: number, extra: Partial<MarkRecord> = {}): MarkRecord => ({
  id: `m-${studentId}-${subjectId}`, studentId, subjectId, examId: 'ex-1',
  obtained, total: 100, fullMarks: 100, ...extra,
} as MarkRecord);
const subjects: Subject[] = [
  { id: 'sub-1', name: 'Bangla', classLevel: 'Class 6', fullMarks: 100, passMarks: 33, isOptional: false, order: 1 } as Subject,
  { id: 'sub-2', name: 'Math', classLevel: 'Class 6', fullMarks: 100, passMarks: 33, isOptional: false, order: 2 } as Subject,
];
const assignments = [asg('sub-1'), asg('sub-2')];
const students = [student('st-1'), student('st-2')];

// (1) Everything marked -> valid.
{
  const marks = [
    mark('st-1', 'sub-1', 80), mark('st-1', 'sub-2', 70),
    mark('st-2', 'sub-1', 60), mark('st-2', 'sub-2', 50),
  ];
  const r = validateExamFinalization(exam, assignments, marks, students, subjects);
  check('complete exam finalizes', r.isValid, JSON.stringify(r.errors));
}

// (2) One student missing one subject -> blocked, counts named.
{
  const marks = [mark('st-1', 'sub-1', 80), mark('st-1', 'sub-2', 70), mark('st-2', 'sub-1', 60)];
  const r = validateExamFinalization(exam, assignments, marks, students, subjects);
  check('missing mark blocks finalization', !r.isValid && !!r.errors.incompleteMarks, JSON.stringify(r.errors));
  check('counts named (1 student, 1 entry)', /1 জন/.test(r.errors.incompleteMarks || '') && /1টি/.test(r.errors.incompleteMarks || ''), r.errors.incompleteMarks);
}

// (3) Component excess vs the ASSIGNMENT, not the stored record:
//     CQ 60 > assignment cqFullMarks 50, while total 60 <= stored full 100.
{
  const asgCQ = [asg('sub-1', { cqFullMarks: 50, cqPassMarks: 17, mcqFullMarks: 50, mcqPassMarks: 17 }), asg('sub-2')];
  const marks = [
    mark('st-1', 'sub-1', 60, { obtainedCQ: 60, obtainedMCQ: 0 }), mark('st-1', 'sub-2', 70),
    mark('st-2', 'sub-1', 50, { obtainedCQ: 40, obtainedMCQ: 10 }), mark('st-2', 'sub-2', 50),
  ];
  const r = validateExamFinalization(exam, asgCQ, marks, students, subjects);
  check('CQ excess vs assignment blocks', !r.isValid && !!r.errors.excessiveMarks, JSON.stringify(r.errors));
}

// (4) Absent student with marks -> blocked.
{
  const marks = [
    mark('st-1', 'sub-1', 80), mark('st-1', 'sub-2', 70),
    mark('st-2', 'sub-1', 0, { isAbsent: true, obtained: 10 }), mark('st-2', 'sub-2', 50),
  ];
  const r = validateExamFinalization(exam, assignments, marks, students, subjects);
  check('absent-with-marks blocks', !r.isValid && !!r.errors.absentContradiction, JSON.stringify(r.errors));
}

// (5) Group: a Science-only subject does not count as missing for a General student.
{
  const sciSubjects: Subject[] = [
    { id: 'sub-1', name: 'Bangla', classLevel: 'Class 6', fullMarks: 100, passMarks: 33, isOptional: false, order: 1 } as Subject,
    { id: 'sub-2', name: 'Physics', classLevel: 'Class 6', fullMarks: 100, passMarks: 33, isOptional: false, order: 2, group: 'Science' } as Subject,
  ];
  const marks = [mark('st-1', 'sub-1', 80), mark('st-2', 'sub-1', 60)];
  const r = validateExamFinalization(exam, assignments, marks, students, sciSubjects);
  check('group-inapplicable subject is not missing', r.isValid, JSON.stringify(r.errors));
}

// (6) Over-full vs the assignment (stored record says 100, assignment says 70).
{
  const asg70 = [asg('sub-1', { fullMarks: 70 }), asg('sub-2', { fullMarks: 70 })];
  const marks = [
    mark('st-1', 'sub-1', 80), mark('st-1', 'sub-2', 70),
    mark('st-2', 'sub-1', 60), mark('st-2', 'sub-2', 50),
  ];
  const r = validateExamFinalization(exam, asg70, marks, students, subjects);
  check('over-full vs assignment blocks', !r.isValid && !!r.errors.excessiveMarks, JSON.stringify(r.errors));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
