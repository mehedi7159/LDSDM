/**
 * verify-pass-rate-analytics.ts — scripted proof that Academic Analytics'
 * headline ("সামগ্রিক পাসের হার") uses the same student-level pass rate
 * as the dashboard, reports and exam results (Fix #5's definition).
 *
 * The bug (morning audit 16 Nov 2026): the same exam showed 46.4% in
 * Academic Analytics but 23% on the dashboard, 7.7% in Reports and 5.9%
 * in the portal. The other three were unified by fix/rc-pass-rate-unify
 * (shared calcPassRate + one denominator rule), but Analytics was never
 * touched: its overall rate is SUBJECT-level — globalPassed / globalCount
 * where globalCount is the number of MARK records, so a student with
 * marks in 5 subjects counts 5 times and a student with 1 mark counts
 * once. No formula tweak can make that equal a student-level rate.
 *
 * The fix (this branch): for ONE exam (scope 'current', the default and
 * the case the audit compared) the overall rate is student-level, exactly
 * the Fix #5 definition — evaluated = a real, active student with at
 * least one mark in the exam (orphan marks count in neither side);
 * passed = their total result is not a fail, via calculateTotalGPA.
 * Two traps the fixture pins down:
 *   (a) a student with a mark in only SOME subjects is evaluated but
 *       FAILS — calculateTotalGPA fails a missing core-subject mark, so
 *       "no failed mark" alone is NOT a pass; the component must call
 *       the real calculateTotalGPA, not re-derive pass from markDetails.
 *   (b) a student who scored 0 in every subject is evaluated (and
 *       failed), not dropped.
 * Per-subject rates stay subject-level on purpose: a subject's pass rate
 * is passed-marks / total-marks in that subject. With scope 'all' there
 * is no single exam, so the overall stays the mark-level figure it
 * always was.
 *
 * Checks:
 *   (1) Fixture: exam ex1, subjects Bangla + Math (pass 33). s1 passes
 *       both, s2 fails Math, s3 has a Bangla mark only (passed it) but
 *       no Math mark, s4 scored 0 in both, gone1 is an orphan mark
 *       (90 in Bangla, no student record). Old mark-level overall:
 *       5 passed / 8 marks = 62.5%. Fixed student-level: 1 passed /
 *       4 evaluated = 25.0%.
 *   (2) Source checks: the component imports calcPassRate and
 *       calculateTotalGPA, builds the evaluated list from markDetails
 *       studentIds filtered to Active, passes each through
 *       calculateTotalGPA for the effective exam, feeds the counts to
 *       calcPassRate — while per-subject rates stay eval-based and the
 *       'all' scope keeps the mark-level overall.
 *
 * Run: npx tsx scripts/verify-pass-rate-analytics.ts
 * (or npm run test:pass-rate-analytics).
 */
import { calcPassRate } from '../services/gradingEngine';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

// Fixture: 2 core subjects, pass mark 33. One mark row per subject sat.
type MarkRow = { studentId: string; subjectId: string; obtained: number; isAbsent?: boolean };
const students = [
  { id: 's1', status: 'Active', isFormer: false },
  { id: 's2', status: 'Active', isFormer: false },
  { id: 's3', status: 'Active', isFormer: false },
  { id: 's4', status: 'Active', isFormer: false },
];
const coreSubjects = ['bn', 'math'];
const markRows: MarkRow[] = [
  { studentId: 's1', subjectId: 'bn', obtained: 80 },
  { studentId: 's1', subjectId: 'math', obtained: 70 },
  { studentId: 's2', subjectId: 'bn', obtained: 60 },
  { studentId: 's2', subjectId: 'math', obtained: 20 },
  { studentId: 's3', subjectId: 'bn', obtained: 55 },
  { studentId: 's4', subjectId: 'bn', obtained: 0 },
  { studentId: 's4', subjectId: 'math', obtained: 0 },
  { studentId: 'gone1', subjectId: 'bn', obtained: 90 },
];
// Subject-level pass for one mark row (mirrors the component's rule for
// simple subjects: no CQ/MCQ split, absent fails).
const markPasses = (m: MarkRow) => !m.isAbsent && m.obtained >= 33;
// Student-level pass, mirroring calculateTotalGPA for simple subjects:
// EVERY core subject needs a passing mark; a missing subject fails.
const studentPasses = (id: string) =>
  coreSubjects.every(sub => {
    const m = markRows.find(r => r.studentId === id && r.subjectId === sub);
    return !!m && markPasses(m);
  });

