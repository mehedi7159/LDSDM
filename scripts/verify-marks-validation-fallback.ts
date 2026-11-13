/**
 * verify-marks-validation-fallback.ts — proof for fix/master-marks-validation-fallback.
 *
 * Bug: bulkUpdateMarks/updateMark in context/AppContext.tsx swallowed a
 * validation rejection from buildUpsertMarkPayload and saved the raw
 * record anyway (over-full marks, finalized exam, locked mark,
 * absent-with-marks). The fix skips rejected records, collects their
 * errors and returns them to the caller; only validated marks are written.
 *
 * The skip lives in AppContext (React state, not importable here), so the
 * script proves the two halves it can: (a) the builder really rejects the
 * four cases, and (b) the AppContext fallback lines are gone and the
 * error-returning shape is present.
 *
 * Run: npx tsx scripts/verify-marks-validation-fallback.ts
 */
import { readFileSync } from 'node:fs';
import { buildUpsertMarkPayload } from '../services/examService';
import type { Exam, ExamSubjectAssignment, MarkRecord, Subject } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

const subject: Subject = {
  id: 'sub-1', name: 'Masala', classLevel: 'Class 6', fullMarks: 50,
  passMarks: 17, isOptional: false, order: 1,
} as Subject;
const examSubject: ExamSubjectAssignment = {
  id: 'es-1', examId: 'ex-1', academicYearId: 'ay-1', classId: 'Class 6',
  subjectId: 'sub-1', fullMarks: 50, passMarks: 17, status: 'ACTIVE',
} as ExamSubjectAssignment;
const exam: Exam = { id: 'ex-1', name: 'Midterm', category: 'Term', academicYear: '2026', status: 'SCHEDULED' } as Exam;
const base = { studentId: 'st-1', subjectId: 'sub-1', examId: 'ex-1' };

// (1) Over-full mark (80 against full 50) is rejected by the builder.
const over = buildUpsertMarkPayload({ ...base, obtained: 80 }, undefined, subject, examSubject, exam);
check('over-full mark rejected (80 > 50)', over.mark === null && !!over.error, JSON.stringify(over));

// (2) Finalized exam is rejected.
const fin = buildUpsertMarkPayload(
  { ...base, obtained: 40 }, undefined, subject, examSubject,
  { ...exam, status: 'FINALIZED' } as Exam,
);
check('finalized exam rejected', fin.mark === null && !!fin.error, JSON.stringify(fin));

// (3) Locked mark record is rejected.
const locked = buildUpsertMarkPayload(
  { ...base, obtained: 40, status: 'LOCKED' } as Partial<MarkRecord> & { studentId: string; subjectId: string; examId: string },
  undefined, subject, examSubject, exam,
);
check('locked mark rejected', locked.mark === null && !!locked.error, JSON.stringify(locked));

// (4) Absent student with marks is rejected.
const absent = buildUpsertMarkPayload({ ...base, obtained: 10, isAbsent: true }, undefined, subject, examSubject, exam);
check('absent-with-marks rejected', absent.mark === null && !!absent.error, JSON.stringify(absent));

// (5) A valid mark still builds.
const valid = buildUpsertMarkPayload({ ...base, obtained: 40 }, undefined, subject, examSubject, exam);
check('valid mark builds (40/50)', valid.mark !== null && valid.mark?.obtained === 40, JSON.stringify(valid));

// (6) AppContext no longer falls back to the raw record.
const ctx = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');
check('updateMark fallback gone', !ctx.includes('mark || ({ ...markData'));
check('bulkUpdateMarks fallback gone', !ctx.includes('mark || (existing ?'));
check('bulkUpdateMarks returns errors', ctx.includes('return { marks: mergedMarks, errors }'));
check('updateMark returns error', ctx.includes('return { error'));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
