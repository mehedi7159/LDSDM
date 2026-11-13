/**
 * verify-mobile-marks-cap.ts — proof for fix/master-mobile-marks-cap.
 *
 * Bug: StaffMobileApp handleSaveMarks clamped every mark to 100
 * (Math.min(100, ...)), pushed total:100 and hardcoded 100-scale grade
 * bands — so 80 in a 50-mark subject saved as 80/50, and >100-mark
 * subjects were truncated. The fix rejects (with a shown message) any
 * value <0 or > the subject's fullMarks, sends total/fullMarks/passMarks
 * from the subject (or its exam assignment), and lets
 * buildUpsertMarkPayload compute grade/gradePoint.
 *
 * The save handler lives in a component, so the script proves the two
 * halves it can: (a) the payload shape the mobile path now sends is
 * graded on the subject's own scale by the builder, and an over-full
 * value is refused by the builder too; (b) the clamp + hardcoded bands
 * are gone from StaffMobileApp and the rejection path is present.
 *
 * Run: npx tsx scripts/verify-mobile-marks-cap.ts
 */
import { readFileSync } from 'node:fs';
import { buildUpsertMarkPayload } from '../services/examService';
import type { Exam, ExamSubjectAssignment, Subject } from '../types';

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

// (1) The payload the mobile path now sends for a 50-mark subject:
//     no grade fields — the builder grades 40/50 as 80% = A+.
const p = buildUpsertMarkPayload(
  { ...base, obtained: 40, total: 50, fullMarks: 50, passMarks: 17 },
  undefined, subject, examSubject, exam,
);
check('40/50 builds as A+ (80%)', p.mark !== null && p.mark?.grade === 'A+' && p.mark?.gradePoint === 5 && p.mark?.total === 50, JSON.stringify(p.mark));

// (2) 80 in a 50-mark subject is refused, not clamped/saved.
const over = buildUpsertMarkPayload(
  { ...base, obtained: 80, total: 50, fullMarks: 50, passMarks: 17 },
  undefined, subject, examSubject, exam,
);
check('80/50 refused', over.mark === null && !!over.error, JSON.stringify(over));

// (3) A >100-mark subject keeps its own scale: 90/150 = 60% = A-.
const big: Subject = { ...subject, id: 'sub-2', name: 'Big', fullMarks: 150, passMarks: 50 };
const bigAsg: ExamSubjectAssignment = { ...examSubject, id: 'es-2', subjectId: 'sub-2', fullMarks: 150, passMarks: 50 };
const b = buildUpsertMarkPayload(
  { studentId: 'st-1', subjectId: 'sub-2', examId: 'ex-1', obtained: 90, total: 150, fullMarks: 150, passMarks: 50 },
  undefined, big, bigAsg, exam,
);
check('90/150 builds as A- (60%), not truncated to 100', b.mark !== null && b.mark?.grade === 'A-' && b.mark?.obtained === 90, JSON.stringify(b.mark));

// (4) The clamp + hardcoded bands are gone from the mobile save path.
const src = readFileSync(new URL('../components/StaffMobileApp.tsx', import.meta.url), 'utf8');
check('no Math.min(100, ...) clamp in mobile save', !src.includes('Math.min(100, Math.max(0, Number(val)'));
check('no hardcoded 100-scale grade bands in mobile save', !src.includes("numVal >= 80 ? 'A+'"));
check('no hardcoded total:100 in mobile save', !src.includes('total: 100,'));
check('rejection notice exists', src.includes('marksRejectedNotice'));
check('save sends subject fullMarks', src.includes('total: fullMarks,'));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