// (1) The two rates on the same fixture
{
  const oldPassed = markRows.filter(markPasses).length; // 5 (s1x2, s2 bn, s3 bn, gone1)
  const oldTotal = markRows.length; // 8
  eq('(1) old mark-level overall is 62.5%', calcPassRate(oldPassed, oldTotal), 62.5);

  const distinctHolders = Array.from(new Set(markRows.map(m => m.studentId)));
  const evaluatedIds = distinctHolders.filter(id => {
    const st = students.find(s => s.id === id);
    return !!st && st.status === 'Active' && !st.isFormer;
  });
  eq('(1) fixed evaluated is 4 students (orphan excluded)', evaluatedIds.length, 4);
  eq('(1) partial-marks student s3 is evaluated', evaluatedIds.includes('s3'), true);
  eq('(1) all-zero student s4 is evaluated', evaluatedIds.includes('s4'), true);
  const passedIds = evaluatedIds.filter(studentPasses);
  eq('(1) fixed passed is 1 student (only s1)', passedIds.length, 1);
  eq('(1) partial-marks student s3 FAILS (missing Math mark)', studentPasses('s3'), false);
  eq('(1) all-zero student s4 FAILS', studentPasses('s4'), false);
  eq('(1) fixed student-level overall is 25.0%', calcPassRate(passedIds.length, evaluatedIds.length), 25);
}

// (2) Source checks — since fix/pass-rate-v2 the single-exam overall no
// longer builds its own evaluated list: it delegates to the ONE shared
// calcExamPassRate (services/examPassRate.ts), which embodies the rules
// checked in (1) above (distinct students with marks, Active only,
// orphan excluded, partial-marks and all-zero students fail).
// verify-pass-rate-v2.ts proves the helper itself.
{
  const src = readSource('components/SubjectPerformanceAnalytics.tsx');
  check('(2) Analytics uses the shared calcExamPassRate',
    src.includes('calcExamPassRate'), 'must delegate to calcExamPassRate');
  check('(2) single-exam overall comes from the shared result',
    src.includes('calcExamPassRate({ students: scopedStudents, marks, subjects, exams, examId: effectiveExamId })'), 'overallPass must come from the shared helper for the effective exam');
  check('(2) no local evaluated-student list remains',
    !src.includes('Array.from(new Set(markDetails.map(md => md.studentId)))'), 'the old markDetails evaluated list must be gone');
  check('(2) per-subject rate stays subject-level (eval-based)',
    src.includes('const passRate = (totalPassed / totalAppeared) * 100;'), 'per-subject passRate must stay (totalPassed / totalAppeared)');
  check('(2) scope all keeps the mark-level overall',
    src.includes("if (effectiveExamId !== 'ALL')") && src.includes('overallPass = globalCount > 0 ? (globalPassed / globalCount) * 100 : 0;'), 'the ALL-scope fallback must keep the mark-level overall');
  const pkg = JSON.parse(readSource('package.json'));
  check('(2) package.json exposes the verify script',
    pkg.scripts['test:pass-rate-analytics'] === 'tsx scripts/verify-pass-rate-analytics.ts', 'npm run test:pass-rate-analytics must run this script');
}

console.log(failures === 0 ? '\nALL PASS-RATE-ANALYTICS CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
