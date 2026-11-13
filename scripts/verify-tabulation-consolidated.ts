/**
 * verify-tabulation-consolidated.ts — proof for fix/master-tabulation-consolidated.
 *
 * Bug (a): ClassResultView cells used the raw mark while the row
 * total/GPA already used the consolidated (contribution-weighted) mark,
 * so a contribution-weighted exam showed one number in the cell and
 * another in the total. The fix makes the cell use getConsolidatedMark
 * exactly like ResultView does.
 *
 * Bug (b): contribution percentages were summed without validation —
 * a sum over 100 clamped the current exam's weight to 0 while
 * contributor weights stayed unnormalized. The fix validates at exam
 * save (validateExam, used by both create and update): each percentage
 * 0-100 and the sum <= 100. Latent: no contributions UI was found in
 * the app, so this guards the data path, not a screen.
 *
 * Run: npx tsx scripts/verify-tabulation-consolidated.ts
 */
import { readFileSync } from 'node:fs';
import { getConsolidatedMark } from '../services/utils';
import { validateExam } from '../services/examValidation';
import type { Exam, MarkRecord } from '../types';

let failures = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  <-- ${extra || ''}`}`);
  if (!ok) failures++;
};

// (1) Cell source: ClassResultView reads cells through getConsolidatedMark.
const src = readFileSync(new URL('../components/ClassResultView.tsx', import.meta.url), 'utf8');
check('ClassResultView imports getConsolidatedMark', src.includes('getConsolidatedMark'));
check('cell lookup uses getConsolidatedMark', src.includes('getConsolidatedMark(student.id, sub.id, exam.id, exams, marks)'));
check('no raw marks.find cell lookup left',
  !src.includes('marks.find(m => m.studentId === student.id && m.subjectId === sub.id && m.examId === exam.id)'));

// (2) The consolidated value itself: current 60% + contributor 40%.
//     Current 50/100, contributor 80/100 -> 50*0.6 + 80*0.4 = 62.
const exams: Exam[] = [
  { id: 'ex-1', name: 'Final', category: 'Final', academicYear: '2026', status: 'SCHEDULED',
    enableContributions: true, contributions: [{ examId: 'ex-0', percentage: 40 }] } as Exam,
  { id: 'ex-0', name: 'Midterm', category: 'Term', academicYear: '2026', status: 'SCHEDULED' } as Exam,
];
const marks: MarkRecord[] = [
  { id: 'm1', studentId: 'st-1', subjectId: 'sub-1', examId: 'ex-1', obtained: 50, total: 100 } as MarkRecord,
  { id: 'm0', studentId: 'st-1', subjectId: 'sub-1', examId: 'ex-0', obtained: 80, total: 100 } as MarkRecord,
];
const consolidated = getConsolidatedMark('st-1', 'sub-1', 'ex-1', exams, marks);
check('consolidated cell value is 62, not raw 50', consolidated?.obtained === 62, JSON.stringify(consolidated));

// (3) Contribution validation at exam save.
const base = { name: 'Final', category: 'Final', academicYear: '2026', status: 'SCHEDULED' } as Partial<Exam>;
{
  const r = validateExam({ ...base, contributions: [{ examId: 'ex-0', percentage: 60 }, { examId: 'ex-2', percentage: 50 }] }, [], [], []);
  check('contributions summing to 110 rejected', !r.isValid && !!r.errors.contributions, JSON.stringify(r.errors));
}
{
  const r = validateExam({ ...base, contributions: [{ examId: 'ex-0', percentage: 150 }] }, [], [], []);
  check('single contribution over 100 rejected', !r.isValid && !!r.errors.contributions, JSON.stringify(r.errors));
}
check('contributions summing to 100 valid',
  validateExam({ ...base, contributions: [{ examId: 'ex-0', percentage: 60 }, { examId: 'ex-2', percentage: 40 }] }, [], [], []).isValid);
check('contributions summing to 60 valid',
  validateExam({ ...base, contributions: [{ examId: 'ex-0', percentage: 60 }] }, [], [], []).isValid);
check('no contributions valid', validateExam(base, [], [], []).isValid);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
